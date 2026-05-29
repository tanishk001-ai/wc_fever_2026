import sys
import os

# Resolve backend/ relative to this file so it works in both Vercel's
# /var/task/api/ environment and local development.
_backend_dir = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..', 'backend')
)
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# Import the Flask WSGI app.
# Vercel's Python runtime detects a module-level 'app' WSGI callable automatically.
from app import app  # noqa: F401  (Vercel reads this symbol)
