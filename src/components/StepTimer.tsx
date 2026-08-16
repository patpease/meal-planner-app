import { useEffect, useRef, useState } from 'react'

function playChime() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.2, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
    osc.start()
    osc.stop(ctx.currentTime + 0.8)
  } catch {
    // Audio isn't available in every context — silently skip the chime.
  }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200])
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function StepTimer({ suggestedMinutes }: { suggestedMinutes?: number }) {
  const [minutes, setMinutes] = useState(suggestedMinutes ?? 5)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    setMinutes(suggestedMinutes ?? 5)
    setSecondsLeft(null)
    setRunning(false)
  }, [suggestedMinutes])

  useEffect(() => {
    if (!running) return
    intervalRef.current = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return prev
        if (prev <= 1) {
          setRunning(false)
          playChime()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current)
    }
  }, [running])

  function start() {
    if (secondsLeft === null || secondsLeft === 0) setSecondsLeft(minutes * 60)
    setRunning(true)
  }

  function pause() {
    setRunning(false)
  }

  function reset() {
    setRunning(false)
    setSecondsLeft(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3">
      {secondsLeft === null ? (
        <label className="flex items-center gap-2 text-sm text-sage-700">
          Timer
          <input
            type="number"
            min={1}
            className="w-16 rounded-lg border border-stone-300 px-2 py-1"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value) || 1)}
          />
          min
        </label>
      ) : (
        <span className="font-mono text-2xl tabular-nums text-sage-800">{formatTime(secondsLeft)}</span>
      )}

      {!running ? (
        <button
          type="button"
          onClick={start}
          className="rounded-lg bg-sage-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-sage-600"
        >
          {secondsLeft ? 'Resume' : 'Start'}
        </button>
      ) : (
        <button
          type="button"
          onClick={pause}
          className="rounded-lg bg-sage-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-sage-600"
        >
          Pause
        </button>
      )}
      {secondsLeft !== null && (
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-sage-700"
        >
          Reset
        </button>
      )}
    </div>
  )
}
