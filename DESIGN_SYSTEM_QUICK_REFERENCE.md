# Design System Quick Reference

## Color Tokens (Dark Mode)

### Backgrounds
```css
--color-bg-primary: #0D0D0D      /* Main app background */
--color-bg-secondary: #111111    /* Secondary surfaces */
--color-bg-tertiary: #1C1C1C     /* Cards, panels */
--color-bg-hover: #252525        /* Hover states */
--color-bg-active: #2A2A2A       /* Active states */
```

### Borders
```css
--color-border-primary: #333333     /* Main borders */
--color-border-secondary: #282828   /* Subtle borders */
--color-border-focus: #404040       /* Focus borders */
```

### Text
```css
--color-text-primary: #F5F5F5      /* 15.8:1 contrast - Headers, primary content */
--color-text-secondary: #B0B0B0    /* 7.2:1 contrast - Labels, secondary content */
--color-text-tertiary: #707070     /* 4.6:1 contrast - Placeholders, hints */
--color-text-disabled: #4A4A4A     /* Disabled states */
```

### Interactive
```css
--color-primary: #5E6AD2           /* Primary actions */
--color-primary-hover: #4C56C4     /* Hover state */
--color-primary-active: #3E47A8    /* Active/pressed state */
--color-primary-subtle: rgba(94, 106, 210, 0.1)  /* Backgrounds */

--color-interactive-hover: rgba(255, 255, 255, 0.05)   /* Generic hover */
--color-interactive-active: rgba(255, 255, 255, 0.08)  /* Generic active */
--color-focus-ring: rgba(94, 106, 210, 0.4)            /* Focus outlines */
```

### Status
```css
--color-success: #3ECF8E          /* Success states, confirmations */
--color-warning: #F5A623          /* Warnings, cautions */
--color-error: #EF5350            /* Errors, destructive actions */
```

## Spacing Scale (4px base)

```css
--spacing-0: 0px
--spacing-0.5: 2px
--spacing-1: 4px
--spacing-1.5: 6px
--spacing-2: 8px
--spacing-2.5: 10px
--spacing-3: 12px
--spacing-4: 16px
--spacing-5: 20px
--spacing-6: 24px
--spacing-8: 32px
--spacing-10: 40px
--spacing-12: 48px
```

## Typography

```css
/* Font Sizes */
--font-size-xs: 11px      /* Small labels, captions */
--font-size-sm: 12px      /* UI text, form labels */
--font-size-base: 13px    /* Body text */
--font-size-md: 14px      /* Emphasized body */
--font-size-lg: 16px      /* Headings */
--font-size-xl: 18px      /* Large headings */
--font-size-2xl: 22px     /* Page titles */

/* Font Weights */
--font-weight-normal: 400
--font-weight-medium: 500
--font-weight-semibold: 600
```

## Border Radius

```css
--radius-sm: 4px     /* Small elements */
--radius-md: 6px     /* Inputs, buttons */
--radius-lg: 8px     /* Cards, panels */
--radius-xl: 12px    /* Modals, large cards */
--radius-full: 9999px /* Circles, pills */
```

## Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)
--shadow-glow: 0 0 20px rgba(94, 106, 210, 0.3)
```

## Transitions

```css
--transition-fast: 100ms     /* Quick interactions */
--transition-base: 150ms     /* Standard transitions */
--transition-slow: 200ms     /* Deliberate transitions */
--transition-slower: 300ms   /* Animations */
```

## Utility Classes

### Layout
```css
.flex              /* display: flex */
.flex-col          /* flex-direction: column */
.flex-1            /* flex: 1 */
.flex-shrink-0     /* flex-shrink: 0 */
.grid              /* display: grid */
.relative          /* position: relative */
.absolute          /* position: absolute */
```

### Alignment
```css
.items-center      /* align-items: center */
.items-start       /* align-items: flex-start */
.items-end         /* align-items: flex-end */
.justify-between   /* justify-content: space-between */
.justify-center    /* justify-content: center */
```

### Sizing
```css
.w-full            /* width: 100% */
.h-full            /* height: 100% */
```

### Spacing
```css
.gap-2             /* gap: 8px */
.gap-4             /* gap: 16px */
.m-0, .p-0         /* margin/padding: 0 */
.mt-1, .mt-2, .mt-4   /* margin-top */
.mb-1, .mb-2, .mb-4   /* margin-bottom */
.ml-2, .mr-2          /* margin-left/right */
.p-2, .p-4            /* padding */
```

### Text
```css
.text-center       /* text-align: center */
.text-left         /* text-align: left */
.text-right        /* text-align: right */
```

### Overflow
```css
.overflow-hidden   /* overflow: hidden */
.overflow-auto     /* overflow: auto */
```

### Interaction
```css
.cursor-pointer    /* cursor: pointer */
.pointer-events-none  /* pointer-events: none */
.select-none       /* user-select: none */
```

### States
```css
.skeleton          /* Loading placeholder with pulse animation */
.loading           /* Disabled state with reduced opacity */
.animate-spin      /* Rotating animation for spinners */
```

## Component Classes

### Buttons
```css
.btn               /* Base button */
.btn-primary       /* Primary action button */
.btn-secondary     /* Secondary button */
.btn-ghost         /* Transparent button */
.btn-danger        /* Destructive action */
.btn-icon          /* Icon-only button */
.btn-sm            /* Small button (24px) */
.btn-lg            /* Large button (40px) */
```

### Cards
```css
.card              /* Base card with hover lift */
.card-header       /* Card header section */
.card-title        /* Card title */
.card-description  /* Card description */
```

### Forms
```css
.form-group        /* Form field container */
.form-label        /* Form label */
.form-input        /* Text input */
.form-select       /* Select dropdown */
.form-textarea     /* Textarea */
```

### Status
```css
.status-dot        /* Status indicator dot */
.status-connected  /* Connected status (green) */
.status-disconnected  /* Disconnected status (red) */
.status-warning    /* Warning status (yellow) */
```

### Toasts
```css
.toast             /* Base toast notification */
.toast-success     /* Success toast (green border) */
.toast-error       /* Error toast (red border) */
.toast-warning     /* Warning toast (yellow border) */
.toast-info        /* Info toast (blue border) */
```

## Usage Examples

### Creating a Card
```jsx
<div className="card">
  <div className="card-header">
    <h3 className="card-title">Settings</h3>
    <p className="card-description">Manage your preferences</p>
  </div>
  <div className="card-body">
    {/* Content */}
  </div>
</div>
```

### Button Group
```jsx
<div className="flex gap-2">
  <button className="btn btn-primary">Save</button>
  <button className="btn btn-secondary">Cancel</button>
</div>
```

### Form Field
```jsx
<div className="form-group">
  <label className="form-label">Name</label>
  <input 
    type="text" 
    className="form-input"
    placeholder="Enter your name"
  />
</div>
```

### Toast Notification (Future Implementation)
```jsx
<div className="toast toast-success">
  <p>Settings saved successfully!</p>
</div>
```

### Loading Skeleton
```jsx
<div className="skeleton" style={{ width: '100%', height: '20px' }} />
```

## Best Practices

1. **Always use design tokens** instead of hardcoded values
2. **Prefer utility classes** over inline styles
3. **Use semantic color names** (e.g., `--color-text-secondary` not `--color-gray`)
4. **Maintain contrast ratios** of at least 4.5:1 for normal text, 3:1 for large text
5. **Test focus states** for keyboard navigation
6. **Animate with purpose** - use faster transitions for micro-interactions
7. **Layer shadows appropriately** - sm for subtle, xl for modals
8. **Keep hover feedback subtle** - small transforms and color changes

## Accessibility Guidelines

- All text must meet WCAG AA contrast requirements (4.5:1 for normal, 3:1 for large)
- Focus states must be clearly visible (we use 4px focus rings)
- Interactive elements should have hover and active states
- Use semantic HTML and ARIA labels where appropriate
- Test with keyboard navigation (Tab, Enter, Escape)
- Verify with screen readers

## Z-Index Scale

```css
--z-dropdown: 100    /* Dropdowns, tooltips */
--z-sticky: 200      /* Sticky headers */
--z-modal: 1000      /* Modal dialogs */
--z-tooltip: 1100    /* Tooltips */
--z-toast: 1200      /* Toast notifications (highest) */
```
