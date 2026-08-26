import { Accelerometer } from 'expo-sensors';

const PAUSE_SPEED_THRESHOLD = 0.6; // m/s — below this, consider pausing
const RESUME_SPEED_THRESHOLD = 1.0; // m/s — above this, resume
const ACCEL_STILL_THRESHOLD = 0.12; // g — below this, body is not moving
const PAUSE_CONFIRM_COUNT = 8; // consecutive low-speed readings before pausing (~8s at 1s interval)

let lowSpeedCount = 0;
let isPaused = false;
let latestAccelMagnitude = 0;
let subscription: { remove: () => void } | null = null;

/** Starts the accelerometer listener — call once when a recording begins. */
export function startAutoPauseTracking() {
  if (subscription) return;
  lowSpeedCount = 0;
  isPaused = false;
  Accelerometer.setUpdateInterval(1000);
  subscription = Accelerometer.addListener(({ x, y, z }) => {
    latestAccelMagnitude = Math.sqrt(x * x + y * y + z * z) - 1; // subtract gravity
  });
}

export function stopAutoPauseTracking() {
  subscription?.remove();
  subscription = null;
}

/**
 * Combines GPS speed and accelerometer magnitude to avoid the red-light
 * flicker problem — GPS speed alone bounces 0-1.2 m/s when stationary,
 * causing false pause/resume cycles in speed-only implementations.
 */
export function evaluateAutoPause(speed: number | null): 'pause' | 'resume' | null {
  const effectiveSpeed = speed ?? 0;
  const bodyIsStill = Math.abs(latestAccelMagnitude) < ACCEL_STILL_THRESHOLD;

  if (!isPaused) {
    if (effectiveSpeed < PAUSE_SPEED_THRESHOLD && bodyIsStill) {
      lowSpeedCount++;
      if (lowSpeedCount >= PAUSE_CONFIRM_COUNT) {
        isPaused = true;
        lowSpeedCount = 0;
        return 'pause';
      }
    } else {
      lowSpeedCount = 0;
    }
  } else if (effectiveSpeed > RESUME_SPEED_THRESHOLD) {
    isPaused = false;
    return 'resume';
  }

  return null;
}

export function resetAutoPauseState() {
  lowSpeedCount = 0;
  isPaused = false;
}
