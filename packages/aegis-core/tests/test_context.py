"""Tests for the tenant context (set / get / require)."""

from __future__ import annotations

import pytest

from aegis_core.context import (
    TenantContext,
    clear_tenant_context,
    current_tenant_id,
    get_tenant_context,
    require_tenant_context,
    reset_tenant_context,
    set_tenant_context,
)
from aegis_core.errors import TenantContextError


@pytest.fixture(autouse=True)
def _clean_context():
    clear_tenant_context()
    yield
    clear_tenant_context()


def test_get_returns_none_when_unset():
    assert get_tenant_context() is None


def test_set_then_get_round_trip():
    ctx = TenantContext(tenant_id="acme", user_id="u1", role="analyst")
    set_tenant_context(ctx)
    assert get_tenant_context() is ctx
    assert current_tenant_id() == "acme"


def test_require_raises_when_unset():
    with pytest.raises(TenantContextError):
        require_tenant_context()


def test_require_returns_when_set():
    ctx = TenantContext(tenant_id="acme")
    set_tenant_context(ctx)
    assert require_tenant_context() is ctx


def test_reset_restores_previous_value():
    token = set_tenant_context(TenantContext(tenant_id="acme"))
    assert current_tenant_id() == "acme"
    reset_tenant_context(token)
    assert get_tenant_context() is None


def test_permissions_helper():
    ctx = TenantContext(tenant_id="acme", permissions=("rules:read", "cases:write"))
    assert ctx.has_permission("rules:read")
    assert not ctx.has_permission("soar:execute")
