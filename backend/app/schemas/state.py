"""求职数据契约，不接受由客户端指定的账号或权限。"""
from datetime import datetime
from typing import Literal
from pydantic import Field, field_validator, model_validator
from app.schemas.user import StrictModel
Status = Literal['applied','written','interview','offer','closed']
class Profile(StrictModel):
    id: str | None = Field(default=None,max_length=50)
    name: str = Field(min_length=1,max_length=24)
    preset: str = Field(default='custom',max_length=50)
    basePreset: str = Field(default='da-hz',max_length=50)
    skills: list[str] = Field(max_length=100)
    city: str = Field(max_length=50)
    salaryMin: int = Field(ge=3000,le=60000)
    salaryMax: int = Field(ge=3000,le=60000)
    jobType: str = Field(max_length=50)
    campusOnly: bool
    @model_validator(mode='after')
    def salary_range(self):
        if self.salaryMax<=self.salaryMin or not self.name.strip(): raise ValueError('画像格式不正确')
        return self
class History(StrictModel):
    status: Status
    at: str = Field(max_length=40)
    note: str | None = Field(default=None,max_length=2000)
    @field_validator('at')
    @classmethod
    def valid_date(cls,value):
        datetime.fromisoformat(value.replace('Z','+00:00'))
        return value
class Application(StrictModel):
    id: str = Field(pattern=r'^[a-zA-Z0-9_-]{1,100}$')
    jobId: str
    status: Status
    createdAt: str = Field(max_length=40)
    updatedAt: str = Field(max_length=40)
    note: str = Field(default='',max_length=2000)
    history: list[History] = Field(max_length=100)
    @field_validator('createdAt','updatedAt')
    @classmethod
    def valid_date(cls,value):
        datetime.fromisoformat(value.replace('Z','+00:00'))
        return value
class Filters(StrictModel):
    salaryOnly: bool
    city: str
    jobType: str
    campusOnly: bool
    favoritesOnly: bool
    keyword: str = Field(max_length=120)
    sort: Literal['score','salary','date']
class PrivateState(StrictModel):
    profile: Profile
    applications: list[Application] = Field(max_length=400)
    favorites: list[str] = Field(max_length=400)
    algorithm: Literal['rule','tfidf']
    filters: Filters
    adminTab: Literal['jobs','sources','tasks','dictionary','quality']
    adminJobsOff: list[str] = Field(max_length=400)
    skillOff: list[str] = Field(max_length=100)
    lastPage: Literal['recommend','profile','applications','dashboard','experiment','admin']
class StateInput(StrictModel):
    state: PrivateState
    version: int = Field(ge=0)

def fresh_state():
    return {'profile':{'name':'我的求职画像','preset':'custom','basePreset':'da-hz','skills':[],'city':'','salaryMin':8000,'salaryMax':18000,'jobType':'','campusOnly':False},'applications':[],'favorites':[],'algorithm':'rule','filters':{'salaryOnly':True,'city':'','jobType':'','campusOnly':False,'favoritesOnly':False,'keyword':'','sort':'score'},'adminTab':'jobs','adminJobsOff':[],'skillOff':[],'lastPage':'recommend'}
