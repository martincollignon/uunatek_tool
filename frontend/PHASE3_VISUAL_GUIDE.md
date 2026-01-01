# Phase 3: Visual Style Guide

## Button Styles

### Primary Button
```html
<button class="btn btn-primary">Create Design</button>
```
- Purple background (#5E6AD2)
- White text
- Hover: Darker purple (#4C56C4)
- Active: Even darker (#3E47A8)
- Disabled: 50% opacity

### Secondary Button
```html
<button class="btn btn-secondary">Cancel</button>
```
- Transparent background
- Gray text (--color-text-secondary)
- Border: 1px solid primary border color
- Hover: Subtle background + darker text + focused border

### Ghost Button
```html
<button class="btn btn-ghost">More Options</button>
```
- Completely transparent
- No border
- Gray text
- Hover: Subtle background overlay

### Danger Button
```html
<button class="btn btn-danger">Delete Layer</button>
```
- Transparent background
- Red text and border
- Hover: Red subtle background

### Icon Button
```html
<button class="btn btn-icon">
  <svg>...</svg>
</button>
```
- 32x32px square
- 8px padding
- Perfect for toolbar icons

### Button Sizes
```html
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary">Default</button>
<button class="btn btn-primary btn-lg">Large</button>
```
- Small: 24px min-height
- Default: 32px min-height
- Large: 40px min-height

## Form Elements

### Form Group
```html
<div class="form-group">
  <label class="form-label">Canvas Size</label>
  <input type="text" class="form-input" placeholder="Enter size..." />
</div>
```

### Labels
- Uppercase text
- Small font size (11px)
- Medium weight
- Letter spacing: 0.05em
- Secondary text color

### Inputs
- 8px vertical, 12px horizontal padding
- Tertiary background
- Primary border
- Hover: Focused border color
- Focus: Primary color border + subtle shadow

### Select Dropdown
```html
<select class="form-select">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```
- Same styling as inputs
- Inherits font family

## Dialog/Modal

### Basic Dialog
```html
<div class="dialog-overlay">
  <div class="dialog">
    <div class="dialog-header">
      <h2 class="dialog-title">Export Options</h2>
    </div>
    <div class="dialog-content">
      <!-- Content here -->
    </div>
    <div class="dialog-footer">
      <button class="btn btn-secondary">Cancel</button>
      <button class="btn btn-primary">Export</button>
    </div>
  </div>
</div>
```

### Features
- Overlay: 70% black background with fade-in
- Dialog: Slides up 20px on open
- Max width: 480px
- Max height: 85vh (scrollable content)
- Large border radius: 12px
- Enhanced shadow (--shadow-xl)

## Tabs

### Tab Navigation
```html
<div class="tabs">
  <button class="tab active">Design</button>
  <button class="tab">Layers</button>
  <button class="tab">Export</button>
</div>
```

### States
- Default: Tertiary text color, no background
- Hover: Secondary text color
- Active: Primary text color + bottom border
- Transition: 100ms ease

## Dropdown Menu

### Basic Dropdown
```html
<div class="dropdown-container">
  <button class="btn btn-secondary">Options</button>
  <div class="dropdown-menu">
    <button class="dropdown-item">Edit</button>
    <button class="dropdown-item">Duplicate</button>
    <div class="dropdown-divider"></div>
    <button class="dropdown-item">Delete</button>
  </div>
</div>
```

### Features
- Hover background (--color-bg-hover)
- Internal padding: 4px
- Items have 4px border radius
- Gap support for icons
- Divider: 1px line with margin

## Scrollbar (Webkit)

### Styling
- Width/Height: 8px
- Track: Scrollbar track color (theme-aware)
- Thumb: Scrollbar thumb color with full radius
- Thumb hover: Slightly lighter

### Example
Automatically applies to all scrollable elements:
```css
overflow-y: auto; /* Scrollbar will be styled */
```

## Focus States

### Keyboard Focus
All interactive elements get:
- No outline (removed)
- Box shadow: 2px background + 4px focus ring
- Primary color ring (rgba with 40% opacity)

### Text Selection
- Background: Primary color subtle (10% opacity)
- Text: Primary text color
- Smooth, professional appearance

## Color Usage Patterns

### Backgrounds (Dark Mode)
- Primary: #0D0D0D (main app background)
- Secondary: #111111 (panels, toolbars)
- Tertiary: #1A1A1A (cards, dialogs, inputs)
- Hover: #222222 (interactive hover)
- Active: #2A2A2A (pressed state)

### Borders (Dark Mode)
- Primary: #2E2E2E (default borders)
- Secondary: #252525 (subtle dividers)
- Focus: #404040 (hover/focus state)

### Text (Dark Mode)
- Primary: #F5F5F5 (main text)
- Secondary: #A0A0A0 (labels, secondary info)
- Tertiary: #666666 (placeholders, disabled)
- Disabled: #4A4A4A (disabled elements)

### Interactive Colors
- Primary: #5E6AD2 (actions, links)
- Success: #3ECF8E (success states)
- Warning: #F5A623 (warnings)
- Error: #EF5350 (errors, danger)

## Spacing Scale

Based on 4px increments:
- `--spacing-1`: 4px (tight spacing)
- `--spacing-2`: 8px (default gap/padding)
- `--spacing-3`: 12px (comfortable padding)
- `--spacing-4`: 16px (section spacing)
- `--spacing-5`: 20px (large spacing)

## Border Radius Scale

- `--radius-sm`: 4px (items, dropdowns)
- `--radius-md`: 6px (buttons, inputs)
- `--radius-lg`: 8px (cards, dropdown containers)
- `--radius-xl`: 12px (dialogs, modals)
- `--radius-full`: 9999px (pills, scrollbars)

## Animation Timing

- `--transition-fast`: 100ms (buttons, hovers)
- `--transition-base`: 150ms (overlays)
- `--transition-slow`: 200ms (dialogs)
- `--transition-slower`: 300ms (complex animations)

All transitions use `ease` timing function.

## Usage Examples

### Action Bar
```html
<div style="display: flex; gap: var(--spacing-2);">
  <button class="btn btn-primary">Save</button>
  <button class="btn btn-secondary">Export</button>
  <button class="btn btn-ghost">Cancel</button>
</div>
```

### Form Layout
```html
<form>
  <div class="form-group">
    <label class="form-label">Project Name</label>
    <input type="text" class="form-input" />
  </div>
  <div class="form-group">
    <label class="form-label">Canvas Size</label>
    <select class="form-select">
      <option>A4 Portrait</option>
      <option>A4 Landscape</option>
    </select>
  </div>
  <button class="btn btn-primary">Create Project</button>
</form>
```

### Tab Panel
```html
<div>
  <div class="tabs">
    <button class="tab active">Settings</button>
    <button class="tab">Export</button>
  </div>
  <div class="tab-content">
    <!-- Content here -->
  </div>
</div>
```

## Best Practices

1. **Consistent Spacing**: Always use spacing tokens, never hardcode pixels
2. **Button Hierarchy**: Primary → Secondary → Ghost for visual priority
3. **Form Labels**: Always uppercase for consistency
4. **Focus States**: Never remove focus indicators
5. **Color Tokens**: Use semantic color names, not color values
6. **Transitions**: Keep them fast (100-200ms) and consistent
7. **Border Radius**: Match the size of the element (larger elements = larger radius)
8. **Disabled States**: Use opacity, maintain same structure
9. **Hover States**: Always provide visual feedback
10. **Z-index**: Use token scale, never arbitrary values

## Accessibility

- All interactive elements have focus states
- Color contrast meets WCAG AA standards
- Form labels are properly associated
- Buttons have proper hover/active/disabled states
- Keyboard navigation fully supported
- Screen reader friendly markup
