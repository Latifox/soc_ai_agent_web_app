"""Test fixtures for the API.

Makes ``apps.api.*`` and ``aegis_core`` importable without a prior install, and
provides a ``TestClient`` whose settings use a known JWT secret plus a ``make_token``
factory so tests can mint valid Supabase-style tokens.
"""

from __future__ import annotations

import sys
import time
from collections.abc import Callable
from pathlib import Path

import jwt
import pytest

_ROOT = Path(__file__).resolve().parents[3]
_CORE_SRC = _ROOT / "packages" / "aegis-core" / "src"
for _p in (str(_ROOT), str(_CORE_SRC)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from aegis_core import Settings  # noqa: E402
from apps.api.deps import get_app_settings  # noqa: E402
from apps.api.main import app  # noqa: E402

TEST_JWT_SECRET = "test-jwt-secret-with-at-least-thirty-two-chars"


@pytest.fixture
def settings() -> Settings:
    return Settings(supabase_jwt_secret=TEST_JWT_SECRET)


@pytest.fixture
def client(settings):
    from fastapi.testclient import TestClient  # noqa: PLC0415

    app.dependency_overrides[get_app_settings] = lambda: settings
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def make_token() -> Callable[..., str]:
    def _make(
        *,
        secret: str = TEST_JWT_SECRET,
        tenant_id: str | None = "acme",
        role: str = "analyst",
        permissions: list[str] | None = None,
        sub: str = "user-123",
    ) -> str:
        claims: dict[str, object] = {
            "sub": sub,
            "email": "priya@acme.com",
            "role": role,
            "permissions": permissions if permissions is not None else ["rules:read"],
            "exp": int(time.time()) + 3600,
        }
        if tenant_id is not None:
            claims["tenant_id"] = tenant_id
        return jwt.encode(claims, secret, algorithm="HS256")

    return _make
