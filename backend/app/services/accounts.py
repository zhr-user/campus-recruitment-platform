"""账号业务与独立求职数据存取。"""
import re
import secrets
import time
from sqlalchemy import delete, update
from fastapi import HTTPException
from app.config import COOKIE_NAME
from app.models.user import LoginSession
from app.models.account_state import AccountState
from app.utils.security import token_hash

def public_user(user):
    return {'id':user.id,'email':user.email,'name':user.name,'role':user.role}
def state_payload(db,user):
    row=db.get(AccountState,user.id)
    return {'state':row.data,'version':row.version}
def account_payload(db,user):
    return {'user':public_user(user),**state_payload(db,user)}
def revoke_session(db,request):
    token=request.cookies.get(COOKIE_NAME,'')
    if re.fullmatch(r'[a-f0-9]{64}',token):
        db.execute(delete(LoginSession).where(LoginSession.token_hash==token_hash(token)))

def issue_session(db,request,response,user,remember):
    revoke_session(db,request)
    now=int(time.time())
    db.execute(delete(LoginSession).where(LoginSession.expires_at<=now))
    token=secrets.token_hex(32);duration=30*86400 if remember else 12*3600
    db.add(LoginSession(token_hash=token_hash(token),user_id=user.id,expires_at=now+duration));db.commit()
    response.set_cookie(COOKIE_NAME,token,max_age=duration if remember else None,httponly=True,secure=request.app.state.secure_cookie,samesite='strict',path='/')

def validate_catalog(data,catalog,user):
    jobs={j['id'] for j in catalog['jobs']};skills={s['name'] for s in catalog['skills']}
    cities={j['city'] for j in catalog['jobs']};types={j['jobType'] for j in catalog['jobs']}
    p=data['profile']; f=data['filters']
    if any(x not in skills for x in p['skills']) or len(p['skills'])!=len(set(p['skills'])): raise HTTPException(400,'技能不在当前词典中')
    if (p['city'] and p['city'] not in cities) or (p['jobType'] and p['jobType'] not in types): raise HTTPException(400,'画像城市或岗位方向不正确')
    if (f['city'] and f['city'] not in cities) or (f['jobType'] and f['jobType'] not in types): raise HTTPException(400,'筛选条件不正确')
    apps=data['applications']
    if len({a['id'] for a in apps})!=len(apps) or len({a['jobId'] for a in apps})!=len(apps) or any(a['jobId'] not in jobs for a in apps): raise HTTPException(400,'投递记录不正确')
    if any(j not in jobs for j in data['favorites']+data['adminJobsOff']) or any(s not in skills for s in data['skillOff']): raise HTTPException(400,'收藏或复核标记不正确')
    if user.role!='admin' and (data['adminJobsOff'] or data['skillOff']): raise HTTPException(403,'没有后台修改权限')
    data['favorites']=list(dict.fromkeys(data['favorites']))
    return data

def save_private_state(db,user,data,version):
    result=db.execute(update(AccountState).where(AccountState.user_id==user.id,AccountState.version==version).values(data=data,version=version+1))
    if result.rowcount!=1:
        db.rollback();raise HTTPException(409,'其他页面已更新数据，请刷新后继续')
    db.commit();return {'version':version+1}
