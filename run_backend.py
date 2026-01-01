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
    import logging
    from config import get_settings
    from main import app  # Import the app directly

    settings = get_settings()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Parse command line arguments for dynamic port
    port = settings.api_port
    host = settings.api_host

    for i, arg in enumerate(sys.argv):
        if arg == '--port' and i + 1 < len(sys.argv):
            try:
                port = int(sys.argv[i + 1])
                logging.info(f"Using port from command line: {port}")
            except ValueError:
                logging.error(f"Invalid port number: {sys.argv[i + 1]}")
        elif arg == '--host' and i + 1 < len(sys.argv):
            host = sys.argv[i + 1]
            logging.info(f"Using host from command line: {host}")

    logging.info(f"Starting backend server on {host}:{port}")

    uvicorn.run(
        app,  # Pass the app object directly instead of string
        host=host,
        port=port,
        reload=False,  # No reload in production
    )
