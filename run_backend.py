"""
Entry point for running the backend server.
This file is used by PyInstaller to properly handle the backend module structure.
"""
import sys
import os

# Add backend directory to Python path
if getattr(sys, 'frozen', False):
    # Running in PyInstaller bundle
    backend_dir = os.path.join(sys._MEIPASS, 'backend')
else:
    # Running in development
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')

sys.path.insert(0, backend_dir)

# Now import and run the app
if __name__ == "__main__":
    import uvicorn
    from config import get_settings
    from main import app  # Import the app directly

    settings = get_settings()

    uvicorn.run(
        app,  # Pass the app object directly instead of string
        host=settings.api_host,
        port=settings.api_port,
        reload=False,  # No reload in production
    )
