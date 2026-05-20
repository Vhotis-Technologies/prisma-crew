"""
Encrypt sensitive fields at rest (crew IBAN).

Set ``FIELD_ENCRYPTION_KEY`` to a Fernet key (``Fernet.generate_key().decode()``).
If unset, derives a key from ``DJANGO_SECRET_KEY`` (less ideal for rotation).
"""
from __future__ import annotations

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings

logger = logging.getLogger(__name__)

ENC_PREFIX = "enc$"


def _fernet() -> Fernet:
    """
    Build a Fernet instance from settings.

    Uses ``FIELD_ENCRYPTION_KEY`` when set; otherwise derives a URL-safe key
    from ``SECRET_KEY`` via SHA-256 (dev-only fallback; not ideal for rotation).

    Returns:
        Fernet: Symmetric encryptor/decryptor for IBAN values.
    """
    raw = (getattr(settings, "FIELD_ENCRYPTION_KEY", None) or "").strip()
    if raw:
        key = raw.encode() if isinstance(raw, str) else raw
    else:
        secret = (getattr(settings, "SECRET_KEY", None) or "insecure-dev-key").encode()
        digest = hashlib.sha256(secret).digest()
        key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_iban(plain: str | None) -> str:
    """
    Normalize and encrypt an IBAN for database storage.

    Strips spaces, uppercases, and skips re-encryption when already prefixed
    with ``enc$``. Empty input returns an empty string.

    Args:
        plain: Raw IBAN from a form or API (may be None).

    Returns:
        str: ``enc$`` + Fernet token, or ``""`` when input is empty.
    """
    if not plain:
        return ""
    normalized = (plain or "").replace(" ", "").upper()
    if not normalized:
        return ""
    if normalized.startswith(ENC_PREFIX):
        return normalized
    token = _fernet().encrypt(normalized.encode("utf-8")).decode("utf-8")
    return f"{ENC_PREFIX}{token}"


def decrypt_iban(stored: str | None) -> str:
    """
    Decrypt a stored IBAN or return a legacy plaintext value.

    Values without ``enc$`` are treated as legacy plaintext (normalized).
    Decryption failures are logged and return ``""``.

    Args:
        stored: Database value (encrypted or legacy plaintext).

    Returns:
        str: Plain IBAN (no spaces) or ``""`` on failure/empty input.
    """
    if not stored:
        return ""
    value = (stored or "").strip()
    if not value.startswith(ENC_PREFIX):
        return value.replace(" ", "").upper()
    token = value[len(ENC_PREFIX) :]
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        logger.error("Failed to decrypt IBAN field: %s", exc)
        return ""


def mask_iban(value: str | None) -> str:
    """
    Mask an IBAN for admin/support display (last four digits only).

    Decrypts when the value uses ``enc$``; otherwise treats input as plaintext.

    Args:
        value: Stored or plain IBAN.

    Returns:
        str: ``****`` + last 4 chars, or ``****`` / ``""`` for short/empty values.
    """
    plain = decrypt_iban(value) if value and value.startswith(ENC_PREFIX) else (value or "")
    plain = (plain or "").replace(" ", "")
    if len(plain) < 4:
        return "****" if plain else ""
    return "****" + plain[-4:]
