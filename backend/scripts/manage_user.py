"""仅供设备维护者在终端授予或撤销管理员权限。"""
import argparse
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from sqlalchemy import select
from app.config import DATABASE_URL
from app.database import configure_database
from app.models import User
parser=argparse.ArgumentParser(description='管理已注册账号的权限')
parser.add_argument('email',help='已经注册的邮箱')
parser.add_argument('--role',choices=['candidate','admin'],required=True,help='授予的身份')
args=parser.parse_args()
engine,factory=configure_database(DATABASE_URL)
with factory() as session:
    user=session.scalar(select(User).where(User.email==args.email.strip().lower()))
    if not user: parser.exit(1,'未找到此账号，请先在平台完成注册。\n')
    user.role=args.role;session.commit();print('账号权限已更新。')
engine.dispose()
