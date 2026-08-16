import db, {
  type MealType,
  type Recipe,
  type PantryItem,
  type Photo,
  type UserSettings,
} from './db'

const SETTINGS_ID = 1

function defaultSettings(): UserSettings {
  return {
    id: SETTINGS_ID,
    pregnancySafeMode: true,
    defaultServings: 2,
    storePreferences: {},
  }
}

/** Read-only — safe to call from useLiveQuery. Never writes, so it can't throw ReadOnlyError. */
export async function readSettings(): Promise<UserSettings> {
  const existing = await db.settings.get(SETTINGS_ID)
  return existing ?? defaultSettings()
}

/** Ensures the settings row exists. Call once on app startup, outside any liveQuery. */
export async function ensureSettingsSeeded() {
  const existing = await db.settings.get(SETTINGS_ID)
  if (!existing) await db.settings.put(defaultSettings())
}

export async function updateSettings(patch: Partial<Omit<UserSettings, 'id'>>) {
  const current = await readSettings()
  await db.settings.put({ ...current, ...patch, id: SETTINGS_ID })
}

export async function setStorePreference(ingredientName: string, store: UserSettings['storePreferences'][string]) {
  const current = await readSettings()
  await db.settings.put({
    ...current,
    storePreferences: { ...current.storePreferences, [ingredientName.toLowerCase()]: store },
  })
}

export function listRecipes(mealType?: MealType) {
  return mealType
    ? db.recipes.where('mealType').equals(mealType).toArray()
    : db.recipes.toArray()
}

export function getRecipe(id: number) {
  return db.recipes.get(id)
}

export function addRecipe(recipe: Omit<Recipe, 'id'>) {
  return db.recipes.add(recipe as Recipe)
}

export function updateRecipe(id: number, patch: Partial<Omit<Recipe, 'id'>>) {
  return db.recipes.update(id, patch)
}

export async function deleteRecipe(id: number) {
  await db.photos.where('recipeId').equals(id).delete()
  await db.recipes.delete(id)
}

export function listPantryItems() {
  return db.pantryItems.orderBy('name').toArray()
}

export async function upsertPantryItem(item: Omit<PantryItem, 'id'>) {
  const existing = await db.pantryItems.where('name').equalsIgnoreCase(item.name).first()
  if (existing) {
    await db.pantryItems.update(existing.id, { ...item })
    return existing.id
  }
  return db.pantryItems.add(item as PantryItem)
}

export function deletePantryItem(id: number) {
  return db.pantryItems.delete(id)
}

export async function addPhoto(recipeId: number, blob: Blob) {
  const id = await db.photos.add({ recipeId, blob } as Photo)
  await db.recipes
    .where('id')
    .equals(recipeId)
    .modify((recipe) => {
      recipe.photoIds = [...recipe.photoIds, id as number]
    })
  return id
}

export function getPhoto(id: number) {
  return db.photos.get(id)
}

export async function bulkImportRecipes(recipes: Omit<Recipe, 'id'>[]) {
  return db.recipes.bulkAdd(recipes as Recipe[])
}

export async function bulkImportPantryItems(items: Omit<PantryItem, 'id'>[]) {
  for (const item of items) {
    await upsertPantryItem(item)
  }
}
