"""API-key generation and hashing (used by the api_keys router + deps)."""
import hashlib
import secrets

PREFIX = "tactcrm_"


def generate_api_key() -> tuple[str, str, str]:
    """Return (raw_key, prefix, sha256_hash). The raw key is shown to the user once."""
    raw = PREFIX + secrets.token_urlsafe(32)
    return raw, raw[:12], hash_key(raw)


def hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
