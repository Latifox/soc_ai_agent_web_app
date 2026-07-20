"""Hash-chained audit log: chaining, verification, and tamper detection."""

from __future__ import annotations

import dataclasses

from aegis_core.audit import GENESIS, AuditChain


def test_chain_links_and_verifies() -> None:
    chain = AuditChain()
    r1 = chain.record(tenant_id="acme", actor="priya", action="rule.create", target="rule-1")
    r2 = chain.record(tenant_id="acme", actor="argus", actor_type="agent", action="soar.isolate_host")

    assert r1.prev_hash == GENESIS
    assert r2.prev_hash == r1.hash
    assert AuditChain.verify([r1, r2]) is True


def test_tamper_breaks_chain() -> None:
    chain = AuditChain()
    r1 = chain.record(tenant_id="acme", actor="priya", action="rule.create")
    r2 = chain.record(tenant_id="acme", actor="priya", action="rule.delete")

    forged = dataclasses.replace(r1, action="rule.keep")  # mutate a hashed field
    assert AuditChain.verify([forged, r2]) is False


def test_chains_are_per_tenant() -> None:
    chain = AuditChain()
    a = chain.record(tenant_id="acme", actor="x", action="login")
    b = chain.record(tenant_id="other", actor="y", action="login")
    # Each tenant's first record starts from GENESIS independently.
    assert a.prev_hash == GENESIS
    assert b.prev_hash == GENESIS
