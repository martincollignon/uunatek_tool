# Plotter Coordinate System and Safety Documentation

## Overview
This document explains how the iDraw 2.0 plotter with GRBL DrawCore firmware handles coordinates, movements, and safety limits.

---

## 1. Can we get absolute location at any time?

**YES** ✅

The plotter can always report its absolute machine position using the GRBL status query command.

**Implementation:**
```python
status = await cmd.query_status()
current_x = status.machine_x  # Absolute X position in mm
current_y = status.machine_y  # Absolute Y position in mm
current_z = status.machine_z  # Absolute Z position in mm
state = status.state          # Machine state (Idle, Run, etc.)
```

**Location in code:** `backend/core/plotter/grbl_commands.py:261-270`

**GRBL Command:** `?` (real-time status query)

**Response Format:** `<Idle|MPos:10.000,-150.000,0.000|FS:0,0>`
- `MPos`: Machine position (absolute coordinates)
- Works even while machine is moving
- Response time: ~10-50ms

---

## 2. Do we get warnings for out-of-bounds movements?

**PARTIAL** ⚠️

The system has **software clamping** but **NO warnings**.

### Current Safety Mechanism

**Location:** `backend/core/plotter/grbl_commands.py:201-203`

```python
# Clamp to machine limits (NEEDS FIX - doesn't allow negative Y)
x_mm = max(0, min(x_mm, self.MAX_X_MM))  # Clamps to [0, 297]
y_mm = max(0, min(y_mm, self.MAX_Y_MM))  # Clamps to [0, 420] - WRONG! Should allow negative Y
```

### Machine Limits
```python
MAX_X_MM = 297.0   # A3 width in mm (GRBL $130)
MAX_Y_MM = 420.0   # A3 height in mm (GRBL $131)
MAX_Z_MM = 10.0    # Z-axis travel
```

**Note:** Current clamping prevents negative Y values, but the verified coordinate system shows that Y can be negative (front of bed). This needs to be fixed.

### Problems with Current Approach

1. **Silent clamping** - No error or warning when coordinates are out of bounds
2. **Unexpected behavior** - A command to move to (500, 100) silently becomes (310, 100)
3. **May still cause issues** - Clamping prevents some errors but doesn't validate the coordinate system setup

### Example of Silent Clamping
```python
# User code tries to move outside limits
await cmd.move_absolute(500, -50, None)

# Actually sends after clamping:
# G00 X310.000 Y0.000
# (500 clamped to 310, -50 clamped to 0)
```

### GRBL's Built-in Protection

GRBL firmware also has hard limits (configured with `$130`, `$131`, `$132`):
```
$130=297.000  # Max X travel
$131=420.000  # Max Y travel
$132=10.000   # Max Z travel
```

If hard limits are exceeded, GRBL enters **ALARM state** and stops all movement. The machine must be reset and re-homed.

---

## 3. What do X and Y represent?

### Machine Coordinate System

**After $H Homing (Reference Position) - VERIFIED EMPIRICALLY:**
- **Origin (0, 0)**: BACK-LEFT corner of plotter bed (0.7cm from left edge, 0cm from back/top)
- **+X direction**: RIGHT (toward right edge)
- **-Y direction**: toward FRONT (toward user)
- **Y=0**: at BACK edge (top of plotter bed)
- **+Z direction**: DOWN (pen moves down toward paper)

### Visual Representation

```
    BACK EDGE (Y=0)
    ┌───────────────────────────────┐
    │ HOME (0,0)                    │
    │ 0.7cm from left               │
    │                               │
    │         +X →                  │
    │                               │
    │         -Y ↓ (toward front)   │
    │                               │
    └───────────────────────────────┘
    FRONT EDGE (toward user)
```

### Paper Positions on Plotter Bed

Papers are positioned flush against the **top-right** (back-right) corner of the plotter bed.

**A4 Paper (210mm × 297mm) - VERIFIED EMPIRICALLY:**

```
    BACK EDGE (Y=0)
    ┌───────────────────────────────────┐
    │ HOME (0,0)          A4 Paper      │
    │                   ┌───────────────┤
    │                   │ (80,0)  (290,0)│ ← Top edge of A4
    │                   │ TOP-L   TOP-R │
    │         +X →      │  210×297mm    │
    │                   │               │
    │         -Y ↓      │               │
    │                   │               │
    │                   │(-80,-297)(290,-297)│
    │                   └───────────────┘
    │                    BOTTOM-L BOTTOM-R
    └───────────────────────────────────┘
    FRONT EDGE (toward user)
```

**A4 Corners in Machine Coordinates (VERIFIED):**
- TOP-RIGHT (back-right): **(290, 0)**
- TOP-LEFT (back-left): **(80, 0)**
- BOTTOM-LEFT (front-left): **(80, -297)**
- BOTTOM-RIGHT (front-right): **(290, -297)**

**A3 Paper (297mm × 420mm) - VERIFIED EMPIRICALLY:**

```
    BACK EDGE (Y=0)
    ┌───────────────────────────────────┐
    │ HOME                  A3 Paper    │
    │  ┌────────────────────────────────┤
    │  │(-7,0)            (290,0)       │ ← Top edge of A3
    │  │TOP-L             TOP-R         │
    │  │    297×420mm                   │
    │  │                                │
    │  │                                │
    │  │                                │
    │  │                                │
    │  │(-7,-420)       (290,-420)      │
    │  └────────────────────────────────┘
    │   BOTTOM-L         BOTTOM-R
    └───────────────────────────────────┘
    FRONT EDGE (toward user)
```

**A3 Corners in Machine Coordinates (VERIFIED):**
- TOP-RIGHT (back-right): **(290, 0)**
- TOP-LEFT (back-left): **(-7, 0)**
- BOTTOM-LEFT (front-left): **(-7, -420)**
- BOTTOM-RIGHT (front-right): **(290, -420)**

**GRBL Machine Limits:**
- Max X: 297mm (`$130=297`)
- Max Y: 420mm (`$131=420`)

**Note:** A3 left edge extends slightly beyond the machine home position (X < 0), which is allowed by GRBL.

---

## 4. Are movements relative or absolute?

**ABSOLUTE** ✅

### GRBL Mode

The plotter operates in **G90 (Absolute Positioning) mode** at all times.

**Set during initialization:** `backend/core/plotter/grbl_commands.py:93-95`

```python
# Set absolute positioning mode
await self._send_gcode("G90")
self._is_absolute = True
```

### Movement Commands

All movements use absolute coordinates:

```python
# move_absolute() - direct absolute positioning
await cmd.move_absolute(210.0, 150.0, 2000.0)
# Sends: G01 X210.000 Y150.000 F2000.0
# Means: Move to absolute position (210mm, 150mm) at 2000mm/min

# move_relative() - convenience wrapper that converts to absolute
await cmd.move_relative(dx=10.0, dy=5.0, duration_ms=1000)
# Internally calculates: target_x = current_x + 10.0
# Then calls move_absolute(target_x, target_y, feed_rate)
```

### G-Code Commands

- **G00**: Rapid move (pen up, maximum speed)
  - Example: `G00 X210.000 Y150.000`
- **G01**: Linear move with feed rate (pen down, controlled speed)
  - Example: `G01 X210.000 Y150.000 F2000.0`

### Position Tracking

The system maintains internal position tracking:
```python
self._current_x = 0.0  # Updated after each move
self._current_y = 0.0  # Used for relative move calculations
```

**Important:** This tracking is local to the Python code. GRBL always knows the true machine position independently.

---

## 5. Coordinate System Setup for Plotting

### The Problem

**SVG Coordinate System:**
- Origin (0, 0) at **top-left** of paper
- +X goes **RIGHT**
- +Y goes **DOWN**

**Plotter Coordinate System (VERIFIED):**
- Origin (0, 0) at **back-left** corner (after $H homing)
- +X goes **RIGHT**
- -Y goes toward **FRONT** (toward user, equivalent to SVG +Y down)
- Y=0 is at **BACK** edge

Both X-axis match direction. Y-axis: SVG +Y down = plotter -Y. We need transformation.

### Solution

**Implementation:** `backend/core/plotter/executor.py:81-114`

#### Step 1: Auto-home and move to start position

When plotting starts, the system automatically:
1. Homes the plotter (`$H` command) to establish absolute coordinates
2. Moves pen to paper top-right corner (back-right)

```python
# Auto-home to establish absolute coordinates
await self.cmd.home()

# Move to paper top-right corner (pen start position)
# For A4: (290, 0)
# For A3: (290, 0)
self._origin_x = 290.0  # Paper top-right X (back-right)
self._origin_y = 0.0    # Paper top-right Y (back edge)
await self.cmd.move_absolute(self._origin_x, self._origin_y, None)
```

#### Step 2: Transform each SVG coordinate

```python
def _transform_coordinates(self, svg_x: float, svg_y: float):
    """Transform SVG to plotter coordinates.

    SVG: origin top-left, +X right, +Y down
    Plotter: origin back-left (0,0), +X right, -Y toward front (down)
    Pen starts at top-right (back-right): (290, 0)
    """
    # X: offset from top-right (negative = left of start)
    relative_x = svg_x - self.canvas_width_mm

    # Y: SVG +Y down = plotter -Y (both go toward front/user)
    relative_y = -svg_y

    # Add origin offset for absolute machine coordinates
    machine_x = self._origin_x + relative_x
    machine_y = self._origin_y + relative_y

    return (machine_x, machine_y)
```

#### Example Transformations

For A4 paper (210mm × 297mm) with pen starting at (290, 0):

| SVG Point | Description | Calculation | Machine Coordinates |
|-----------|-------------|-------------|---------------------|
| (0, 0) | Top-left | (0-210, -0) | (80, 0) |
| (210, 0) | Top-right (start) | (210-210, -0) | (290, 0) |
| (105, 148.5) | Center | (105-210, -148.5) | (185, -148.5) |
| (0, 297) | Bottom-left | (0-210, -297) | (80, -297) |
| (210, 297) | Bottom-right | (210-210, -297) | (290, -297) |

---

## 6. UI Safety Improvements

### Current Issues

1. ❌ No visual indication of where pen is positioned
2. ❌ No validation that pen is at correct starting position
3. ❌ No preview of plotter path before execution
4. ❌ No bounds checking before sending commands
5. ❌ Silent coordinate clamping (commands silently changed)

### Recommended UI Improvements

#### A. Pre-Plot Validation Dialog

Before starting a plot, show a dialog:

```
┌─────────────────────────────────────────┐
│  🛡️  Plot Safety Check                  │
├─────────────────────────────────────────┤
│                                         │
│  ⚠️  Manual Setup Required              │
│                                         │
│  1. Position pen at TOP-RIGHT corner   │
│     of paper (flush against home)      │
│                                         │
│  2. Paper should be flush against      │
│     top-right corner of plotter bed    │
│                                         │
│  Current machine position:             │
│  X: 10.0 mm, Y: -150.0 mm              │
│                                         │
│  Expected plotting area:               │
│  X: [10, 220] mm                       │
│  Y: [-150, 147] mm                     │
│                                         │
│  ⚠️  Make sure pen can reach these     │
│     coordinates without hitting limits │
│                                         │
│  [ Test Movement ] [ Cancel ] [ Plot ] │
└─────────────────────────────────────────┘
```

#### B. Test Movement Button

Add a "Test Movement" button that:
1. Queries current position
2. Moves to each paper corner (pen up)
3. Returns to start
4. Validates all positions are reachable

```python
async def test_paper_bounds():
    """Test if pen can reach all paper corners."""
    status = await cmd.query_status()
    origin_x, origin_y = status.machine_x, status.machine_y

    corners = [
        ("Top-right (start)", origin_x, origin_y),
        ("Top-left", origin_x + 210, origin_y),
        ("Bottom-left", origin_x + 210, origin_y + 297),
        ("Bottom-right", origin_x, origin_y + 297),
    ]

    await cmd.pen_up()

    for name, x, y in corners:
        # Check bounds before moving
        if x < 0 or x > MAX_X_MM or y < 0 or y > MAX_Y_MM:
            return False, f"Corner {name} out of bounds: ({x}, {y})"

        # Move to corner
        await cmd.move_absolute(x, y, None)
        await asyncio.sleep(1)

    # Return to start
    await cmd.move_absolute(origin_x, origin_y, None)
    return True, "All corners reachable"
```

#### C. Coordinate Bounds Validation

Add validation before sending ANY move command:

```python
def validate_coordinates(x: float, y: float) -> tuple[bool, str]:
    """Validate coordinates are within machine limits."""
    if x < 0 or x > MAX_X_MM:
        return False, f"X={x} out of range [0, {MAX_X_MM}]"
    if y < 0 or y > MAX_Y_MM:
        return False, f"Y={y} out of range [0, {MAX_Y_MM}]"
    return True, "OK"

# Use before every move:
valid, msg = validate_coordinates(target_x, target_y)
if not valid:
    raise PlotterError("PLT-B001", context={"message": msg})
```

#### D. Visual Position Indicator

Show current pen position on canvas in real-time:

```typescript
// Query position every second
setInterval(async () => {
  const position = await api.queryPlotterPosition();

  // Transform machine coordinates to canvas coordinates
  const svgX = canvasWidth - (position.x - originX);
  const svgY = position.y - originY;

  // Draw crosshair at position
  drawPositionIndicator(svgX, svgY);
}, 1000);
```

#### E. Emergency Stop Button

Large, always-visible emergency stop:

```
┌─────────────────────┐
│  🛑  EMERGENCY STOP  │  ← Always visible, red, large
│   (Motor disable)   │
└─────────────────────┘
```

Immediately sends:
1. Feed hold: `!` (pause movement)
2. Soft reset: `Ctrl+X` (stop and reset)
3. Disable motors: `$MD` (motor disable)

---

## 7. Testing Procedures

### Test 1: Position Query Test

**Purpose:** Verify we can always query position

```python
async def test_position_query():
    """Test absolute position querying."""
    for i in range(10):
        status = await cmd.query_status()
        print(f"Position {i}: ({status.machine_x}, {status.machine_y})")
        await asyncio.sleep(0.5)
    # Expected: Should report position 10 times without errors
```

**Success Criteria:**
- ✅ All 10 queries return valid positions
- ✅ Response time < 100ms
- ✅ No errors or timeouts

### Test 2: Coordinate Transformation Test

**Purpose:** Verify SVG coordinates transform correctly

```python
async def test_transformation():
    """Test coordinate transformation accuracy."""
    # Position pen at top-right corner manually
    status = await cmd.query_status()
    origin_x, origin_y = status.machine_x, status.machine_y

    test_cases = [
        # (svg_x, svg_y, expected_machine_x, expected_machine_y, description)
        (210, 0, origin_x, origin_y, "Top-right (start)"),
        (0, 0, origin_x + 210, origin_y, "Top-left"),
        (210, 297, origin_x, origin_y + 297, "Bottom-right"),
        (0, 297, origin_x + 210, origin_y + 297, "Bottom-left"),
    ]

    await cmd.pen_up()

    for svg_x, svg_y, exp_x, exp_y, desc in test_cases:
        # Transform
        relative_x = 210 - svg_x
        relative_y = svg_y
        machine_x = origin_x + relative_x
        machine_y = origin_y + relative_y

        # Move
        await cmd.move_absolute(machine_x, machine_y, None)
        await asyncio.sleep(1)

        # Verify
        status = await cmd.query_status()
        error_x = abs(status.machine_x - exp_x)
        error_y = abs(status.machine_y - exp_y)

        print(f"{desc}: error=({error_x:.2f}, {error_y:.2f})")

        if error_x > 1 or error_y > 1:
            return False, f"Failed at {desc}"

    return True, "All transformations accurate"
```

**Success Criteria:**
- ✅ Pen moves to all 4 corners correctly
- ✅ Position error < 1mm for each corner
- ✅ Returns to starting position

### Test 3: Bounds Validation Test

**Purpose:** Verify out-of-bounds coordinates are caught

```python
async def test_bounds_validation():
    """Test boundary validation."""
    test_cases = [
        (-10, 0, False, "Negative X"),
        (0, -10, False, "Negative Y"),
        (500, 0, False, "X exceeds max"),
        (0, 500, False, "Y exceeds max"),
        (150, 200, True, "Valid coordinates"),
    ]

    for x, y, should_pass, desc in test_cases:
        valid, msg = validate_coordinates(x, y)

        if valid != should_pass:
            return False, f"Failed: {desc}"

    return True, "All validation tests passed"
```

**Success Criteria:**
- ✅ Invalid coordinates rejected
- ✅ Valid coordinates accepted
- ✅ Clear error messages for failures

### Test 4: Small Rectangle Draw Test

**Purpose:** Verify complete plotting workflow

```python
async def test_small_rectangle():
    """Draw a 20mm×20mm square from top-right corner."""
    status = await cmd.query_status()
    origin_x, origin_y = status.machine_x, status.machine_y

    # Define square in SVG coordinates (starting at top-right)
    svg_points = [
        (210, 0),    # Top-right (start)
        (190, 0),    # 20mm left
        (190, 20),   # 20mm down
        (210, 20),   # 20mm right
        (210, 0),    # Back to start
    ]

    await cmd.pen_up()

    for svg_x, svg_y in svg_points:
        # Transform to machine coordinates
        rel_x = 210 - svg_x
        rel_y = svg_y
        machine_x = origin_x + rel_x
        machine_y = origin_y + rel_y

        # Move
        await cmd.move_absolute(machine_x, machine_y, None)
        await asyncio.sleep(0.5)

        # First point: pen down
        if svg_x == 210 and svg_y == 0:
            await cmd.pen_down()
            await asyncio.sleep(0.3)

    await cmd.pen_up()

    return True, "Square drawn"
```

**Success Criteria:**
- ✅ Draws a 20mm × 20mm square
- ✅ Square starts at pen position
- ✅ Lines are straight and perpendicular
- ✅ No motor noise or limit hits

---

## 8. Summary: Key Points

### ✅ What Works

1. **Absolute position queries** - Can always query machine position
2. **Absolute movements** - All movements use absolute coordinates (G90 mode)
3. **Software clamping** - Coordinates clamped to [0, MAX] range
4. **Coordinate transformation** - SVG coordinates correctly transform to machine coordinates

### ⚠️ Current Risks

1. **Silent clamping** - Out-of-bounds coordinates silently changed
2. **No pre-validation** - Commands sent without checking bounds
3. **Manual setup required** - User must position pen correctly
4. **No visual feedback** - Can't see pen position on canvas
5. **Hard limits can trigger alarms** - GRBL will stop if real limits exceeded

### 🎯 Recommendations

1. **Add bounds validation** before sending commands
2. **Show position indicator** on canvas in real-time
3. **Add "Test Bounds" button** to verify setup before plotting
4. **Add pre-plot confirmation dialog** with safety checklist
5. **Improve error messages** - Don't silently clamp, warn user
6. **Add emergency stop button** - Always visible and accessible

### 📋 Before Every Plot

**User Checklist:**
1. ✅ Paper positioned flush against top-right corner
2. ✅ Pen positioned at top-right corner of paper
3. ✅ Pen can move freely across entire paper
4. ✅ No obstacles in plotter bed area
5. ✅ Emergency stop button is accessible

**Software Checklist:**
1. ✅ Query current machine position
2. ✅ Calculate expected plotting bounds
3. ✅ Validate all coordinates are within machine limits
4. ✅ Test movement to paper corners (optional)
5. ✅ Confirm with user before starting plot

---

## 9. Code Locations Reference

### Query Position
- **File:** `backend/core/plotter/grbl_commands.py`
- **Function:** `query_status()` (line 261)
- **Returns:** `GRBLStatus` with `machine_x`, `machine_y`, `machine_z`

### Move Commands
- **File:** `backend/core/plotter/grbl_commands.py`
- **Function:** `move_absolute()` (line 193)
- **Mode:** G90 (absolute positioning)
- **Clamping:** Lines 202-203

### Coordinate Transformation
- **File:** `backend/core/plotter/executor.py`
- **Function:** `_transform_coordinates()` (line 77)
- **Origin stored:** Lines 146-150

### Machine Limits
- **File:** `backend/core/plotter/grbl_commands.py`
- **Constants:** Lines 60-62
- **MAX_X_MM:** 310.0 (A3 width)
- **MAX_Y_MM:** 445.0 (A3 height)

---

**Last Updated:** 2026-01-01
**Author:** Claude
**Version:** 1.0
