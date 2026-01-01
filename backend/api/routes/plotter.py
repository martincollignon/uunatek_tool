"""Plotter control API routes for iDraw 2.0 with DrawCore (GRBL) firmware.

This module provides REST API endpoints for controlling the iDraw 2.0 pen plotter.
The plotter uses GRBL-based DrawCore firmware which accepts G-code commands.
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import asyncio

from core.plotter.connection import PlotterConnection
from core.plotter.grbl_commands import GRBLCommands
from core.plotter.executor import PlotExecutor
from core.plotter.errors import (
    PlotterError,
    ErrorCategory,
    get_user_reported_errors,
    get_errors_by_category,
    get_error_by_code,
)
from core.svg.parser import SVGParser
from core.svg.generator import SVGGenerator
from models.plotter import PlotterStatus, PlotProgress, PlotState, PenState
from api.routes.projects import get_project_by_id
from config import get_settings

router = APIRouter(prefix="/api/plotter", tags=["plotter"])

# Global plotter instances
_connection: Optional[PlotterConnection] = None
_commands: Optional[GRBLCommands] = None
_executor: Optional[PlotExecutor] = None
_current_progress: PlotProgress = PlotProgress()

# WebSocket connections for progress updates
_websocket_clients: list[WebSocket] = []


class PlotRequest(BaseModel):
    """Request to start plotting."""
    project_id: str
    side: str = "front"  # 'front', 'back', 'envelope'


class CalibrationMoveRequest(BaseModel):
    """Request to move to calibration test position."""
    x_mm: float = 50.0
    y_mm: float = 50.0


class TestPatternRequest(BaseModel):
    """Request to draw test pattern."""
    size_mm: float = 10.0


def _get_connection() -> PlotterConnection:
    """Get or create plotter connection."""
    global _connection
    if _connection is None:
        _connection = PlotterConnection()
    return _connection


def _get_commands() -> GRBLCommands:
    """Get or create GRBL commands instance."""
    global _commands, _connection
    if _commands is None:
        _commands = GRBLCommands(_get_connection())
    return _commands


@router.get("/ports")
async def list_ports(compatible_only: bool = True):
    """
    List available serial ports.

    Args:
        compatible_only: If True, only return plotter-compatible ports (default: True)
    """
    ports = PlotterConnection.list_available_ports()

    if compatible_only:
        ports = [p for p in ports if p["is_compatible"]]

    return {"ports": ports}


@router.get("/status", response_model=PlotterStatus)
async def get_status():
    """Get plotter connection status."""
    conn = _get_connection()

    status = PlotterStatus(
        is_connected=conn.is_connected,
        port=conn.port_name,
    )

    if conn.is_connected:
        cmd = _get_commands()
        try:
            version = await cmd.get_version()
            status.firmware_version = version
            status.pen_state = cmd.pen_state
        except PlotterError as e:
            # If device is disconnected, update status
            if e.code == "PLT-C004":
                status.is_connected = False
                status.port = None
        except Exception:
            # For any other error during status check, verify connection is still valid
            # by checking if serial port is truly open
            if not conn.is_connected:
                status.is_connected = False
                status.port = None

    return status


@router.post("/connect")
async def connect(port: Optional[str] = None):
    """Connect to plotter."""
    conn = _get_connection()

    # Validate port if provided
    if port:
        available_ports = PlotterConnection.list_available_ports()
        port_info = next((p for p in available_ports if p["device"] == port), None)

        if not port_info:
            raise HTTPException(
                status_code=400,
                detail=f"Port not found: {port}"
            )

        if not port_info["is_compatible"]:
            raise HTTPException(
                status_code=400,
                detail=f"Port {port} is not compatible with plotter. Please select a compatible device from the list."
            )

    try:
        await conn.connect(port)
        cmd = _get_commands()

        # Initialize GRBL mode (G21 mm units, G90 absolute positioning)
        await cmd.initialize()

        # Enable motors and raise pen
        await cmd.enable_motors()
        await cmd.pen_up()

        return {
            "status": "connected",
            "port": conn.port_name,
        }
    except PlotterError as e:
        return JSONResponse(
            status_code=400,
            content={"error": e.to_dict()}
        )
    except ConnectionError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/disconnect")
async def disconnect():
    """Disconnect from plotter."""
    global _connection, _commands, _executor

    if _connection:
        await _connection.disconnect()

    return {"status": "disconnected"}


@router.post("/home")
async def home():
    """Home the plotter."""
    cmd = _get_commands()

    if not _connection or not _connection.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to plotter")

    try:
        await cmd.home()
        return {"status": "homed"}
    except PlotterError as e:
        return JSONResponse(
            status_code=400,
            content={"error": e.to_dict()}
        )


@router.post("/pen/up")
async def pen_up():
    """Raise the pen."""
    cmd = _get_commands()

    if not _connection or not _connection.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to plotter")

    try:
        await cmd.pen_up()
        return {"status": "pen_up"}
    except PlotterError as e:
        return JSONResponse(
            status_code=400,
            content={"error": e.to_dict()}
        )


@router.post("/pen/down")
async def pen_down():
    """Lower the pen."""
    cmd = _get_commands()

    if not _connection or not _connection.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to plotter")

    try:
        await cmd.pen_down()
        return {"status": "pen_down"}
    except PlotterError as e:
        return JSONResponse(
            status_code=400,
            content={"error": e.to_dict()}
        )


@router.post("/motors/enable")
async def enable_motors():
    """Enable motors."""
    cmd = _get_commands()

    if not _connection or not _connection.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to plotter")

    try:
        await cmd.enable_motors()
        return {"status": "motors_enabled"}
    except PlotterError as e:
        return JSONResponse(
            status_code=400,
            content={"error": e.to_dict()}
        )


@router.post("/motors/disable")
async def disable_motors():
    """Disable motors (allows manual movement)."""
    cmd = _get_commands()

    if not _connection or not _connection.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to plotter")

    try:
        await cmd.disable_motors()
        return {"status": "motors_disabled"}
    except PlotterError as e:
        return JSONResponse(
            status_code=400,
            content={"error": e.to_dict()}
        )


@router.post("/plot/start")
async def start_plot(request: PlotRequest):
    """
    Start plotting a project.

    COMPLETE PIPELINE FLOW:
    ========================
    1. Canvas State (Fabric.js JSON):
       - Retrieved from project database
       - Contains all canvas objects with pixel coordinates (3 pixels/mm)
       - Includes canvas-boundary object (for visual reference only)

    2. SVG Generation (SVGGenerator):
       - Converts Fabric.js JSON → SVG document
       - Parameters:
         * vectorize_images=True: Converts raster images to plottable vector paths
         * include_boundary=False: Excludes canvas-boundary from output (visual guide only)
       - Applies coordinate conversion: pixels → millimeters
       - Handles transforms (position, rotation, scale)
       - Output: SVG string with all plottable elements

    3. SVG Parsing (SVGParser):
       - Parses SVG elements (path, line, rect, circle, etc.)
       - Converts to PlotCommand objects: move, line, pen_up, pen_down
       - Coordinates are in millimeters
       - Output: List of PlotCommand objects

    4. Plot Execution (PlotExecutor):
       - Converts PlotCommands → EBB hardware commands
       - Handles motion planning and speed control
       - Sends serial commands to plotter hardware
       - Provides progress updates via WebSocket
       - Output: Physical drawing on paper

    BOUNDARY HANDLING:
    ==================
    - Canvas boundary is a visual guide showing printable area in the UI
    - MUST NOT be plotted (wastes time, ink, and may damage plotter)
    - Handled by include_boundary parameter:
      * Preview export (canvas.py): include_boundary=True (shows boundary)
      * Plot generation (plotter.py): include_boundary=False (excludes boundary)

    IMAGE HANDLING:
    ===============
    - Raster images cannot be plotted directly
    - vectorize_images=True automatically converts images to vector paths
    - Uses ImageVectorizer with Potrace algorithm
    - Fallback: If vectorization fails, excludes image from plot
    """
    global _executor, _current_progress

    if not _connection or not _connection.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to plotter")

    project = get_project_by_id(request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get canvas data
    if request.side == "front":
        canvas_json = project.canvas_front
    elif request.side == "back":
        canvas_json = project.canvas_back
    elif request.side == "envelope":
        canvas_json = project.canvas_envelope
    else:
        raise HTTPException(status_code=400, detail="Invalid side")

    if not canvas_json:
        raise HTTPException(status_code=400, detail=f"No canvas data for {request.side}")

    # Generate SVG from canvas for plotting:
    # - vectorize_images=True: Convert raster images to vector paths
    # - include_boundary=False: Exclude canvas boundary (visual guide only, should not be plotted)
    # - safety_margin_mm: Clip content to stay within safe area (prevents pen catching paper edge)
    settings = get_settings()
    generator = SVGGenerator(
        project.width_mm,
        project.height_mm,
        vectorize_images=True,
        include_boundary=False,
        safety_margin_mm=settings.safety_margin_mm
    )
    svg_content = generator.generate(canvas_json)

    # Parse SVG to plot commands
    parser = SVGParser()
    plot_commands = parser.parse(svg_content)

    if not plot_commands:
        # Check if canvas has only images (not plottable)
        has_images = any(obj.get("type") == "image" for obj in canvas_json.get("objects", []))
        if has_images:
            raise HTTPException(
                status_code=400,
                detail="Canvas contains only raster images which cannot be plotted. Please add vector elements (text, shapes, or paths) to plot."
            )
        raise HTTPException(status_code=400, detail="No plottable content found. Please add shapes, text, or paths to the canvas.")

    # Create executor with canvas dimensions for coordinate transformation
    cmd = _get_commands()
    _executor = PlotExecutor(
        cmd,
        canvas_width_mm=project.width_mm,
        canvas_height_mm=project.height_mm
    )

    # Progress callback
    async def update_progress(progress: PlotProgress):
        global _current_progress
        _current_progress = progress
        await _broadcast_progress(progress)

    # Start plotting in background
    asyncio.create_task(_run_plot(plot_commands, update_progress, request.side))

    return {"status": "started", "total_commands": len(plot_commands)}


async def _run_plot(plot_commands, progress_callback, side: str):
    """Run plot in background task."""
    global _executor, _current_progress

    try:
        _current_progress = PlotProgress(state=PlotState.PLOTTING, current_side=side)
        await _broadcast_progress(_current_progress)

        success = await _executor.execute(
            plot_commands,
            progress_callback=progress_callback,
            side=side,
        )

        if success:
            _current_progress = PlotProgress(
                state=PlotState.COMPLETED,
                percentage=100.0,
                current_side=side,
            )
        else:
            _current_progress = PlotProgress(
                state=PlotState.CANCELLED,
                current_side=side,
            )

    except PlotterError as e:
        # Structured error with code and remediation
        _current_progress = PlotProgress(
            state=PlotState.ERROR,
            error_message=str(e),
            error_code=e.code,
            current_side=side,
            current_command=e.context.get("command_index", 0),
            total_commands=e.context.get("total_commands", 0),
        )
        # Also broadcast the full error details
        await _broadcast_error(e)

    except Exception as e:
        _current_progress = PlotProgress(
            state=PlotState.ERROR,
            error_message=str(e),
            current_side=side,
        )

    await _broadcast_progress(_current_progress)


async def _broadcast_error(error: PlotterError):
    """Broadcast error details to all WebSocket clients."""
    error_data = {
        "type": "error",
        "error": error.to_dict()
    }
    disconnected = []

    for client in _websocket_clients:
        try:
            await client.send_json(error_data)
        except Exception:
            disconnected.append(client)

    for client in disconnected:
        if client in _websocket_clients:
            _websocket_clients.remove(client)


@router.post("/plot/pause")
async def pause_plot():
    """Pause current plot."""
    global _executor

    if _executor:
        _executor.pause()
        return {"status": "paused"}

    raise HTTPException(status_code=400, detail="No plot in progress")


@router.post("/plot/resume")
async def resume_plot():
    """Resume paused plot."""
    global _executor

    if _executor:
        _executor.resume()
        return {"status": "resumed"}

    raise HTTPException(status_code=400, detail="No plot in progress")


@router.post("/plot/cancel")
async def cancel_plot():
    """Cancel current plot."""
    global _executor

    if _executor:
        _executor.cancel()
        return {"status": "cancelled"}

    raise HTTPException(status_code=400, detail="No plot in progress")


@router.get("/plot/status", response_model=PlotProgress)
async def get_plot_status():
    """Get current plot progress."""
    return _current_progress


# WebSocket for real-time updates
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time plotter status."""
    await websocket.accept()
    _websocket_clients.append(websocket)

    try:
        # Send current status immediately
        await websocket.send_json(_current_progress.model_dump())

        # Keep connection alive and handle messages
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                # Handle ping/pong or other messages
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send heartbeat
                await websocket.send_text("heartbeat")

    except WebSocketDisconnect:
        pass
    finally:
        if websocket in _websocket_clients:
            _websocket_clients.remove(websocket)


async def _broadcast_progress(progress: PlotProgress):
    """Broadcast progress to all WebSocket clients."""
    disconnected = []

    for client in _websocket_clients:
        try:
            await client.send_json(progress.model_dump())
        except Exception:
            disconnected.append(client)

    for client in disconnected:
        if client in _websocket_clients:
            _websocket_clients.remove(client)


# ============= Calibration Endpoints =============

@router.post("/calibration/move-to-test-position")
async def move_to_test_position(request: CalibrationMoveRequest = None):
    """
    Move pen to a safe test position for calibration.
    Ensures pen is up before moving.
    """
    if not _connection or not _connection.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to plotter")

    cmd = _get_commands()

    try:
        # Safety: ensure pen is up before moving
        await cmd.pen_up()

        # Move to test position
        x = request.x_mm if request else 50.0
        y = request.y_mm if request else 50.0
        await cmd.move_to_position(x, y)

        return {"status": "moved", "position": {"x_mm": x, "y_mm": y}}
    except Exception as e:
        # Safety: pen up on error
        try:
            await cmd.pen_up()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/calibration/draw-test-pattern")
async def draw_test_pattern(request: TestPatternRequest = None):
    """
    Draw a small test pattern to verify pen contact.
    Pattern: 10mm square with X diagonals.
    """
    if not _connection or not _connection.is_connected:
        raise HTTPException(status_code=400, detail="Not connected to plotter")

    cmd = _get_commands()

    try:
        size = request.size_mm if request else 10.0
        await cmd.draw_test_pattern(size)

        return {"status": "completed", "pattern_size_mm": size}
    except PlotterError as e:
        # Safety: pen up on error
        try:
            await cmd.pen_up()
        except Exception:
            pass
        return JSONResponse(
            status_code=400,
            content={"error": e.to_dict()}
        )
    except Exception as e:
        # Safety: pen up on error
        try:
            await cmd.pen_up()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


# ============= Error Reporting Endpoints =============

class ReportProblemRequest(BaseModel):
    """Request to report a user-observed problem."""
    error_code: str
    context: Optional[dict] = None


@router.get("/errors/user-reportable")
async def get_user_reportable_errors():
    """Get list of errors that can be user-reported (not auto-detected)."""
    errors = get_user_reported_errors()
    return {
        "errors": [
            {
                "code": e.code,
                "name": e.name,
                "message": e.message,
                "category": e.category.value,
            }
            for e in errors
        ]
    }


@router.get("/errors/by-category/{category}")
async def get_errors_by_category_endpoint(category: str):
    """Get all errors in a specific category."""
    try:
        cat = ErrorCategory(category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

    errors = get_errors_by_category(cat)
    return {
        "category": category,
        "errors": [
            {
                "code": e.code,
                "name": e.name,
                "message": e.message,
                "detail": e.detail,
                "severity": e.severity.value,
                "remediation_steps": e.remediation_steps,
                "recovery_actions": [a.value for a in e.recovery_actions],
                "is_auto_detected": e.is_auto_detected,
            }
            for e in errors
        ]
    }


@router.get("/errors/{error_code}")
async def get_error_details(error_code: str):
    """Get full details for a specific error code."""
    error_def = get_error_by_code(error_code)
    if not error_def:
        raise HTTPException(status_code=404, detail=f"Error code not found: {error_code}")

    return {
        "code": error_def.code,
        "name": error_def.name,
        "message": error_def.message,
        "detail": error_def.detail,
        "severity": error_def.severity.value,
        "category": error_def.category.value,
        "remediation_steps": error_def.remediation_steps,
        "recovery_actions": [a.value for a in error_def.recovery_actions],
        "is_auto_detected": error_def.is_auto_detected,
    }


@router.post("/report-problem")
async def report_problem(request: ReportProblemRequest):
    """
    Report a user-observed problem.
    This is for issues the hardware cannot detect (ink empty, paper shifted, etc.).
    """
    global _current_progress, _executor

    error_def = get_error_by_code(request.error_code)
    if not error_def:
        raise HTTPException(status_code=400, detail=f"Unknown error code: {request.error_code}")

    if error_def.is_auto_detected:
        raise HTTPException(
            status_code=400,
            detail=f"Error {request.error_code} is auto-detected and cannot be user-reported"
        )

    # Pause plot if one is in progress
    if _executor and not _executor.is_paused:
        _executor.pause()

    # Create and broadcast error
    error = PlotterError(request.error_code, context=request.context or {})
    await _broadcast_error(error)

    # Update progress with error info
    _current_progress = PlotProgress(
        state=PlotState.PAUSED,
        error_message=error_def.message,
        error_code=request.error_code,
        current_side=_current_progress.current_side,
        current_command=_current_progress.current_command,
        total_commands=_current_progress.total_commands,
    )
    await _broadcast_progress(_current_progress)

    return {
        "status": "reported",
        "error": error.to_dict(),
    }


@router.post("/recovery/{action}")
async def execute_recovery_action(action: str):
    """Execute a recovery action."""
    global _executor, _current_progress

    cmd = _get_commands()

    try:
        if action == "retry":
            # Just clear error state - user can retry the operation
            _current_progress = PlotProgress(state=PlotState.IDLE)
            return {"status": "ready_for_retry"}

        elif action == "reconnect":
            await _connection.disconnect()
            await asyncio.sleep(2)
            await _connection.connect()
            return {"status": "reconnected"}

        elif action == "home":
            await cmd.home()
            return {"status": "homed"}

        elif action == "emergency_stop":
            await cmd.emergency_stop()
            if _executor:
                _executor.cancel()
            _current_progress = PlotProgress(state=PlotState.CANCELLED)
            return {"status": "stopped"}

        elif action == "pen_up":
            await cmd.pen_up()
            return {"status": "pen_raised"}

        elif action == "disable_motors":
            await cmd.disable_motors()
            return {"status": "motors_disabled"}

        elif action == "resume":
            if _executor:
                _executor.resume()
                return {"status": "resumed"}
            raise HTTPException(status_code=400, detail="No plot to resume")

        elif action == "abort":
            if _executor:
                _executor.cancel()
            await cmd.pen_up()
            await cmd.disable_motors()
            _current_progress = PlotProgress(state=PlotState.CANCELLED)
            return {"status": "aborted"}

        else:
            raise HTTPException(status_code=400, detail=f"Unknown recovery action: {action}")

    except PlotterError as e:
        return JSONResponse(
            status_code=400,
            content={"error": e.to_dict()}
        )
