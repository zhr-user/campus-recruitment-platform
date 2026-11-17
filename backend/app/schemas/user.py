"""账号接口契约，额外字段一律拒绝。"""
import re
from pydantic import BaseModel, ConfigDict, Field, field_validator
class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
class LoginInput(StrictModel):
    email: str = Field(max_length=254)
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False
    @field_validator('email')
    @classmethod
    def email_format(cls, value):
        value=value.strip().lower()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',value):
            raise ValueError('请输入有效的邮箱地址')
        return value
class NameInput(StrictModel):
    name: str = Field(min_length=1,max_length=24)
    @field_validator('name')
    @classmethod
    def name_format(cls,value):
        if not value.strip() or any(ord(c)<32 for c in value):
            raise ValueError('昵称格式不正确')
        return value.strip()
class RegisterInput(LoginInput, NameInput):
    password: str = Field(min_length=12,max_length=128)
class EmptyInput(StrictModel):
    pass
