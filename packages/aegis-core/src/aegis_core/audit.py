"""Immutable, hash-chained audit log (SEC-02).

Each record's ``hash = sha256(prev_hash + canonical(payload))`` so any later tampering
breaks the chain and :func:`AuditChain.verify` detects it. This is the in-process core;
a durable sink persists records into the Supabase ``audit_log`` table using the same
``prev_hash`` / ``hash`` columns. Chains are per-tenant.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import RLock
from typing import Any

GENESIS = "0" * 64


@dataclass(frozen=True, slots=True)
class AuditRecord:
    """One append-only, hash-chained audit entry."""

    tenant_id: str
    actor: str
    actor_type: str
    action: str
    target: str | None
    meta: dict[str, Any]
    ts: str
    prev_hash: str
    hash: str

    def payload(self) -> dict[str, Any]:
        """The hashed fields (everything except prev_hash/hash)."""
        return {
            "tenant_id": self.tenant_id,
            "actor": self.actor,
            "actor_type": self.actor_type,
            "action": self.action,
            "target": self.target,
            "meta": self.meta,
            "ts": self.ts,
        }


def _canonical(payload: dict[str, Any]) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


def compute_hash(prev_hash: str, payload: dict[str, Any]) -> str:
    """Chain hash for ``payload`` following ``prev_hash``."""
    return hashlib.sha256((prev_hash + _canonical(payload)).encode("utf-8")).hexdigest()


class AuditChain:
    """Per-tenant append-only hash chain (thread-safe)."""

    def __init__(self) -> None:
        self._last: dict[str, str] = {}
        self._lock = RLock()

    def record(
        self,
        *,
        tenant_id: str,
        actor: str,
        action: str,
        actor_type: str = "user",
        target: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> AuditRecord:
        """Append a record to the tenant's chain and return it."""
        with self._lock:
            prev = self._last.get(tenant_id, GENESIS)
            payload = {
                "tenant_id": tenant_id,
                "actor": actor,
                "actor_type": actor_type,
                "action": action,
                "target": target,
                "meta": meta or {},
                "ts": datetime.now(UTC).isoformat(),
            }
            digest = compute_hash(prev, payload)
            self._last[tenant_id] = digest
            return AuditRecord(**payload, prev_hash=prev, hash=digest)

    @staticmethod
    def verify(records: list[AuditRecord]) -> bool:
        """Return True iff ``records`` form an unbroken chain from GENESIS (single tenant)."""
        prev = GENESIS
        for rec in records:
            if rec.prev_hash != prev or rec.hash != compute_hash(prev, rec.payload()):
                return False
            prev = rec.hash
        return True


audit_chain = AuditChain()
"""Process-wide audit chain. Services also persist records to the durable sink."""
