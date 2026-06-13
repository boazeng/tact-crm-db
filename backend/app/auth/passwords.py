"""Password hashing + verification for email/password login.

Uses bcrypt directly (not passlib) — one fewer compatibility layer, and avoids
the passlib-1.7 / bcrypt-4.x `__about__` breakage that surfaces on AWS Lambda.
"""
import bcrypt

# bcrypt hashes only the first 72 bytes of the password; longer inputs are
# silently truncated. We reject them explicitly so two different long passwords
# can never collide.
_MAX_BYTES = 72


def hash_password(plain: str) -> str:
    raw = plain.encode("utf-8")
    if len(raw) > _MAX_BYTES:
        raise ValueError("Password too long (max 72 bytes)")
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    """Constant-time check. False (never raises) when the user has no password set."""
    if not hashed:
        return False
    raw = plain.encode("utf-8")[:_MAX_BYTES]
    try:
        return bcrypt.checkpw(raw, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False
