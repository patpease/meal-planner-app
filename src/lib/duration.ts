/** Pulls a rough timer suggestion (in minutes) out of a step's free text, e.g. "bake for 20-25 minutes". */
export function parseStepMinutes(text: string): number | undefined {
  const hourMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i)
  if (hourMatch) return Math.round(Number(hourMatch[1]) * 60)

  const minuteMatch = text.match(/(\d+)(?:\s*[-–to]+\s*\d+)?\s*(?:minutes?|mins?)\b/i)
  if (minuteMatch) return Number(minuteMatch[1])

  return undefined
}
