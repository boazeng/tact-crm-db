"""project_field_labels: add sort_order

Revision ID: a1b2c3d4e5f6
Revises: 9238e5ad5c1a
Create Date: 2026-06-13 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9238e5ad5c1a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: NULL rows fall back to the natural field order in the app.
    with op.batch_alter_table('project_field_labels', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sort_order', sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('project_field_labels', schema=None) as batch_op:
        batch_op.drop_column('sort_order')
