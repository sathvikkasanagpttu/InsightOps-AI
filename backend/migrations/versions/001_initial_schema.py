"""Initial Enterprise Schema Migration

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-03 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Schema creation is dynamically managed via Base.metadata.create_all(bind=engine)
    # in init_db(), ensuring seamless compatibility with SQLite in test/dev and PostgreSQL in production.
    pass


def downgrade() -> None:
    pass
