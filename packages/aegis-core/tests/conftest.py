"""Make ``aegis_core`` importable when the package is not pip-installed.

Adds ``packages/aegis-core/src`` to ``sys.path`` so ``python -m pytest`` works from
the repo root without a prior ``uv sync`` / editable install.
"""

from __future__ import annotations

import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))
