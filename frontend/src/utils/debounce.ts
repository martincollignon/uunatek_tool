/**
 * Debounce utility functions
 *
 * Creates debounced versions of functions to improve performance by
 * limiting how often they can be called.
 */

/**
 * Create a debounced function that delays invoking the provided function
 * until after the specified delay has elapsed since the last time it was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Recommended debounce delays for common UI interactions
 */
export const DEBOUNCE_DELAYS = {
  COLOR_PICKER: 100,    // Fast feedback for color changes
  SLIDER: 150,          // Smooth slider interaction
  TEXT_INPUT: 300,      // Typical typing speed
  RESIZE: 150,          // Window/element resize
  SCROLL: 150,          // Scroll events
  SEARCH: 300,          // Search input
} as const;
