# -*- mode: python ; coding: utf-8 -*-

import sys
from pathlib import Path

# Get the backend directory
backend_dir = Path('backend')

# Analysis of the main module - use run_backend.py as entry point
a = Analysis(
    ['run_backend.py'],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[
        # Include the built frontend dist folder
        ('frontend/dist', 'frontend/dist'),
        # Include the entire backend directory for imports
        ('backend', 'backend'),
    ],
    hiddenimports=[
        # Backend modules
        'backend',
        'backend.main',
        'backend.config',
        'backend.api',
        'backend.api.routes',
        'backend.core',
        'backend.models',
        'backend.services',
        # Uvicorn
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # Google GenAI and ALL submodules
        'google',
        'google.genai',
        'google.genai.types',
        'google.genai.client',
        'google.genai._api_client',
        'google.genai.models',
        'google.genai._extra_utils',
        'google.genai.chats',
        'google.genai.errors',
        'google.genai.pagers',
        'google.genai.protos',
        'google.auth',
        'google.auth.transport',
        'google.auth.transport.requests',
        'google.auth._default',
        # Note: google.api_core and google.protobuf are not required by google-genai
        # HTTP clients
        'httpx',
        'httpx._transports',
        'httpx._transports.default',
        'httpcore',
        'httpcore._async',
        'httpcore._sync',
        'httpcore._backends',
        'httpcore._backends.sync',
        'httpcore._backends.anyio',
        # PIL and image processing (complete)
        'PIL',
        'PIL._imaging',
        'PIL.Image',
        'PIL.ImageFile',
        'PIL.ImageOps',
        'PIL.ImageDraw',
        'PIL.ImageFont',
        'PIL.PngImagePlugin',
        'PIL.JpegImagePlugin',
        'cairosvg',
        # Note: numpy is not a direct dependency, only used if available
        # Websockets
        'websockets',
        # Pydantic
        'pydantic',
        'pydantic_core',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='plotter-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # No console window on macOS
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='plotter-backend',
)
