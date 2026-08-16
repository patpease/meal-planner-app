import { Link } from 'react-router-dom'
import type { Recipe } from '../lib/db'
import { usePhotoUrl } from '../lib/usePhotoUrl'

const MEAL_TYPE_LABEL: Record<Recipe['mealType'], string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const photoUrl = usePhotoUrl(recipe.photoIds[0])

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="block overflow-hidden rounded-xl border border-stone-200 bg-white transition-shadow hover:shadow-md"
    >
      <div className="flex h-32 items-center justify-center bg-sage-100">
        {photoUrl ? (
          <img src={photoUrl} alt={recipe.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm text-sage-400">No photo</span>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sage-800">{recipe.name}</h3>
        <p className="mt-1 text-xs text-sage-500">
          {MEAL_TYPE_LABEL[recipe.mealType]} · {recipe.prepMinutes} min · serves {recipe.servings}
        </p>
        {recipe.tags.length > 0 && (
          <p className="mt-1 truncate text-xs text-sage-400">{recipe.tags.join(', ')}</p>
        )}
      </div>
    </Link>
  )
}
