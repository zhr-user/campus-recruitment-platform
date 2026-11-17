"""每个账号独立保存画像、收藏与流程，版本号防止多窗口覆盖。"""
from sqlalchemy import ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
class AccountState(Base):
    __tablename__ = 'account_states'
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    data: Mapped[dict] = mapped_column(JSON, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
