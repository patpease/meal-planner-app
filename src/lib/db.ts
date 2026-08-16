import Dexie, { type EntityTable } from 'dexie'

export type MealType = 'breakfast' | 'lunch' | 'dinner'
export type PantryLevel = 'full' | 'half' | 'low' | 'empty'
export type Store = 'trader-joes' | 'whole-foods'

export interface Ingredient {
  name: string
  qty?: number
  unit?: string
  preferredStore?: Store
}

export interface Recipe {
  id: number
  name: string
  mealType: MealType
  pro: string
  base: string
  veg: string
  engine: string
  ingredients: Ingredient[]
  steps: string[]
  prepMinutes: number
  servings: number
  tags: string[]
  pregnancySafe: boolean
  photoIds: number[]
  source?: string
  savedDate: string
}

export interface PantryItem {
  id: number
  name: string
  level?: PantryLevel
  qty?: number
  unit?: string
  icon?: string
  updatedDate: string
}

export interface Photo {
  id: number
  recipeId: number
  blob: Blob
}

export interface UserSettings {
  id: number
  pregnancySafeMode: boolean
  defaultServings: number
  storePreferences: Record<string, Store>
}

const db = new Dexie('meal-planner') as Dexie & {
  recipes: EntityTable<Recipe, 'id'>
  pantryItems: EntityTable<PantryItem, 'id'>
  photos: EntityTable<Photo, 'id'>
  settings: EntityTable<UserSettings, 'id'>
}

db.version(1).stores({
  recipes: '++id, name, mealType, prepMinutes, *tags',
  pantryItems: '++id, &name, level',
  photos: '++id, recipeId',
  settings: '++id',
})

export default db
