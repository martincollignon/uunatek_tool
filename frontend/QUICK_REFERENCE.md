# Phase 3: Quick Reference Card

## Button Classes

```html
<!-- Variants -->
.btn-primary     → Purple background, white text
.btn-secondary   → Transparent, gray text, border
.btn-ghost       → Transparent, no border
.btn-danger      → Transparent, red text, red border

<!-- Sizes -->
.btn-sm          → 24px height
default          → 32px height
.btn-lg          → 40px height

<!-- Special -->
.btn-icon        → 32×32px square, perfect for icons

<!-- Usage -->
<button class="btn btn-primary">Save</button>
<button class="btn btn-secondary btn-sm">Cancel</button>
<button class="btn btn-icon"><svg>...</svg></button>
```

## Form Classes

```html
.form-group      → Container with bottom margin
.form-label      → Uppercase label, small font
.form-input      → Text input
.form-select     → Select dropdown
.form-textarea   → Multi-line text

<!-- Usage -->
<div class="form-group">
  <label class="form-label">Field Name</label>
  <input class="form-input" />
</div>
```

## Dialog Classes

```html
.dialog-overlay  → Full-screen backdrop with fade-in
.dialog          → Modal container with slide-up
.dialog-header   → Header with title
.dialog-title    → Title text
.dialog-content  → Scrollable content
.dialog-footer   → Footer with actions

<!-- Usage -->
<div class="dialog-overlay">
  <div class="dialog">
    <div class="dialog-header">
      <h2 class="dialog-title">Title</h2>
    </div>
    <div class="dialog-content">Content</div>
    <div class="dialog-footer">
      <button class="btn btn-primary">OK</button>
    </div>
  </div>
</div>
```

## Tab Classes

```html
.tabs            → Tab container
.tab             → Individual tab
.tab.active      → Active tab with bottom border

<!-- Usage -->
<div class="tabs">
  <button class="tab active">Tab 1</button>
  <button class="tab">Tab 2</button>
</div>
```

## Dropdown Classes

```html
.dropdown-menu   → Dropdown container
.dropdown-item   → Menu item (supports icons)
.dropdown-divider → Separator line

<!-- Usage -->
<div class="dropdown-menu">
  <button class="dropdown-item">Item 1</button>
  <div class="dropdown-divider"></div>
  <button class="dropdown-item">Item 2</button>
</div>
```

## Design Token Cheat Sheet

### Spacing (4px base)
```css
var(--spacing-1)    /* 4px  - tight */
var(--spacing-2)    /* 8px  - default */
var(--spacing-3)    /* 12px - comfortable */
var(--spacing-4)    /* 16px - section */
var(--spacing-5)    /* 20px - large */
```

### Colors (Dark Mode)
```css
/* Backgrounds */
var(--color-bg-primary)     /* #0D0D0D - darkest */
var(--color-bg-secondary)   /* #111111 - dark */
var(--color-bg-tertiary)    /* #1A1A1A - cards */
var(--color-bg-hover)       /* #222222 - hover */

/* Borders */
var(--color-border-primary) /* #2E2E2E - default */
var(--color-border-focus)   /* #404040 - hover/focus */

/* Text */
var(--color-text-primary)   /* #F5F5F5 - main */
var(--color-text-secondary) /* #A0A0A0 - labels */
var(--color-text-tertiary)  /* #666666 - placeholders */

/* Interactive */
var(--color-primary)        /* #5E6AD2 - purple */
var(--color-success)        /* #3ECF8E - green */
var(--color-warning)        /* #F5A623 - orange */
var(--color-error)          /* #EF5350 - red */
```

### Typography
```css
var(--font-size-xs)         /* 11px */
var(--font-size-sm)         /* 12px - default */
var(--font-size-base)       /* 13px - body */
var(--font-size-md)         /* 14px */
var(--font-size-lg)         /* 16px - titles */

var(--font-weight-medium)   /* 500 */
var(--font-weight-semibold) /* 600 */
```

### Border Radius
```css
var(--radius-sm)   /* 4px  - items */
var(--radius-md)   /* 6px  - buttons, inputs */
var(--radius-lg)   /* 8px  - cards, dropdowns */
var(--radius-xl)   /* 12px - dialogs */
var(--radius-full) /* 9999px - pills, scrollbars */
```

### Transitions
```css
var(--transition-fast)   /* 100ms - hovers, buttons */
var(--transition-base)   /* 150ms - overlays */
var(--transition-slow)   /* 200ms - dialogs */
```

### Shadows
```css
var(--shadow-sm)  /* Subtle */
var(--shadow-md)  /* Default cards */
var(--shadow-lg)  /* Elevated dropdowns */
var(--shadow-xl)  /* Dialogs, popovers */
```

### Z-Index
```css
var(--z-dropdown) /* 100 */
var(--z-sticky)   /* 200 */
var(--z-modal)    /* 1000 */
var(--z-tooltip)  /* 1100 */
var(--z-toast)    /* 1200 */
```

## Common Patterns

### Action Bar
```html
<div style="display: flex; gap: var(--spacing-2);">
  <button class="btn btn-primary">Primary</button>
  <button class="btn btn-secondary">Secondary</button>
  <button class="btn btn-ghost">Tertiary</button>
</div>
```

### Form Section
```html
<div class="form-group">
  <label class="form-label">Label</label>
  <input class="form-input" placeholder="..." />
</div>
```

### Card with Actions
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Title</h3>
  </div>
  <div class="card-content">
    Content here
  </div>
  <div class="dialog-footer">
    <button class="btn btn-primary">Action</button>
  </div>
</div>
```

## State Modifiers

### Buttons
```css
:hover:not(:disabled)  /* Hover state */
:active:not(:disabled) /* Active/pressed state */
:disabled              /* Disabled state (50% opacity) */
```

### Form Inputs
```css
:hover  /* Border changes to --color-border-focus */
:focus  /* Border primary + subtle shadow */
```

### Interactive Elements
```css
:focus-visible  /* Automatic focus ring */
```

## Best Practices

1. **Spacing**: Always use tokens, never hardcode
   ```css
   ❌ padding: 8px 12px;
   ✅ padding: var(--spacing-2) var(--spacing-3);
   ```

2. **Colors**: Use semantic names
   ```css
   ❌ color: #A0A0A0;
   ✅ color: var(--color-text-secondary);
   ```

3. **Transitions**: Keep fast and consistent
   ```css
   ❌ transition: all 0.3s ease;
   ✅ transition: all var(--transition-fast) ease;
   ```

4. **Button Hierarchy**: Visual priority order
   ```html
   1st: .btn-primary     (main action)
   2nd: .btn-secondary   (alternative)
   3rd: .btn-ghost       (cancel/back)
   ```

5. **Focus States**: Never remove, always visible
   ```css
   ❌ outline: none; (without replacement)
   ✅ Uses automatic focus-visible styles
   ```

## Quick Tips

- **Theme Switching**: Works automatically via CSS variables
- **Dark Mode**: Default (no attribute needed)
- **Light Mode**: `data-theme="light"` on `<html>`
- **Disabled States**: Use `:not(:disabled)` for hover/active
- **Icon Buttons**: Use `.btn-icon` for perfect squares
- **Form Labels**: Automatically uppercase, no need to add styling
- **Dropdowns**: Support icons with automatic gap spacing
- **Dialogs**: Animate automatically on mount
- **Tabs**: Zero gap, bottom border on active
- **Scrollbars**: Auto-styled in webkit browsers

## Need Help?

- **Full docs**: `PHASE3_BASE_STYLES_COMPLETE.md`
- **Visual guide**: `PHASE3_VISUAL_GUIDE.md`
- **Changes**: `PHASE3_CHANGES_SUMMARY.md`
- **Implementation**: `PHASE3_IMPLEMENTATION_COMPLETE.md`
