"""个人设置与求职数据接口。"""
from fastapi import APIRouter, Request, Depends
from app.deps import get_db, current_user
from app.schemas.user import NameInput
from app.schemas.state import StateInput
from app.services.accounts import public_user, state_payload, validate_catalog, save_private_state
router=APIRouter(tags=['个人求职空间'])
@router.patch('/api/account')
def rename(body:NameInput,user=Depends(current_user),db=Depends(get_db)):
    user.name=body.name;db.commit();return {'user':public_user(user)}
@router.get('/api/state')
def read_state(user=Depends(current_user),db=Depends(get_db)):
    return state_payload(db,user)
@router.put('/api/state')
def save_state(body:StateInput,request:Request,user=Depends(current_user),db=Depends(get_db)):
    data=validate_catalog(body.state.model_dump(exclude_none=True),request.app.state.catalog,user)
    return save_private_state(db,user,data,body.version)
