"""Plotter error taxonomy and exception handling for iDraw 2.0.

Based on analysis of actual EBB firmware capabilities and AxiDraw driver code.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Optional


class ErrorSeverity(str, Enum):
    """Severity levels for plotter errors."""
    CRITICAL = "critical"  # Immediate attention required, cannot continue
    ERROR = "error"        # Operation failed, recovery needed
    WARNING = "warning"    # Degraded operation, can continue with caution
    INFO = "info"          # Informational, user action optional


class ErrorCategory(str, Enum):
    """Categories of plotter errors."""
    CONNECTION = "connection"      # USB/serial connection issues
    POWER = "power"               # Power supply issues
    COMMUNICATION = "communication"  # Command/response issues
    MOTION = "motion"             # Movement/positioning issues
    USER_INPUT = "user_input"     # Physical button presses
    PEN = "pen"                   # Pen-related issues (user-reported)
    PAPER = "paper"               # Paper-related issues (user-reported)
    QUALITY = "quality"           # Output quality issues (user-reported)


class RecoveryAction(str, Enum):
    """Available recovery actions for errors."""
    RETRY = "retry"              # Re-attempt the failed operation
    RECONNECT = "reconnect"      # Close port, wait, reconnect
    HOME = "home"                # Send homing command
    EMERGENCY_STOP = "emergency_stop"  # Halt all motion
    PEN_UP = "pen_up"            # Raise pen for safety
    DISABLE_MOTORS = "disable_motors"  # Allow manual carriage movement
    USER_FIX = "user_fix"        # Wait for user to fix issue
    ABORT = "abort"              # Cancel current operation
    RESUME = "resume"            # Resume paused operation


@dataclass
class ErrorDefinition:
    """Definition of a specific error type."""
    code: str
    name: str
    message: str
    detail: str
    severity: ErrorSeverity
    category: ErrorCategory
    remediation_steps: list[str]
    recovery_actions: list[RecoveryAction]
    is_auto_detected: bool = True  # False for user-reported issues


# Error Registry - All defined plotter errors
ERROR_REGISTRY: dict[str, ErrorDefinition] = {}


def _register(error_def: ErrorDefinition) -> ErrorDefinition:
    """Register an error definition."""
    ERROR_REGISTRY[error_def.code] = error_def
    return error_def


# ============= Connection Errors (PLT-C) =============

PLT_C001 = _register(ErrorDefinition(
    code="PLT-C001",
    name="No Device Found",
    message="No compatible plotter found",
    detail="Could not find an iDraw/AxiDraw device on any USB port. The CH340 or EBB device was not detected.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.CONNECTION,
    remediation_steps=[
        "Check that the USB cable is securely connected to both the plotter and computer",
        "Ensure the plotter is powered on (green power LED should be lit)",
        "Try a different USB port or USB cable",
        "On macOS: System Settings → General → System Information → USB to verify device appears",
        "Install CH340 driver from the included driver folder if not already installed",
    ],
    recovery_actions=[RecoveryAction.RETRY],
))

PLT_C002 = _register(ErrorDefinition(
    code="PLT-C002",
    name="Port In Use",
    message="Serial port is in use by another application",
    detail="The serial port for the plotter is already open in another application.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.CONNECTION,
    remediation_steps=[
        "Close any other applications that might be using the plotter (Inkscape, AxiDraw software, etc.)",
        "Check for any terminal windows with open serial connections",
        "If the problem persists, try unplugging and reconnecting the USB cable",
    ],
    recovery_actions=[RecoveryAction.RETRY],
))

PLT_C003 = _register(ErrorDefinition(
    code="PLT-C003",
    name="Permission Denied",
    message="Permission denied accessing serial port",
    detail="The operating system denied access to the serial port.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.CONNECTION,
    remediation_steps=[
        "On macOS/Linux: You may need to add your user to the 'dialout' group",
        "Try running the application with administrator privileges",
        "Check that no other application has exclusive access to the port",
    ],
    recovery_actions=[RecoveryAction.RETRY],
))

PLT_C004 = _register(ErrorDefinition(
    code="PLT-C004",
    name="Device Disconnected",
    message="USB connection lost during operation",
    detail="The plotter was unexpectedly disconnected while a command was in progress. Error code -104.",
    severity=ErrorSeverity.CRITICAL,
    category=ErrorCategory.CONNECTION,
    remediation_steps=[
        "The USB connection was lost during plotting",
        "Check the USB cable immediately - it may have come loose",
        "Do NOT move the pen carriage by hand - the position will be lost",
        "Reconnect and click 'Home' to reset the position",
        "You may need to restart the current plot from the beginning",
    ],
    recovery_actions=[RecoveryAction.RECONNECT, RecoveryAction.HOME, RecoveryAction.ABORT],
))

PLT_C005 = _register(ErrorDefinition(
    code="PLT-C005",
    name="Device Not Responding",
    message="Plotter connected but not responding",
    detail="The USB device is detected but the firmware is not responding to commands. The plotter may be powered off.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.CONNECTION,
    remediation_steps=[
        "Check that the plotter's 12V power supply is connected",
        "The green power LED on the board should be lit",
        "Try power cycling the plotter (unplug power, wait 5 seconds, reconnect)",
        "USB alone cannot power the plotter - external power is required",
    ],
    recovery_actions=[RecoveryAction.RETRY, RecoveryAction.RECONNECT],
))

# ============= Power Errors (PLT-W) =============

PLT_W001 = _register(ErrorDefinition(
    code="PLT-W001",
    name="Low Voltage",
    message="Low voltage detected - power supply issue",
    detail="The plotter detected insufficient voltage. The power supply may not be connected or is failing.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.POWER,
    remediation_steps=[
        "The power supply is not connected or not providing sufficient power",
        "Check that the 12V power adapter is plugged into both the wall and the plotter",
        "The green power LED on the board should be lit",
        "USB power alone is not sufficient to operate the motors",
        "If power is connected, try a different power adapter or outlet",
    ],
    recovery_actions=[RecoveryAction.RETRY, RecoveryAction.ABORT],
))

# ============= Communication Errors (PLT-X) =============

PLT_X001 = _register(ErrorDefinition(
    code="PLT-X001",
    name="Response Timeout",
    message="Plotter did not respond in time",
    detail="No response received from the plotter within the timeout period (5 seconds).",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.COMMUNICATION,
    remediation_steps=[
        "The plotter did not respond to a command within 5 seconds",
        "Check that the plotter is still powered on",
        "The plotter may be busy - wait a moment and try again",
        "If the problem persists, disconnect and reconnect",
    ],
    recovery_actions=[RecoveryAction.RETRY, RecoveryAction.RECONNECT],
))

PLT_X002 = _register(ErrorDefinition(
    code="PLT-X002",
    name="Invalid Response",
    message="Unexpected response from plotter",
    detail="The plotter returned a response that could not be parsed or was unexpected.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.COMMUNICATION,
    remediation_steps=[
        "The plotter returned an unexpected response",
        "This may indicate a firmware compatibility issue",
        "Try power cycling the plotter",
        "Check if the plotter firmware needs updating",
    ],
    recovery_actions=[RecoveryAction.RETRY, RecoveryAction.RECONNECT],
))

PLT_X003 = _register(ErrorDefinition(
    code="PLT-X003",
    name="Command Rejected",
    message="Command rejected by plotter",
    detail="The plotter firmware rejected the command.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.COMMUNICATION,
    remediation_steps=[
        "The plotter rejected a command",
        "This may indicate invalid parameters or firmware limitations",
        "Try the operation again",
        "If the problem persists, try restarting the plotter",
    ],
    recovery_actions=[RecoveryAction.RETRY],
))

# ============= Motion Errors (PLT-M) =============

PLT_M001 = _register(ErrorDefinition(
    code="PLT-M001",
    name="Homing Failed",
    message="Failed to find home position",
    detail="The plotter could not complete the homing sequence. The limit switches may not have been triggered.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.MOTION,
    remediation_steps=[
        "The plotter could not find its home position",
        "Check that nothing is blocking the pen carriage movement",
        "Ensure the contact/limit switches at the home corner are not obstructed",
        "Try manually moving the carriage away from corners, then retry",
    ],
    recovery_actions=[RecoveryAction.RETRY, RecoveryAction.DISABLE_MOTORS],
))

PLT_M002 = _register(ErrorDefinition(
    code="PLT-M002",
    name="Motion Timeout",
    message="Motion command took too long",
    detail="A motion command did not complete within the expected time.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.MOTION,
    remediation_steps=[
        "A movement took longer than expected to complete",
        "Check that nothing is blocking the carriage movement",
        "The motors may have stalled - check belt tension",
        "Try homing the plotter to reset position tracking",
    ],
    recovery_actions=[RecoveryAction.HOME, RecoveryAction.ABORT],
))

PLT_M003 = _register(ErrorDefinition(
    code="PLT-M003",
    name="Bounds Exceeded",
    message="Movement exceeds plotter boundaries",
    detail="The requested movement would exceed the plotter's physical travel limits.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.MOTION,
    remediation_steps=[
        "The plot extends beyond the plotter's physical travel limits",
        "Check that the correct iDraw model is selected (A4/A3)",
        "The drawing may be too large for the plotting area",
        "Try scaling down your design or repositioning it",
    ],
    recovery_actions=[RecoveryAction.ABORT],
))

# ============= User Input (PLT-U) =============

PLT_U001 = _register(ErrorDefinition(
    code="PLT-U001",
    name="Pause Button Pressed",
    message="Physical pause button pressed on plotter",
    detail="The PAUSE button on the plotter's main board was pressed. Error code -102.",
    severity=ErrorSeverity.INFO,
    category=ErrorCategory.USER_INPUT,
    remediation_steps=[
        "The physical PAUSE button on the plotter was pressed",
        "The plot has been paused - your progress is saved",
        "Make any needed adjustments (paper, pen, etc.)",
        "Click 'Resume' to continue from where you left off",
    ],
    recovery_actions=[RecoveryAction.RESUME, RecoveryAction.ABORT],
))

# ============= User-Reported: Pen Issues (PLT-P) =============

PLT_P001 = _register(ErrorDefinition(
    code="PLT-P001",
    name="Pen Not Drawing",
    message="Pen is not making marks on paper",
    detail="The pen is not leaving ink on the paper when lowered.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.PEN,
    is_auto_detected=False,
    remediation_steps=[
        "Check if the pen has ink by drawing on scrap paper manually",
        "Run the Calibration Wizard to adjust pen height",
        "Ensure pen-to-paper gap is 3-5mm when pen is UP (per manual)",
        "The pen may need to be pressed slightly into the paper when DOWN",
        "Try a different pen if available",
    ],
    recovery_actions=[RecoveryAction.USER_FIX, RecoveryAction.ABORT],
))

PLT_P002 = _register(ErrorDefinition(
    code="PLT-P002",
    name="Lines Too Faint",
    message="Pen lines are too light or inconsistent",
    detail="The pen is making contact but lines are too faint or broken.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.PEN,
    is_auto_detected=False,
    remediation_steps=[
        "The pen may be too high above the paper",
        "Run the Calibration Wizard to lower the pen slightly",
        "Check that paper is flat and not curled",
        "Some pens need to be 'broken in' - try drawing manually first",
    ],
    recovery_actions=[RecoveryAction.USER_FIX, RecoveryAction.ABORT],
))

PLT_P003 = _register(ErrorDefinition(
    code="PLT-P003",
    name="Lines Too Thick",
    message="Pen is pressing too hard, lines are smeared",
    detail="The pen is pressing too hard into the paper causing thick or smeared lines.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.PEN,
    is_auto_detected=False,
    remediation_steps=[
        "The pen is pressing too hard into the paper",
        "Run the Calibration Wizard to raise the pen slightly",
        "Loosen the thumbscrew and raise the pen 1-2mm",
        "Some paper types are more susceptible to this",
    ],
    recovery_actions=[RecoveryAction.USER_FIX, RecoveryAction.ABORT],
))

PLT_P004 = _register(ErrorDefinition(
    code="PLT-P004",
    name="Pen Not Installed",
    message="No pen detected in holder",
    detail="The pen holder appears to be empty.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.PEN,
    is_auto_detected=False,
    remediation_steps=[
        "Install a pen in the pen holder",
        "Ensure the pen is secured with the thumbscrew",
        "Run the Calibration Wizard to set pen height",
    ],
    recovery_actions=[RecoveryAction.USER_FIX],
))

# ============= User-Reported: Paper Issues (PLT-S) =============

PLT_S001 = _register(ErrorDefinition(
    code="PLT-S001",
    name="Paper Shifted",
    message="Paper has moved during plotting",
    detail="The paper appears to have shifted from its original position.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.PAPER,
    is_auto_detected=False,
    remediation_steps=[
        "The paper may have moved during plotting",
        "Secure paper with tape or clamps on all corners",
        "The current plot cannot be resumed accurately",
        "Consider using heavier paper stock",
    ],
    recovery_actions=[RecoveryAction.ABORT],
))

PLT_S002 = _register(ErrorDefinition(
    code="PLT-S002",
    name="Beyond Paper Edge",
    message="Plot extends beyond paper boundaries",
    detail="The drawing extends past the edge of the paper.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.PAPER,
    is_auto_detected=False,
    remediation_steps=[
        "The plot extends beyond the paper edges",
        "Use larger paper or scale down the design",
        "Reposition the paper to center the design",
        "Check the page margins in your design",
    ],
    recovery_actions=[RecoveryAction.ABORT],
))

PLT_S003 = _register(ErrorDefinition(
    code="PLT-S003",
    name="Paper Damaged",
    message="Paper is wrinkled or damaged",
    detail="The paper has become wrinkled, torn, or otherwise damaged.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.PAPER,
    is_auto_detected=False,
    remediation_steps=[
        "The paper has been damaged",
        "Replace with fresh paper",
        "Ensure paper is flat before starting",
        "Check that pen pressure is not too high",
    ],
    recovery_actions=[RecoveryAction.ABORT],
))

# ============= User-Reported: Quality Issues (PLT-Q) =============

PLT_Q001 = _register(ErrorDefinition(
    code="PLT-Q001",
    name="Misaligned Output",
    message="Output is skewed or misaligned",
    detail="The plotted output appears skewed or offset from expected position.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.QUALITY,
    is_auto_detected=False,
    remediation_steps=[
        "The output may be misaligned due to lost steps",
        "Check belt tension - belts should be taut but not overly tight",
        "Ensure smooth carriage movement with motors disabled",
        "Home the plotter and try plotting a test pattern",
        "Reduce plotting speed if skipping persists",
    ],
    recovery_actions=[RecoveryAction.HOME, RecoveryAction.ABORT],
))

PLT_Q002 = _register(ErrorDefinition(
    code="PLT-Q002",
    name="Missing Sections",
    message="Parts of the drawing are missing",
    detail="Some sections of the drawing were not plotted.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.QUALITY,
    is_auto_detected=False,
    remediation_steps=[
        "Some parts of the design did not plot",
        "Check if the pen ran out of ink during plotting",
        "Verify the source design is complete",
        "The plot may have been interrupted - check for errors",
    ],
    recovery_actions=[RecoveryAction.ABORT],
))

PLT_Q003 = _register(ErrorDefinition(
    code="PLT-Q003",
    name="Inconsistent Quality",
    message="Line quality varies across the plot",
    detail="Line thickness or darkness varies inconsistently.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.QUALITY,
    is_auto_detected=False,
    remediation_steps=[
        "Line quality varies across the plot",
        "Paper may not be perfectly flat - use tape to secure",
        "Pen ink flow may be inconsistent - try a different pen",
        "Check that the plotter surface is level",
    ],
    recovery_actions=[RecoveryAction.USER_FIX, RecoveryAction.ABORT],
))

# ============= GRBL-Specific Errors (PLT-G) =============
# These errors are specific to GRBL/DrawCore firmware used by iDraw 2.0

PLT_G001 = _register(ErrorDefinition(
    code="PLT-G001",
    name="GRBL Alarm",
    message="GRBL controller is in alarm state",
    detail="The GRBL controller has triggered an alarm. This typically means a limit switch was hit unexpectedly or the machine lost position.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.MOTION,
    remediation_steps=[
        "The machine has entered an alarm state",
        "Check if the carriage hit a limit switch unexpectedly",
        "Ensure nothing is blocking the movement path",
        "Click 'Home' to clear the alarm and re-establish position",
        "If alarm persists, power cycle the plotter",
    ],
    recovery_actions=[RecoveryAction.HOME, RecoveryAction.RETRY, RecoveryAction.ABORT],
))

PLT_G002 = _register(ErrorDefinition(
    code="PLT-G002",
    name="GRBL Error",
    message="GRBL returned an error response",
    detail="The GRBL controller rejected the command with an error code. This may indicate invalid G-code or parameters.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.COMMUNICATION,
    remediation_steps=[
        "The GRBL controller rejected a command",
        "This may indicate invalid parameters or unsupported G-code",
        "Note: iDraw DrawCore does not support G2/G3 arc commands",
        "Try homing the machine first",
        "Check if coordinates are within machine limits",
    ],
    recovery_actions=[RecoveryAction.HOME, RecoveryAction.RETRY],
))

PLT_G003 = _register(ErrorDefinition(
    code="PLT-G003",
    name="Position Unknown",
    message="Machine position is unknown - homing required",
    detail="GRBL does not know the current position. This can happen after power cycle, emergency stop, or alarm state.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.MOTION,
    remediation_steps=[
        "The machine has lost its position reference",
        "This can happen after power cycle or emergency stop",
        "Click 'Home' to establish position reference before plotting",
        "Do not move the carriage manually after homing",
    ],
    recovery_actions=[RecoveryAction.HOME],
))

PLT_G004 = _register(ErrorDefinition(
    code="PLT-G004",
    name="GRBL Hard Limit",
    message="Hard limit switch triggered",
    detail="A limit switch was triggered during movement. Position may be lost and re-homing is required.",
    severity=ErrorSeverity.ERROR,
    category=ErrorCategory.MOTION,
    remediation_steps=[
        "The carriage hit a limit switch during movement",
        "This usually means the plot exceeded machine boundaries",
        "Check that the design fits within the plotting area",
        "Click 'Home' to unlock and re-establish position",
        "You may need to restart the plot",
    ],
    recovery_actions=[RecoveryAction.HOME, RecoveryAction.ABORT],
))

PLT_G005 = _register(ErrorDefinition(
    code="PLT-G005",
    name="GRBL Soft Limit",
    message="Movement exceeds soft limits",
    detail="The requested movement would exceed the machine's configured soft limits. The position is retained.",
    severity=ErrorSeverity.WARNING,
    category=ErrorCategory.MOTION,
    remediation_steps=[
        "The requested movement exceeds machine travel limits",
        "The current position has been retained (no position loss)",
        "Check that your design fits within the plotting area",
        "Scale down your design or reposition it on the canvas",
    ],
    recovery_actions=[RecoveryAction.ABORT],
))


class PlotterError(Exception):
    """Exception raised for plotter-related errors.

    Includes structured error information for display to users.
    """

    def __init__(
        self,
        code: str,
        context: Optional[dict] = None,
        cause: Optional[Exception] = None,
    ):
        self.code = code
        self.context = context or {}
        self.cause = cause

        # Look up error definition
        self.definition = ERROR_REGISTRY.get(code)
        if self.definition:
            message = self.definition.message
        else:
            message = f"Unknown error: {code}"

        super().__init__(message)

    def to_dict(self) -> dict:
        """Serialize error to dictionary for API response."""
        if self.definition:
            return {
                "code": self.code,
                "name": self.definition.name,
                "message": self.definition.message,
                "detail": self.definition.detail,
                "severity": self.definition.severity.value,
                "category": self.definition.category.value,
                "remediation_steps": self.definition.remediation_steps,
                "recovery_actions": [a.value for a in self.definition.recovery_actions],
                "is_auto_detected": self.definition.is_auto_detected,
                "context": self.context,
            }
        else:
            return {
                "code": self.code,
                "name": "Unknown Error",
                "message": str(self),
                "detail": "",
                "severity": ErrorSeverity.ERROR.value,
                "category": ErrorCategory.CONNECTION.value,
                "remediation_steps": [],
                "recovery_actions": [],
                "is_auto_detected": True,
                "context": self.context,
            }


def get_error_by_code(code: str) -> Optional[ErrorDefinition]:
    """Look up an error definition by code."""
    return ERROR_REGISTRY.get(code)


def get_user_reported_errors() -> list[ErrorDefinition]:
    """Get all user-reported (non-auto-detected) errors."""
    return [e for e in ERROR_REGISTRY.values() if not e.is_auto_detected]


def get_errors_by_category(category: ErrorCategory) -> list[ErrorDefinition]:
    """Get all errors in a specific category."""
    return [e for e in ERROR_REGISTRY.values() if e.category == category]
