"""账号与可撤销登录会话。"""
from sqlalchemy import Integer, BigInteger, String, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
class User(Base):
    __tablename__ = 'users'
    __table_args__ = (CheckConstraint("role IN ('candidate','admin')"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(24), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), default='candidate', nullable=False)
    created_at: Mapped[str] = mapped_column(String(40), nullable=False)
class LoginSession(Base):
    __tablename__ = 'login_sessions'
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey('users.id', ondelete='CASCADE'), index=True)
    expires_at: Mapped[int] = mapped_column(BigInteger, index=True)
