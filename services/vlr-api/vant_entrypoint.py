"""Replit entrypoint that loads the pinned upstream VLR application."""

import os
import sys
from pathlib import Path


upstream_dir = Path(os.environ.get("VANT_VLR_UPSTREAM_DIR", ".replit-vlr-upstream")).resolve()
if upstream_dir.is_dir():
    sys.path.insert(0, str(upstream_dir))

from main import app as upstream_app  # noqa: E402
from vant_overlay import apply  # noqa: E402

app = apply(upstream_app)