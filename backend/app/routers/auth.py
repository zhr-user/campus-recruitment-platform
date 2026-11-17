"""真实注册、登录、退出与会话恢复。"""
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Response, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from app.deps import get_db, current_user
from app.schemas.user import RegisterInput, LoginInput, EmptyInput
from app.schemas.state import fresh_state
from app.models.user import User
from app.models.account_state import AccountState
from app.services.accounts import issue_session, revoke_session, account_payload
from app.utils.security import hash_password, verify_password
from app.config import COOKIE_NAME
router=APIRouter(prefix='/api/auth',tags=['账号'])
@router.post('/register',status_code=201)
def register(body:RegisterInput,request:Request,response:Response,db=Depends(get_db)):
    if db.scalar(select(User).where(User.email==body.email)): raise HTTPException(409,'这个邮箱已注册，请直接登录')
    user=User(email=body.email,name=body.name,password_hash=hash_password(body.password),role='candidate',created_at=datetime.now(timezone.utc).isoformat())
    try:
        db.add(user);db.flush();db.add(AccountState(user_id=user.id,data=fresh_state(),version=0));db.commit()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'这个邮箱已注册，请直接登录')
    issue_session(db,request,response,user,body.remember)
    return account_payload(db,user)
@router.post('/login')
def login(body:LoginInput,request:Request,response:Response,db=Depends(get_db)):
    user=db.scalar(select(User).where(User.email==body.email))
    valid=verify_password(body.password,user.password_hash if user else request.app.state.dummy_hash)
    if not user or not valid: raise HTTPException(401,'账号或密码不正确')
    issue_session(db,request,response,user,body.remember)
    return account_payload(db,user)
@router.get('/me')
def me(user=Depends(current_user),db=Depends(get_db)):
    return account_payload(db,user)
@router.post('/logout')
def logout(body:EmptyInput,request:Request,response:Response,user=Depends(current_user),db=Depends(get_db)):
    revoke_session(db,request);db.commit()
    response.delete_cookie(COOKIE_NAME,path='/',httponly=True,secure=request.app.state.secure_cookie,samesite='strict')
    return {'ok':True}
