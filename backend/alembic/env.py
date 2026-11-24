import os
from logging.config import fileConfig
from alembic import context

config = context.config
_db_url = os.environ.get("DATABASE_URL", "")
if not _db_url:
    # .env faylidan o'qish (lokal ishga tushirish uchun)
    try:
        from app.config import settings
        _db_url = settings.database_url
    except Exception:
        pass
# SQLAlchemy 2.1+ "postgresql://" uchun psycopg (v3) ni tanlaydi — psycopg2 ni aniq ko'rsatamiz
if _db_url.startswith("postgresql://") or _db_url.startswith("postgres://"):
    _db_url = "postgresql+psycopg2://" + _db_url.split("://", 1)[1]
config.set_main_option("sqlalchemy.url", _db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=None, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    from sqlalchemy import create_engine
    engine = create_engine(config.get_main_option("sqlalchemy.url"))
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=None)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
