"""后台入口必须通过服务端管理员鉴权。"""
from fastapi import APIRouter, Request, Depends
from sqlalchemy import select, func
from app.deps import get_db, admin_user
from app.models.user import User
router=APIRouter(prefix='/api/admin',tags=['后台管理'])
@router.get('/summary')
def summary(request:Request,user=Depends(admin_user),db=Depends(get_db)):
    return {'jobs':len(request.app.state.catalog['jobs']),'skills':len(request.app.state.catalog['skills']),'users':db.scalar(select(func.count(User.id))),'collectorConnected':False}
