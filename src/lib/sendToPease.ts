import db from './db'

/** The new app. The transfer code from its Settings is the only permission this needs. */
export const PEASE_URL = 'https://meals.peasestudio.com'

export interface SendResult {
  recipes_added: number
  recipes_skipped: number
  meals_logged: number
  pantry_items: number
  photos: number
}

async function call<T>(path: string, code: string, init: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(PEASE_URL + path, { ...init, headers: { ...(init.headers ?? {}), 'X-Transfer-Code': code } })
  } catch {
    throw new Error('Couldn’t reach Pease Meals. Check your signal and try again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `Pease Meals said no (error ${res.status})`)
  return data as T
}

/**
 * Sends everything on this phone to Pease Meals: photos one at a time, then
 * recipes, pantry, store choices and meals marked eaten. Nothing here is
 * changed or deleted. Safe to repeat: Pease Meals skips recipes it already has.
 */
export async function sendToPease(code: string, onProgress: (msg: string) => void): Promise<SendResult> {
  const [recipes, pantry, settings, plans] = await Promise.all([
    db.recipes.toArray(),
    db.pantryItems.toArray(),
    db.settings.toArray(),
    db.weeklyPlans.toArray(),
  ])

  const photoKeys: Record<string, string[]> = {}
  const photoIds = recipes.flatMap((r) => r.photoIds.map((pid) => [r.id, pid] as const))
  let sent = 0
  for (const [recipeId, photoId] of photoIds) {
    onProgress(`Sending photos… ${sent + 1} of ${photoIds.length}`)
    const photo = await db.photos.get(photoId)
    if (!photo?.blob) continue
    const { key } = await call<{ key: string }>('/api/transfer/photo', code, {
      method: 'PUT',
      headers: { 'Content-Type': photo.blob.type || 'image/jpeg' },
      body: photo.blob,
    })
    ;(photoKeys[String(recipeId)] ??= []).push(key)
    sent++
  }

  onProgress(`Sending ${recipes.length} recipes and ${pantry.length} pantry items…`)
  const result = await call<Omit<SendResult, 'photos'>>('/api/transfer/finish', code, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app: 'meal-planner-v1',
      recipes: recipes.map((r) => ({
        id: r.id,
        name: r.name,
        mealType: r.mealType,
        ingredients: r.ingredients,
        steps: r.steps,
        prepMinutes: r.prepMinutes,
        servings: r.servings,
        tags: r.tags,
        source: r.source,
        savedDate: r.savedDate,
      })),
      photoKeys,
      pantry: pantry.map((p) => ({ name: p.name, level: p.level, qty: p.qty, unit: p.unit, icon: p.icon })),
      storePreferences: settings[0]?.storePreferences ?? {},
      plans: plans.map((p) => ({ weekStart: p.weekStart, meals: p.meals.map((m) => ({ mealType: m.mealType, recipeId: m.recipeId, completed: m.completed })) })),
    }),
  })
  return { ...result, photos: sent }
}
