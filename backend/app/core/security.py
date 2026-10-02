import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

SECRET_KEY = os.getenv("SECRET_KEY", "insightops-ai-production-super-secret-jwt-key-2026")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))


# ==========================================
# 1. PBKDF2-HMAC-SHA256 Password Hashing
# ==========================================

def hash_password(password: str) -> str:
    """
    Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations and a random 16-byte salt.
    Format: iterations$salt_hex$hash_hex
    """
    salt = secrets.token_bytes(16)
    iterations = 100_000
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"{iterations}${salt.hex()}${derived.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    """
    Verifies a password against the stored PBKDF2-HMAC-SHA256 hash.
    """
    try:
        parts = hashed.split("$")
        if len(parts) != 3:
            return False
        iterations = int(parts[0])
        salt = bytes.fromhex(parts[1])
        expected_hash = parts[2]
        derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
        return hmac.compare_digest(derived.hex(), expected_hash)
    except Exception:
        return False


# ==========================================
# 2. RFC 7519 Compliant HS256 JWT Handling
# ==========================================

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64url_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)


def create_jwt_token(payload: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    to_encode = payload.copy()

    now = int(time.time())
    to_encode["iat"] = now
    if expires_delta:
        to_encode["exp"] = now + int(expires_delta.total_seconds())
    else:
        to_encode["exp"] = now + (ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(to_encode, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}"

    signature = hmac.new(
        SECRET_KEY.encode("utf-8"),
        signing_input.encode("utf-8"),
        hashlib.sha256
    ).digest()
    signature_b64 = _b64url_encode(signature)

    return f"{signing_input}.{signature_b64}"


def decode_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}"

        expected_sig = hmac.new(
            SECRET_KEY.encode("utf-8"),
            signing_input.encode("utf-8"),
            hashlib.sha256
        ).digest()

        if not hmac.compare_digest(_b64url_encode(expected_sig), signature_b64):
            return None

        payload_bytes = _b64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        # Verify expiration
        exp = payload.get("exp")
        if exp and time.time() > exp:
            return None

        return payload
    except Exception:
        return None


def create_access_token(user_id: str, email: str, role: str = "Admin") -> str:
    return create_jwt_token({
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access"
    }, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))


def create_refresh_token(user_id: str) -> str:
    return create_jwt_token({
        "sub": user_id,
        "type": "refresh"
    }, timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))


def generate_random_token() -> str:
    return secrets.token_urlsafe(32)
