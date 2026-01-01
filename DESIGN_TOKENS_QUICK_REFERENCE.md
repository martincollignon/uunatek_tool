# Design Tokens Quick Reference Guide

## Quick Access to Design Tokens
This is a developer-friendly quick reference for all design tokens in the Tallahassee application.

---

## Colors

### Background Colors
```css
--color-bg-primary: /* Main app background */
--color-bg-secondary: /* Secondary surfaces */
--color-bg-tertiary: /* Cards, panels, sidebars */
--color-bg-hover: /* Hover state backgrounds */
--color-bg-active: /* Active state backgrounds */
```

### Border Colors
```css
--color-border-primary: /* Main borders */
--color-border-secondary: /* Subtle borders */
--color-border-focus: /* Focus state borders */
```

### Text Colors
```css
--color-text-primary: /* Main text */
--color-text-secondary: /* Secondary text */
--color-text-tertiary: /* Muted text */
--color-text-disabled: /* Disabled text */
```

### Brand & Status Colors
```css
--color-primary: /* Primary brand color */
--color-primary-hover: /* Primary hover */
--color-primary-active: /* Primary active */
--color-primary-subtle: /* Primary background */

--color-success: /* Success state */
--color-success-hover: /* Success hover */
--color-success-subtle: /* Success background */

--color-warning: /* Warning state */
--color-warning-hover: /* Warning hover */
--color-warning-subtle: /* Warning background */

--color-error: /* Error state */
--color-error-hover: /* Error hover */
--color-error-subtle: /* Error background */
```

### Interactive Colors
```css
--color-interactive-hover: /* Generic hover overlay */
--color-interactive-active: /* Generic active overlay */
--color-focus-ring: /* Focus ring color */
```

### Canvas Colors
```css
--color-canvas-bg: /* Canvas background */
--color-canvas-surface: /* Canvas surface (white/light) */
--color-canvas-grid: /* Grid overlay */
```

---

## Spacing

```css
--spacing-0: 0
--spacing-0\.5: 2px
--spacing-1: 4px
--spacing-1\.5: 6px
--spacing-2: 8px
--spacing-2\.5: 10px
--spacing-3: 12px
--spacing-4: 16px
--spacing-5: 20px
--spacing-6: 24px
--spacing-8: 32px
--spacing-10: 40px
--spacing-12: 48px
```

**Usage Examples:**
```css
padding: var(--spacing-4); /* 16px */
gap: var(--spacing-2); /* 8px */
margin-bottom: var(--spacing-6); /* 24px */
```

---

## Typography

### Font Sizes
```css
--font-size-xs: 11px
--font-size-sm: 12px
--font-size-base: 13px
--font-size-md: 14px
--font-size-lg: 16px
--font-size-xl: 18px
--font-size-2xl: 22px
```

### Font Weights
```css
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
```

### Letter Spacing
```css
--letter-spacing-tight: -0.01em
--letter-spacing-normal: 0
--letter-spacing-wide: 0.01em
```

### Line Heights
```css
--line-height-tight: 1.25
--line-height-normal: 1.5
--line-height-relaxed: 1.75
```

**Usage Examples:**
```css
font-size: var(--font-size-sm);
font-weight: var(--font-weight-semibold);
letter-spacing: var(--letter-spacing-tight);
line-height: var(--line-height-normal);
```

---

## Border Radius

```css
--radius-sm: 4px
--radius-md: 6px
--radius-lg: 8px
--radius-xl: 12px
--radius-full: 9999px
```

**Usage Examples:**
```css
border-radius: var(--radius-md); /* Buttons, inputs */
border-radius: var(--radius-lg); /* Cards, dialogs */
border-radius: var(--radius-full); /* Pills, badges */
```

---

## Transitions

```css
--transition-fast: 100ms
--transition-base: 150ms
--transition-slow: 200ms
--transition-slower: 300ms
```

**Usage Examples:**
```css
transition: all var(--transition-fast) ease;
transition: background var(--transition-base) ease;
transition: opacity var(--transition-slow) ease;
```

---

## Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)
--shadow-glow: 0 0 20px rgba(94, 106, 210, 0.3)
```

**Note:** Shadows automatically adjust for dark/light mode.

---

## Z-Index Scale

```css
--z-dropdown: 100
--z-sticky: 200
--z-modal: 1000
--z-tooltip: 1100
--z-toast: 1200
```

**Usage Examples:**
```css
z-index: var(--z-dropdown); /* Dropdowns */
z-index: var(--z-modal); /* Dialogs, modals */
z-index: var(--z-tooltip); /* Tooltips */
```

---

## Common Patterns

### Button Styling
```css
.my-button {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: white;
  transition: all var(--transition-fast) ease;
}

.my-button:hover {
  background: var(--color-primary-hover);
}
```

### Card Styling
```css
.my-card {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-lg);
  padding: var(--spacing-6);
  box-shadow: var(--shadow-sm);
}

.my-card:hover {
  border-color: var(--color-border-focus);
  box-shadow: var(--shadow-md);
}
```

### Input Styling
```css
.my-input {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-sm);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
}

.my-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-subtle);
}
```

### Text Hierarchy
```css
.heading-large {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: var(--letter-spacing-tight);
}

.heading-small {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.body-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.caption {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}
```

### Status Badge
```css
.badge-success {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-2);
  padding: var(--spacing-1) var(--spacing-2);
  background: var(--color-success-subtle);
  color: var(--color-success);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}
```

### Interactive List Item
```css
.list-item {
  padding: var(--spacing-2) var(--spacing-3);
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid transparent;
  transition: all var(--transition-fast) ease;
  cursor: pointer;
}

.list-item:hover {
  background: var(--color-interactive-hover);
}

.list-item.selected {
  background: var(--color-primary-subtle);
  border-color: var(--color-primary);
}
```

---

## Theme Toggle Implementation

### CSS
```css
[data-theme="dark"] {
  /* Dark mode colors */
}

[data-theme="light"] {
  /* Light mode colors */
}
```

### JavaScript
```typescript
// Get current theme
const theme = document.documentElement.getAttribute('data-theme') || 'dark';

// Toggle theme
const newTheme = theme === 'dark' ? 'light' : 'dark';
document.documentElement.setAttribute('data-theme', newTheme);
localStorage.setItem('theme', newTheme);
```

---

## Best Practices

### DO
✓ Use semantic color tokens (e.g., `--color-text-primary`)
✓ Use spacing tokens consistently
✓ Add transitions to interactive elements
✓ Use appropriate font sizes from the scale
✓ Apply hover states to clickable elements
✓ Use border radius tokens
✓ Follow the shadow hierarchy

### DON'T
✗ Use hardcoded color values
✗ Use pixel values for spacing (use tokens)
✗ Mix rem/em/px in font sizes
✗ Create custom shadows (use tokens)
✗ Skip hover states on interactive elements
✗ Use arbitrary z-index values

---

## Migration Examples

### Before (Old Style)
```css
.old-button {
  padding: 8px 12px;
  font-size: 0.875rem;
  background: #5E6AD2;
  color: white;
  border-radius: 6px;
}
```

### After (Token-Based)
```css
.new-button {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-sm);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-md);
}
```

---

## Color Values Reference

### Dark Mode (Default)
- Primary: `#5E6AD2` (purple-blue)
- Success: `#3ECF8E` (green)
- Warning: `#F5A623` (amber)
- Error: `#EF5350` (red)
- Background: `#0D0D0D` → `#1A1A1A`
- Text: `#F5F5F5` → `#666666`

### Light Mode
- Primary: `#5E6AD2` (same)
- Success: `#22C55E` (green)
- Warning: `#EAB308` (amber)
- Error: `#EF4444` (red)
- Background: `#FAFAFA` → `#FFFFFF`
- Text: `#171717` → `#737373`

---

## Helpful Tips

1. **Spacing**: Use multiples of 4 (base unit)
2. **Typography**: Stick to the defined scale
3. **Colors**: Always use semantic tokens
4. **Transitions**: Fast for hover, base for most, slow for complex
5. **Shadows**: Match elevation (sm for cards, md for modals, lg for dropdowns)
6. **Z-index**: Use the scale, avoid arbitrary values
7. **Radius**: sm for small elements, md for buttons/inputs, lg for cards

---

## Component Classes Reference

### Layout
- `.app` - Main app container
- `.header` - Fixed header (48px)
- `.main` - Main content area
- `.editor-layout` - Editor grid layout
- `.plot-layout` - Plot page layout

### Interactive
- `.btn` - Base button
- `.btn-primary` - Primary button
- `.btn-secondary` - Secondary button
- `.btn-ghost` - Ghost button
- `.form-input` - Text input
- `.form-select` - Select dropdown

### Content
- `.card` - Content card
- `.dialog` - Modal dialog
- `.tab` - Tab button
- `.layer-item` - Layer list item
- `.workflow-step` - Workflow step

---

**Quick Access**: Keep this reference handy while developing. All tokens are defined in `/frontend/src/styles/globals.css`.
