"""Verify a Google Sign-In ID token, dependency-free beyond pyjwt.

The frontend uses Google Identity Services to obtain an ID token (a JWT signed by
Google). We verify its signature against Google's public JWKS, check the audience
matches our OAuth client ID and the issuer is Google, and return the claims. No
client secret is involved in this flow.
"""
import jwt
from jwt import PyJWKClient

from ..config import settings

_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}

# PyJWKClient caches the fetched signing keys, so reuse one instance across warm
# Lambda invocations instead of hitting Google on every login.
_jwk_client: PyJWKClient | None = None


class GoogleAuthError(Exception):
    """Token verification failed (with a user-facing Hebrew message)."""


def _client() -> PyJWKClient:
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = PyJWKClient(_JWKS_URL)
    return _jwk_client


def verify_google_token(credential: str) -> dict:
    """Validate a Google ID token and return its claims, or raise GoogleAuthError."""
    client_id = (settings.google_client_id or "").strip()
    if not client_id:
        raise GoogleAuthError("התחברות Google אינה מוגדרת")
    try:
        signing_key = _client().get_signing_key_from_jwt(credential)
        claims = jwt.decode(
            credential,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            options={"require": ["exp", "iat", "aud"]},
        )
    except Exception as e:  # noqa: BLE001 — any failure is an auth failure
        raise GoogleAuthError("אימות Google נכשל") from e

    if claims.get("iss") not in _ISSUERS:
        raise GoogleAuthError("אימות Google נכשל")
    email = claims.get("email")
    if not email or not claims.get("email_verified", False):
        raise GoogleAuthError("חשבון Google ללא אימייל מאומת")
    return claims
