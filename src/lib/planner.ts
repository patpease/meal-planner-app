import type { MealType, PantryItem, Recipe, Store, UserSettings } from './db'
import { listPantryItems, listRecentPlans, listRecipes, readSettings } from './repo'

export interface PlanRequest {
  breakfastCount: number
  lunchCount: number
  dinnerCount: number
  notes: string
}

export interface DraftMeal {
  mealType: MealType
  recipe: Recipe
  servings: number
  repeated: boolean
}

export interface DraftShoppingItem {
  name: string
  qty?: number
  unit?: string
  store: Store
  restock: boolean
  checked?: boolean
}

export interface DraftPlan {
  meals: DraftMeal[]
  snacks: string[]
  shoppingList: DraftShoppingItem[]
  notes: string
  autoNotes: string[]
}

export const DEFAULT_SNACKS = [
  'Greek yogurt',
  'Mixed nuts',
  'Whole fruit',
  'Hummus with veggies',
  'Hard-boiled eggs',
  'String cheese',
]

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function isPantryInStock(item: PantryItem): boolean {
  if (item.qty !== undefined) return item.qty > 0
  return item.level === 'full' || item.level === 'half'
}

function findPantryMatch(ingredientName: string, pantryItems: PantryItem[]): PantryItem | undefined {
  const key = ingredientName.trim().toLowerCase()
  if (!key) return undefined
  return pantryItems.find((p) => {
    const pLower = p.name.toLowerCase()
    return key.includes(pLower) || pLower.includes(key)
  })
}

function scoreRecipe(recipe: Recipe, pantryItems: PantryItem[]): number {
  return recipe.ingredients.reduce((score, ing) => {
    const match = findPantryMatch(ing.name, pantryItems)
    return match && isPantryInStock(match) ? score + 1 : score
  }, 0)
}

function rankCandidates(candidates: Recipe[], pantryItems: PantryItem[]): Recipe[] {
  return shuffle(candidates).sort((a, b) => scoreRecipe(b, pantryItems) - scoreRecipe(a, pantryItems))
}

/** Dinners: no repeats within the week, avoids recipes used in the last couple of weeks when possible. */
function pickDistinct(ranked: Recipe[], count: number, avoidIds: Set<number>) {
  const picked: Recipe[] = []
  const usedIds = new Set<number>()

  for (const pass of [ranked.filter((r) => !avoidIds.has(r.id)), ranked]) {
    for (const recipe of pass) {
      if (picked.length >= count) break
      if (!usedIds.has(recipe.id)) {
        picked.push(recipe)
        usedIds.add(recipe.id)
      }
    }
  }

  let repeatedFrom = picked.length
  let i = 0
  while (picked.length < count && ranked.length > 0) {
    picked.push(ranked[i % ranked.length])
    i++
  }

  return picked.map((recipe, index) => ({ recipe, repeated: index >= repeatedFrom }))
}

/** Breakfasts/lunches: repeats are expected, just avoid picking the exact same one twice in a row. */
function pickWithRepeats(ranked: Recipe[], count: number) {
  const picked: { recipe: Recipe; repeated: boolean }[] = []
  if (ranked.length === 0) return picked

  for (let i = 0; i < count; i++) {
    let candidate = ranked[i % ranked.length]
    if (picked.length > 0 && picked[picked.length - 1].recipe.id === candidate.id && ranked.length > 1) {
      candidate = ranked[(i + 1) % ranked.length]
    }
    picked.push({ recipe: candidate, repeated: i >= ranked.length })
  }
  return picked
}

function scaleQty(qty: number | undefined, recipeServings: number, targetServings: number): number | undefined {
  if (qty === undefined) return undefined
  if (!recipeServings) return qty
  return Math.round(qty * (targetServings / recipeServings) * 100) / 100
}

export function buildShoppingList(
  meals: DraftMeal[],
  pantryItems: PantryItem[],
  settings: UserSettings,
): { items: DraftShoppingItem[]; restocked: string[] } {
  const lines = new Map<string, DraftShoppingItem>()
  const restocked = new Set<string>()

  for (const meal of meals) {
    for (const ing of meal.recipe.ingredients) {
      const key = ing.name.trim().toLowerCase()
      if (!key) continue

      const match = findPantryMatch(ing.name, pantryItems)
      const needsRestock = !!match && (match.level === 'low' || match.level === 'empty')
      if (match && isPantryInStock(match) && !needsRestock) continue
      if (needsRestock) restocked.add(match!.name)

      const scaledQty = scaleQty(ing.qty, meal.recipe.servings, meal.servings)
      const store = ing.preferredStore ?? settings.storePreferences[key] ?? 'trader-joes'

      const existing = lines.get(key)
      if (existing && existing.unit === ing.unit && existing.qty !== undefined && scaledQty !== undefined) {
        existing.qty += scaledQty
      } else if (!existing) {
        lines.set(key, { name: ing.name.trim(), qty: scaledQty, unit: ing.unit, store, restock: needsRestock })
      }
    }
  }

  return { items: Array.from(lines.values()), restocked: Array.from(restocked) }
}

export async function generateDraftPlan(request: PlanRequest): Promise<DraftPlan> {
  const [allRecipes, pantryItems, settings, recentPlans] = await Promise.all([
    listRecipes(),
    listPantryItems(),
    readSettings(),
    listRecentPlans(2),
  ])

  const eligible = (mealType: MealType) =>
    allRecipes.filter((r) => r.mealType === mealType && (!settings.pregnancySafeMode || r.pregnancySafe))

  const recentDinnerIds = new Set(
    recentPlans.flatMap((p) => p.meals.filter((m) => m.mealType === 'dinner').map((m) => m.recipeId)),
  )

  const autoNotes: string[] = []
  const meals: DraftMeal[] = []

  const dinnerCandidates = eligible('dinner')
  const dinnerPicks = pickDistinct(rankCandidates(dinnerCandidates, pantryItems), request.dinnerCount, recentDinnerIds)
  if (dinnerPicks.some((p) => p.repeated)) {
    autoNotes.push(
      `Only ${dinnerCandidates.length} saved dinner recipe${dinnerCandidates.length === 1 ? '' : 's'} to choose from — some repeats were needed to fill the week. Add more dinner recipes for full variety.`,
    )
  }
  for (const { recipe, repeated } of dinnerPicks) {
    meals.push({ mealType: 'dinner', recipe, servings: settings.defaultServings, repeated })
  }

  for (const mealType of ['breakfast', 'lunch'] as const) {
    const count = mealType === 'breakfast' ? request.breakfastCount : request.lunchCount
    const candidates = eligible(mealType)
    if (candidates.length === 0 && count > 0) {
      autoNotes.push(`No saved ${mealType} recipes yet — add some to fill this slot.`)
      continue
    }
    const picks = pickWithRepeats(rankCandidates(candidates, pantryItems), count)
    for (const { recipe, repeated } of picks) {
      meals.push({ mealType, recipe, servings: settings.defaultServings, repeated })
    }
  }

  const { items: shoppingList, restocked } = buildShoppingList(meals, pantryItems, settings)
  if (restocked.length > 0) {
    autoNotes.push(`Running low on ${restocked.join(', ')} — added to the shopping list to restock.`)
  }

  return {
    meals,
    snacks: DEFAULT_SNACKS,
    shoppingList,
    notes: request.notes,
    autoNotes,
  }
}
