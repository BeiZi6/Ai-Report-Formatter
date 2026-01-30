from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APPS_FORMATTER = ROOT / "apps" / "formatter"
if str(APPS_FORMATTER) not in sys.path:
    sys.path.insert(0, str(APPS_FORMATTER))
