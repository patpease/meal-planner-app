import { useState } from 'react'
import { PEASE_URL, sendToPease, type SendResult } from '../lib/sendToPease'

/** Settings card: move this phone's recipes, photos and pantry into Pease Meals. */
export default function SendToPease() {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SendResult | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await sendToPease(code.replace(/\D/g, ''), setProgress))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <form onSubmit={send} className="rounded-xl border border-sage-300 bg-sage-50 p-4">
      <span className="block font-medium text-sage-800">Send to Pease Meals</span>
      <span className="block text-sm text-sage-600">
        Moves your recipes, photos, pantry, store choices and meals marked eaten to the new app. Nothing here is
        deleted. In Pease Meals, go to <b>Settings → Bring over the old app → Show a transfer code</b>.
      </span>
      {result ? (
        <div className="mt-3 rounded-lg bg-white p-3 text-sm text-sage-800" role="status">
          <p className="font-medium">Done! Open Pease Meals to see them.</p>
          <p>
            {result.recipes_added} recipe{result.recipes_added === 1 ? '' : 's'} added
            {result.recipes_skipped ? ` (${result.recipes_skipped} already there)` : ''}, {result.photos} photo
            {result.photos === 1 ? '' : 's'}, {result.pantry_items} pantry item{result.pantry_items === 1 ? '' : 's'},{' '}
            {result.meals_logged} meal{result.meals_logged === 1 ? '' : 's'} logged.
          </p>
          <a href={PEASE_URL} className="mt-2 inline-block font-medium text-sage-700 underline">
            Open Pease Meals
          </a>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            className="w-32 rounded-lg border border-stone-300 px-3 py-2 tracking-widest"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Transfer code"
            maxLength={7}
          />
          <button
            className="rounded-lg bg-sage-500 px-4 py-2 font-medium text-white hover:bg-sage-600 disabled:opacity-50"
            disabled={busy || code.replace(/\D/g, '').length !== 6}
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
      {progress && <p className="mt-2 text-sm text-sage-600" role="status">{progress}</p>}
      {error && <p className="mt-2 text-sm font-medium text-red-700" role="alert">{error}</p>}
    </form>
  )
}
