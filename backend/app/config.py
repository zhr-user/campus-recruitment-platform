"""后端配置，数据库可在 SQLite 与 MySQL 之间切换。"""
import os
from pathlib import Path
from dotenv import load_dotenv
ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / 'backend' / '.env', override=False)
DATABASE_URL = os.getenv('CAMPUS_DATABASE_URL', 'sqlite:///' + (ROOT / 'backend' / 'data' / 'accounts.sqlite').as_posix())
SECURE_COOKIE = os.getenv('CAMPUS_SECURE_COOKIE', '0') == '1'
COOKIE_NAME = 'campus_session'
