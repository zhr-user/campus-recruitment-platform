"""身份完全从服务端会话及数据库中读取。"""
import re
import time
from fastapi import Request, Depends, HTTPException
from app.config import COOKIE_NAME
from app.models.user import User, LoginSession
from app.utils.security import token_hash

def get_db(request: Request):
    with request.app.state.sessions() as session:
        yield session

def current_user(request: Request, db=Depends(get_db)):
    token=request.cookies.get(COOKIE_NAME,'')
    if not re.fullmatch(r'[a-f0-9]{64}',token): raise HTTPException(401,'请先登录')
    row=db.get(LoginSession,token_hash(token))
    if not row or row.expires_at<=int(time.time()): raise HTTPException(401,'登录已过期，请重新登录')
    user=db.get(User,row.user_id)
    if not user: raise HTTPException(401,'请先登录')
    # 账号头仅校验页面上下文，数据归属始终由会话决定。
    if request.url.path!='/api/auth/me' and request.headers.get('x-account-id')!=str(user.id):
        raise HTTPException(409,{'message':'账号已在其他页面切换，请刷新页面继续','code':'account_changed'})
    return user

def admin_user(user=Depends(current_user)):
    if user.role!='admin': raise HTTPException(403,'没有后台管理权限')
    return user
