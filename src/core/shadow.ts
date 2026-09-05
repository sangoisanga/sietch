export const DEFAULT_SHADOW_PACE = 1.15
export const SHADOW_PACE_CHOICES = [1.15, 1.5, 2, 2.5]

const MS_PER_CHARACTER_AT_DEFAULT = 70

export function shadowGapMs(durationSeconds: number, rate: number, pace: number): number {
  return durationSeconds / rate * pace * 1000
}

// no clip to measure, so the gap is guessed from length and scaled by the same pace
export function estimatedShadowGapMs(text: string, pace: number): number {
  return text.length * MS_PER_CHARACTER_AT_DEFAULT * (pace / DEFAULT_SHADOW_PACE)
}
