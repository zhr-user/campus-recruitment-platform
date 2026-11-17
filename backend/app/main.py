"""应用入口：装配路由、中间件与前端页面。"""
import json
import logging
import re
import secrets
import time
from collections import defaultdict, deque
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, HTMLResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.config import ROOT, DATABASE_URL, SECURE_COOKIE
from app.database import Base, configure_database
from app.models import User, LoginSession, AccountState
from app.routers import auth, account, admin
from app.utils.security import hash_password

def create_app(database_url=None,rate_limit=True,secure_cookie=None):
    (ROOT / 'backend' / 'data').mkdir(parents=True,exist_ok=True)
    engine,sessions=configure_database(database_url or DATABASE_URL)
    Base.metadata.create_all(engine)
    app=FastAPI(title='校招罗盘接口',version='1.0.0',docs_url='/api/docs',redoc_url=None,openapi_url='/api/openapi.json',swagger_ui_parameters={'persistAuthorization':False})
    app.state.engine=engine;app.state.sessions=sessions;app.state.rate_limit=rate_limit
    app.state.secure_cookie=SECURE_COOKIE if secure_cookie is None else secure_cookie
    app.state.catalog=json.loads((ROOT / 'frontend' / 'src' / 'demo-data.json').read_text(encoding='utf-8'))
    app.state.dummy_hash=hash_password(secrets.token_hex(24))
    attempts=defaultdict(deque)
    @app.middleware('http')
    async def security(request:Request,call_next):
        host=request.headers.get('host','')
        if not re.fullmatch(r'(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?',host,re.I):
            return JSONResponse({'error':'访问地址不正确'},status_code=400)
        if request.method not in ('GET','HEAD','OPTIONS'):
            origin=request.headers.get('origin','')
            if origin not in ('http://'+host,'https://'+host): return JSONResponse({'error':'请求来源校验失败，请从平台页面操作'},status_code=403)
            if not request.headers.get('content-type','').lower().startswith('application/json'): return JSONResponse({'error':'请使用 JSON 请求'},status_code=415)
            chunks=[];size=0
            async for chunk in request.stream():
                size+=len(chunk)
                if size>1024*1024:return JSONResponse({'error':'请求内容过大'},status_code=413)
                chunks.append(chunk)
            request._body=b''.join(chunks)
        if app.state.rate_limit and request.url.path in ('/api/auth/login','/api/auth/register') and request.method=='POST':
            now=time.monotonic();key=request.client.host if request.client else 'local';queue=attempts[key]
            while queue and queue[0]<now-900:queue.popleft()
            if len(queue)>=30:return JSONResponse({'error':'操作过于频繁，请稍后再试'},status_code=429,headers={'Retry-After':'900'})
            queue.append(now)
        response=await call_next(request)
        response.headers['X-Content-Type-Options']='nosniff'
        response.headers['X-Frame-Options']='DENY'
        response.headers['Referrer-Policy']='same-origin'
        response.headers['Cache-Control']='no-store'
        return response
    @app.exception_handler(RequestValidationError)
    async def validation_error(request,exc):
        fields={str(e['loc'][-1]) for e in exc.errors()}
        message='请求数据格式不正确，请检查填写内容'
        if 'password' in fields: message='密码长度应为12至128位' if request.url.path.endswith('register') else '请输入密码'
        elif 'email' in fields:message='请输入有效的邮箱地址'
        elif 'name' in fields:message='昵称或画像名称应为1至24字'
        return JSONResponse({'error':message},status_code=400)
    @app.exception_handler(StarletteHTTPException)
    async def http_error(request,exc):
        detail=exc.detail
        payload={'error':detail.get('message','请求失败'),'code':detail.get('code')} if isinstance(detail,dict) else {'error':detail if exc.status_code!=404 else '接口或页面不存在'}
        return JSONResponse(payload,status_code=exc.status_code)
    @app.exception_handler(Exception)
    async def internal_error(request,exc):
        logging.getLogger('campus').error('请求处理失败：%s',type(exc).__name__)
        return JSONResponse({'error':'服务暂时不可用，请稍后重试'},status_code=500)
    @app.get('/api/health',tags=['服务状态'])
    def health():return {'service':'campus-compass','status':'ok','framework':'FastAPI'}
    @app.get('/',response_class=HTMLResponse,include_in_schema=False)
    @app.get('/index.html',response_class=HTMLResponse,include_in_schema=False)
    def frontend():
        nonce=secrets.token_urlsafe(24)
        html=(ROOT / 'frontend' / 'index.html').read_text(encoding='utf-8')
        html=re.sub(r'<script\b', '<script nonce="'+nonce+'"',html)
        policy=f"default-src 'self'; script-src 'self' 'nonce-{nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
        return HTMLResponse(html,headers={'Content-Security-Policy':policy})
    app.include_router(auth.router);app.include_router(account.router);app.include_router(admin.router)
    return app
