import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import RecipeCard from '../components/RecipeCard'
import type { MealType } from '../lib/db'
import { listRecipes } from '../lib/repo'

const MEAL_TYPES: (MealType | 'all')[] = ['all', 'breakfast', 'lunch', 'dinner']

export default function Recipes() {
  const [search, setSearch] = useState('')
  const [mealType, setMealType] = useState<MealType | 'all'>('all')

  const recipes = useLiveQuery(() => listRecipes(mealType === 'all' ? undefined : mealType), [mealType])

  const filtered = useMemo(() => {
    if (!recipes) return []
    const q = search.trim().toLowerCase()
    if (!q) return recipes
    return recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)),
    )
  }, [recipes, search])

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-sage-800">Recipes</h1>
        <div className="flex gap-2">
          <Link
            to="/recipes/import-url"
            className="rounded-lg border border-sage-300 px-3 py-2 text-sm font-medium text-sage-700 hover:bg-sage-50"
          >
            Add from URL
          </Link>
          <Link
            to="/recipes/new"
            className="rounded-lg bg-sage-500 px-3 py-2 text-sm font-medium text-white hover:bg-sage-600"
          >
            Add recipe
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Search by name or tag..."
          className="min-w-48 flex-1 rounded-lg border border-stone-300 px-3 py-2 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType | 'all')}
        >
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'all' ? 'All meal types' : t}
            </option>
          ))}
        </select>
      </div>

      {recipes && recipes.length === 0 && (
        <p className="mt-6 text-sage-600">
          No recipes yet.{' '}
          <Link to="/recipes/new" className="font-medium text-sage-700 underline">
            Add your first one
          </Link>{' '}
          or import from the old meal-planner skill in Settings.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  )
}
