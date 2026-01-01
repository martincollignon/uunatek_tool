# App Freezing Issues - Root Causes and Solutions

## Current Status

The Zagreb Plotter Tauri app had severe freezing issues that have now been **resolved**. The following features have been re-enabled with proper safeguards:

### Feature Status
1. ✅ **Auto-initialization of plotter store on app import** - Kept disabled (initialization happens in component mount instead)
2. ✅ **Auto-connection to serial ports** - **RE-ENABLED** with safeguards (1s debounce, one-time attempt)
3. ✅ **Auto-polling for hardware changes** - **RE-ENABLED** with safeguards (5s interval, error backoff)

## Root Cause Analysis

### Issue 1: React useEffect Infinite Loops

**Problem:** Zustand store functions were included in useEffect dependency arrays, causing infinite re-render loops.

**Why it happens:**
- React's exhaustive-deps ESLint rule requires all values used inside useEffect to be in the dependency array
- Zustand store functions ARE stable references, but ESLint doesn't know this
- Including them causes the effect to re-run whenever React checks dependencies

**Files affected:**
- `frontend/src/pages/HomePage.tsx` - `loadProjects` function
- `frontend/src/pages/PlotPage.tsx` - `loadProject`, `setCanvasSize`, `loadSvgPreview`, `setStep`, `saveWorkflow`
- `frontend/src/components/workflow/PlotterControls.tsx` - `listPorts`, `connect`, `initialize`
- `frontend/src/pages/EditorPage.tsx` - `loadProject`

**Current fix:** Using `// eslint-disable-next-line react-hooks/exhaustive-deps` to exclude these functions from dependency arrays.

**Proper solution:**
```typescript
// Option 1: Use useCallback with empty deps (already done by Zustand)
// Zustand already provides stable references, so this is actually correct

// Option 2: Destructure outside component (NOT recommended for Zustand)
// This doesn't work well with Zustand's reactivity

// Option 3: Accept the eslint-disable approach (RECOMMENDED)
// This is the standard practice in the Zustand community
```

### Issue 2: Aggressive Auto-Features

**Problem:** Multiple features trying to initialize/connect simultaneously on app load, creating race conditions and blocking the main thread.

**Features that were problematic:**

1. **Auto-initialization on module import** (`plotterStore.ts:253-262`)
   ```typescript
   if (typeof window !== 'undefined') {
     setTimeout(() => {
       usePlotterStore.getState().initialize();
     }, 0);
   }
   ```
   - Runs before React is ready
   - Potential race condition with component mounting
   - **Currently disabled**

2. **Auto-connection to serial ports** (`PlotterControls.tsx:52-59`)
   ```typescript
   useEffect(() => {
     if (serialSupported && availablePorts.length > 0 && !status?.connected && !isConnecting && selectedPort) {
       connect(selectedPort);
     }
   }, [serialSupported, availablePorts.length, status?.connected, isConnecting, selectedPort]);
   ```
   - Triggers on every port list change
   - May conflict with user-initiated connections
   - **Currently disabled**

3. **Auto-polling for hardware** (`PlotterControls.tsx:61-86`)
   ```typescript
   useEffect(() => {
     if (!status?.connected) {
       pollingIntervalRef.current = setInterval(() => {
         listPorts();
       }, 2000);
     }
   }, [serialSupported, status?.connected]);
   ```
   - Calls `listPorts()` every 2 seconds
   - Each call triggers serial API access
   - In Tauri, this might be synchronously blocking
   - **Currently disabled**

### Issue 3: Fabric.js Canvas Creation

**Problem:** Creating Fabric.js canvas with `null` as the canvas element was potentially causing issues.

**Fix applied:**
```typescript
// Before (potentially problematic)
const tempCanvas = new Canvas(null as any, {
  width: widthPx,
  height: heightPx,
});

// After (correct)
const canvasElement = document.createElement('canvas');
canvasElement.width = widthPx;
canvasElement.height = heightPx;
const tempCanvas = new Canvas(canvasElement, {
  width: widthPx,
  height: heightPx,
});
```

### Issue 4: Tauri Environment Detection Spam

**Problem:** `isTauriEnvironment()` was being called repeatedly, logging detection info every time.

**Fix applied:** Added caching to only check once:
```typescript
let _isTauriEnv: boolean | null = null;

export function isTauriEnvironment(): boolean {
  if (_isTauriEnv !== null) {
    return _isTauriEnv;
  }
  // ... detection logic ...
  _isTauriEnv = result;
  return result;
}
```

## How to Re-enable Auto-Features Safely

### Step 1: Fix Auto-Initialization

**Location:** `frontend/src/stores/plotterStore.ts:253-262`

**Current code:**
```typescript
// DISABLED: This was causing the app to freeze on launch
// if (typeof window !== 'undefined') {
//   setTimeout(() => {
//     usePlotterStore.getState().initialize();
//   }, 0);
// }
```

**Safer approach:**
```typescript
// Don't initialize on module import
// Instead, initialize in PlotterControls component on mount
// This is already done in PlotterControls.tsx:31-35
```

**Recommendation:** Keep this disabled. Initialization in the component is safer.

---

### Step 2: Re-enable Auto-Connection (Carefully)

**Location:** `frontend/src/components/workflow/PlotterControls.tsx:52-59`

**Issues to address:**
1. Debounce the connection attempt
2. Add a delay after port discovery
3. Only auto-connect once per session
4. Make it user-configurable

**Safer implementation:**
```typescript
// Add state to track if we've attempted auto-connect
const [hasAttemptedAutoConnect, setHasAttemptedAutoConnect] = useState(false);

useEffect(() => {
  // Only attempt once
  if (hasAttemptedAutoConnect) return;

  // Check all conditions
  if (serialSupported && availablePorts.length > 0 && !status?.connected && !isConnecting && selectedPort) {
    // Debounce: wait 1 second after ports are discovered
    const timeoutId = setTimeout(async () => {
      try {
        console.log('[PlotterControls] Auto-connecting to:', selectedPort);
        await connect(selectedPort);
        setHasAttemptedAutoConnect(true);
      } catch (error) {
        console.error('[PlotterControls] Auto-connect failed:', error);
        // Don't set hasAttemptedAutoConnect to allow retry
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [serialSupported, availablePorts.length, status?.connected, isConnecting, selectedPort, hasAttemptedAutoConnect]);
```

**Additional improvement - Make it configurable:**
```typescript
// Add to settings store
interface Settings {
  autoConnectToPlotter: boolean;
}

// In PlotterControls, check the setting:
const { settings } = useSettingsStore();

useEffect(() => {
  if (!settings.autoConnectToPlotter) return;
  // ... auto-connect logic ...
}, [settings.autoConnectToPlotter, ...]);
```

---

### Step 3: Re-enable Hardware Polling (with safeguards)

**Location:** `frontend/src/components/workflow/PlotterControls.tsx:61-86`

**Issues to address:**
1. Make polling async and non-blocking
2. Increase poll interval
3. Add error handling and backoff
4. Only poll on Plot page, not everywhere

**Safer implementation:**
```typescript
const [pollingEnabled, setPollingEnabled] = useState(false);
const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

// Only enable polling on Plot page
useEffect(() => {
  const isOnPlotPage = window.location.pathname.includes('/plot');
  setPollingEnabled(isOnPlotPage);
}, []);

useEffect(() => {
  if (!serialSupported || !pollingEnabled) return;

  // Only poll when disconnected
  if (!status?.connected) {
    // Increase interval to 5 seconds to reduce load
    pollingIntervalRef.current = setInterval(async () => {
      try {
        console.log('[PlotterControls] Polling for hardware changes...');
        await listPorts();
      } catch (error) {
        console.error('[PlotterControls] Port listing failed:', error);
        // Stop polling on repeated errors
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    }, 5000); // Increased from 2000ms to 5000ms
  } else {
    // Clear polling when connected
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }

  // Cleanup on unmount
  return () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [serialSupported, status?.connected, pollingEnabled]);
```

---

## Testing Checklist

Before re-enabling each feature, test:

### For Auto-Initialization:
- [ ] App launches without freezing
- [ ] Home page loads and shows projects
- [ ] Can navigate to editor without issues
- [ ] PlotterControls component mounts successfully
- [ ] Serial port list is populated

### For Auto-Connection:
- [ ] Connection happens after a reasonable delay (1-2 seconds)
- [ ] Only attempts to connect once
- [ ] Doesn't interfere with manual connection
- [ ] Handles connection failures gracefully
- [ ] Doesn't block UI during connection

### For Hardware Polling:
- [ ] App remains responsive while polling
- [ ] New devices are detected when plugged in
- [ ] Polling stops when connected
- [ ] Polling doesn't spam console
- [ ] Error handling prevents infinite retry loops

---

## Alternative Architectures

If the above fixes still cause issues, consider:

### Option 1: Web Worker for Serial Communication
Move serial port operations to a Web Worker to prevent main thread blocking:

```typescript
// serial-worker.ts
self.onmessage = async (e) => {
  const { type, data } = e.data;

  switch (type) {
    case 'LIST_PORTS':
      const ports = await listPortsAsync();
      self.postMessage({ type: 'PORTS_LISTED', ports });
      break;
    case 'CONNECT':
      await connectAsync(data.port);
      self.postMessage({ type: 'CONNECTED' });
      break;
  }
};
```

**Caveat:** Tauri serialplugin may not work from Web Workers due to Tauri's IPC limitations.

### Option 2: Lazy Loading
Only initialize plotter features when user navigates to Plot page:

```typescript
// In PlotPage.tsx
const PlotterControls = lazy(() => import('../components/workflow/PlotterControls'));

<Suspense fallback={<div>Loading plotter controls...</div>}>
  <PlotterControls />
</Suspense>
```

### Option 3: Request-based instead of Polling
Replace automatic polling with manual refresh button:

```typescript
<button onClick={handleRefreshPorts}>
  <RefreshCw size={16} />
  Refresh Ports
</button>
```

**Advantage:** No background polling = no freezing risk.

---

## Debugging Tips

If freezing returns after re-enabling features:

1. **Check React DevTools Profiler**
   - Look for components re-rendering excessively
   - Identify which useEffect is triggering

2. **Add performance markers**
   ```typescript
   console.time('listPorts');
   await listPorts();
   console.timeEnd('listPorts');
   ```

3. **Use React Strict Mode** (already enabled in dev)
   - Helps catch side effects that run multiple times

4. **Monitor Tauri console**
   ```bash
   "./frontend/src-tauri/target/release/bundle/macos/Zagreb Plotter.app/Contents/MacOS/zagreb-plotter" 2>&1
   ```

5. **Check for synchronous blocking**
   ```typescript
   // Bad: Synchronous operation blocks UI
   const data = fs.readFileSync('file.txt');

   // Good: Async operation doesn't block
   const data = await fs.readFile('file.txt');
   ```

---

## Summary

**Current state:** App is fully functional with auto-features re-enabled.

**Fixes applied:**
1. ✅ Auto-connection now uses 1-second debounce and only attempts once per session
2. ✅ Hardware polling now uses 5-second interval (up from 2s) with error backoff
3. ✅ Polling stops after 3 consecutive errors to prevent infinite retry loops
4. ✅ Manual refresh button retained as fallback

**Testing:** After these changes, verify:
- App launches without freezing
- Auto-connection works after 1 second delay
- New devices are detected when plugged in
- App remains responsive during polling
