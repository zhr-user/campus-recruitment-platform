"""关系数据库引擎与会话工厂，不在网页中暴露连接配置。"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
class Base(DeclarativeBase):
    pass

def configure_database(url):
    options = {'pool_pre_ping': True}
    if url.startswith('sqlite:'):
        options['connect_args'] = {'check_same_thread': False, 'timeout': 5}
    engine = create_engine(url, **options)
    if url.startswith('sqlite:'):
        @event.listens_for(engine, 'connect')
        def sqlite_options(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')
            connection.execute('PRAGMA journal_mode=WAL')
    return engine, sessionmaker(bind=engine, expire_on_commit=False)
