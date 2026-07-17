export const DANCER_FRAME_COUNT = 16
export const DANCER_FPS = 12
export const DANCER_LOOP_MS = 4_000
export const DANCER_TAP_WINDOW_MS = 600

export type DancerInterval = { left: number; right: number }

// Each frame has six horizontal silhouette bands. Values are normalized to
// the copy column, keeping the geometry deterministic on every viewport.
const BASE_PROFILES: readonly (readonly DancerInterval[])[] = [
  [{left:.39,right:.61},{left:.31,right:.69},{left:.27,right:.73},{left:.29,right:.71},{left:.36,right:.64},{left:.42,right:.58}],
  [{left:.42,right:.60},{left:.34,right:.66},{left:.29,right:.70},{left:.32,right:.69},{left:.40,right:.66},{left:.45,right:.72}],
  [{left:.40,right:.60},{left:.32,right:.68},{left:.25,right:.75},{left:.29,right:.71},{left:.34,right:.66},{left:.39,right:.61}],
  [{left:.38,right:.62},{left:.29,right:.71},{left:.25,right:.74},{left:.31,right:.69},{left:.40,right:.65},{left:.47,right:.59}],
]

export function dancerFrameAt(elapsedMs: number, reducedMotion = false): number {
  if (reducedMotion || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0
  return Math.floor(elapsedMs / (1000 / DANCER_FPS)) % DANCER_FRAME_COUNT
}

export function dancerProfile(frame: number): readonly DancerInterval[] {
  const safeFrame = Number.isFinite(frame) ? Math.max(0, Math.floor(frame)) : 0
  const base = BASE_PROFILES[safeFrame % BASE_PROFILES.length]
  const drift = ((safeFrame % 8) - 3.5) * .008
  return base.map(({ left, right }) => ({ left: left + drift, right: right + drift }))
}

export function spriteTransform(frame: number): string {
  const safe = ((Math.floor(frame) % DANCER_FRAME_COUNT) + DANCER_FRAME_COUNT) % DANCER_FRAME_COUNT
  return `translate(${-25 * (safe % 4)}%, ${-25 * Math.floor(safe / 4)}%)`
}

export function createTapSequenceArbiter(
  onWin: () => void,
  requiredTaps = 2,
  windowMs = DANCER_TAP_WINDOW_MS,
  now: () => number = Date.now,
) {
  let tapCount = 0
  let lastTapAt = Number.NEGATIVE_INFINITY
  return {
    tap() {
      const tappedAt = now()
      tapCount = tappedAt - lastTapAt <= windowMs ? tapCount + 1 : 1
      lastTapAt = tappedAt
      if (tapCount < requiredTaps) return false
      tapCount = 0
      lastTapAt = Number.NEGATIVE_INFINITY
      onWin()
      return true
    },
    dispose() {
      tapCount = 0
      lastTapAt = Number.NEGATIVE_INFINITY
    },
  }
}
