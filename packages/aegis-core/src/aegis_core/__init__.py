"""aegis_core — shared foundation for every Aegis Python service.

Settings, structured logging, OpenTelemetry tracing, the tenant context, error
types, and the storage / ClickHouse / secrets abstractions. Import from the package
root; submodules are an implementation detail.
"""

from __future__ import annotations

from aegis_core.audit import AuditChain, AuditRecord, audit_chain, compute_hash
from aegis_core.clickhouse import (
    ClickHouseBackend,
    build_tenant_scoped_query,
    get_clickhouse,
)
from aegis_core.context import (
    TenantContext,
    clear_tenant_context,
    current_tenant_id,
    get_tenant_context,
    require_tenant_context,
    reset_tenant_context,
    set_tenant_context,
)
from aegis_core.errors import (
    AegisError,
    AuthError,
    ConfigurationError,
    NotFoundError,
    PermissionDeniedError,
    SecretsError,
    StorageError,
    TenantContextError,
    TenantIsolationError,
)
from aegis_core.federation import federated_search
from aegis_core.logging import configure_logging, get_logger
from aegis_core.opensearch import OpenSearchClient, get_opensearch
from aegis_core.secrets import SecretsBackend, get_secrets
from aegis_core.settings import Settings, get_settings
from aegis_core.storage import LocalStorage, StorageBackend, get_storage
from aegis_core.threatintel import lookup_ioc
from aegis_core.tracing import configure_tracing, get_tracer

__all__ = [
    "AegisError",
    "AuditChain",
    "AuditRecord",
    "AuthError",
    "ClickHouseBackend",
    "audit_chain",
    "compute_hash",
    "ConfigurationError",
    "LocalStorage",
    "NotFoundError",
    "OpenSearchClient",
    "PermissionDeniedError",
    "SecretsBackend",
    "SecretsError",
    "Settings",
    "StorageBackend",
    "StorageError",
    "TenantContext",
    "TenantContextError",
    "TenantIsolationError",
    "build_tenant_scoped_query",
    "clear_tenant_context",
    "configure_logging",
    "configure_tracing",
    "current_tenant_id",
    "federated_search",
    "get_clickhouse",
    "get_logger",
    "get_opensearch",
    "get_secrets",
    "get_settings",
    "get_storage",
    "get_tenant_context",
    "get_tracer",
    "lookup_ioc",
    "require_tenant_context",
    "reset_tenant_context",
    "set_tenant_context",
]
