/**
 * Haptic Feedback Utilities
 *
 * Provides haptic feedback for touch interactions on mobile devices.
 * Uses the Vibration API which is supported on most modern mobile browsers.
 */

export type HapticIntensity = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const hapticPatterns: Record<HapticIntensity, number | number[]> = {
  light: 10,       // Quick tap
  medium: 20,      // Button press
  heavy: 40,       // Important action
  success: [10, 50, 10],  // Double tap pattern
  warning: [20, 100, 20], // Alert pattern
  error: [30, 100, 30, 100, 30], // Error pattern
};

/**
 * Checks if haptic feedback is supported by the device
 */
export const isHapticSupported = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * Trigger haptic feedback with specified intensity
 */
export const triggerHaptic = (intensity: HapticIntensity = 'medium'): void => {
  if (!isHapticSupported()) {
    return;
  }

  try {
    const pattern = hapticPatterns[intensity];
    navigator.vibrate(pattern);
  } catch (error) {
    // Silently fail - haptic feedback is a nice-to-have
    console.debug('Haptic feedback failed:', error);
  }
};

/**
 * Cancel any ongoing vibration
 */
export const cancelHaptic = (): void => {
  if (!isHapticSupported()) {
    return;
  }

  try {
    navigator.vibrate(0);
  } catch (error) {
    console.debug('Cancel haptic failed:', error);
  }
};

/**
 * React hook for haptic feedback
 */
export const useHaptic = () => {
  const haptic = (intensity: HapticIntensity = 'medium') => {
    triggerHaptic(intensity);
  };

  return {
    haptic,
    isSupported: isHapticSupported(),
    cancel: cancelHaptic,
  };
};

/**
 * Common haptic feedback patterns for UI interactions
 */
export const hapticFeedback = {
  // Button interactions
  buttonTap: () => triggerHaptic('light'),
  buttonPress: () => triggerHaptic('medium'),

  // Navigation
  navigation: () => triggerHaptic('light'),
  tabSwitch: () => triggerHaptic('light'),

  // Form interactions
  inputFocus: () => triggerHaptic('light'),
  toggleSwitch: () => triggerHaptic('medium'),
  slider: () => triggerHaptic('light'),

  // Feedback
  success: () => triggerHaptic('success'),
  warning: () => triggerHaptic('warning'),
  error: () => triggerHaptic('error'),

  // Betting actions
  selectOutcome: () => triggerHaptic('medium'),
  placeBet: () => triggerHaptic('heavy'),
  betConfirmed: () => triggerHaptic('success'),
  betFailed: () => triggerHaptic('error'),

  // Pull to refresh
  refreshStart: () => triggerHaptic('light'),
  refreshTriggered: () => triggerHaptic('medium'),

  // Swipe gestures
  swipeStart: () => triggerHaptic('light'),
  swipeComplete: () => triggerHaptic('medium'),
};
