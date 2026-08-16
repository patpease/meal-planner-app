import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAndParseRecipeUrl } from '../lib/recipeUrlImport'

export default function RecipeUrlImport() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const draft = await fetchAndParseRecipeUrl(url.trim())
      navigate('/recipes/new', {
        state: {
          draft: {
            name: draft.name,
            ingredients: draft.ingredients.map((name) => ({ name })),
            steps: draft.steps,
            prepMinutes: draft.prepMinutes,
            servings: draft.servings,
            source: draft.source,
            imageUrl: draft.imageUrl,
          },
        },
      })
    } catch {
      setError(
        "Couldn't read a recipe from that page. Many sites block this kind of direct fetch from a browser — " +
          'paste the details in manually instead, or try a different source.',
      )
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold text-sage-800">Add recipe from URL</h1>
      <p className="mt-2 max-w-md text-sage-600">
        Paste a link to a recipe page. We&apos;ll try to read its ingredients and steps automatically —
        you&apos;ll get a chance to review and edit before saving.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex max-w-xl gap-2">
        <input
          type="url"
          required
          placeholder="https://..."
          className="input flex-1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-lg bg-sage-600 px-4 py-2 text-sm font-medium text-white hover:bg-sage-700 disabled:opacity-50"
        >
          {loading ? 'Fetching...' : 'Fetch'}
        </button>
      </form>

      {error && <p className="mt-3 max-w-xl text-sm text-amber-700">{error}</p>}
    </div>
  )
}
