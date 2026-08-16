import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import type { Ingredient, MealType, Recipe, Store } from '../lib/db'
import { compressImage } from '../lib/image'
import { fetchImageBlob } from '../lib/recipeUrlImport'
import { addPhoto, addRecipe, getPhoto, getRecipe, readSettings, removePhoto, updateRecipe } from '../lib/repo'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']
const STORES: Store[] = ['trader-joes', 'whole-foods']
const STORE_LABEL: Record<Store, string> = { 'trader-joes': "Trader Joe's", 'whole-foods': 'Whole Foods' }

interface Draft {
  name?: string
  ingredients?: Ingredient[]
  steps?: string[]
  prepMinutes?: number
  servings?: number
  source?: string
  imageUrl?: string
}

interface FormState {
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
  tags: string
  pregnancySafe: boolean
  source: string
}

function emptyForm(defaultServings: number, draft?: Draft): FormState {
  return {
    name: draft?.name ?? '',
    mealType: 'dinner',
    pro: '',
    base: '',
    veg: '',
    engine: '',
    ingredients: draft?.ingredients ?? [{ name: '' }],
    steps: draft?.steps ?? [''],
    prepMinutes: draft?.prepMinutes ?? 15,
    servings: draft?.servings ?? defaultServings,
    tags: '',
    pregnancySafe: true,
    source: draft?.source ?? '',
  }
}

function recipeToForm(recipe: Recipe): FormState {
  return {
    name: recipe.name,
    mealType: recipe.mealType,
    pro: recipe.pro,
    base: recipe.base,
    veg: recipe.veg,
    engine: recipe.engine,
    ingredients: recipe.ingredients.length > 0 ? recipe.ingredients : [{ name: '' }],
    steps: recipe.steps.length > 0 ? recipe.steps : [''],
    prepMinutes: recipe.prepMinutes,
    servings: recipe.servings,
    tags: recipe.tags.join(', '),
    pregnancySafe: recipe.pregnancySafe,
    source: recipe.source ?? '',
  }
}

export default function RecipeForm() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id !== undefined
  const recipeId = isEdit ? Number(id) : undefined
  const navigate = useNavigate()
  const location = useLocation()
  const draft = (location.state as { draft?: Draft } | null)?.draft

  const settings = useLiveQuery(readSettings, [], undefined)
  const existingRecipe = useLiveQuery(
    () => (recipeId !== undefined ? getRecipe(recipeId) : undefined),
    [recipeId],
  )

  const [form, setForm] = useState<FormState | null>(null)
  const [existingPhotoIds, setExistingPhotoIds] = useState<number[]>([])
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (form || settings === undefined) return
    if (isEdit) {
      if (existingRecipe) {
        setForm(recipeToForm(existingRecipe))
        setExistingPhotoIds(existingRecipe.photoIds)
      }
    } else {
      setForm(emptyForm(settings.defaultServings, draft))
    }
  }, [form, settings, isEdit, existingRecipe, draft])

  // Best-effort: pull in the source image from a URL import. Silently does nothing if blocked.
  useEffect(() => {
    if (!draft?.imageUrl) return
    fetchImageBlob(draft.imageUrl).then((blob) => {
      if (blob) setPendingPhotos((prev) => [...prev, new File([blob], 'imported.jpg', { type: blob.type })])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!form) return null

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function updateIngredient(index: number, patch: Partial<Ingredient>) {
    setForm((prev) => {
      if (!prev) return prev
      const ingredients = prev.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing))
      return { ...prev, ingredients }
    })
  }

  function updateStep(index: number, value: string) {
    setForm((prev) => {
      if (!prev) return prev
      const steps = prev.steps.map((s, i) => (i === index ? value : s))
      return { ...prev, steps }
    })
  }

  async function handleRemoveExistingPhoto(photoId: number) {
    if (recipeId === undefined) return
    await removePhoto(photoId, recipeId)
    setExistingPhotoIds((prev) => prev.filter((id) => id !== photoId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)

    const tags = form.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const ingredients = form.ingredients.filter((ing) => ing.name.trim())
    const steps = form.steps.map((s) => s.trim()).filter(Boolean)

    const payload: Omit<Recipe, 'id' | 'photoIds' | 'savedDate'> = {
      name: form.name.trim(),
      mealType: form.mealType,
      pro: form.pro.trim(),
      base: form.base.trim(),
      veg: form.veg.trim(),
      engine: form.engine.trim(),
      ingredients,
      steps,
      prepMinutes: form.prepMinutes,
      servings: form.servings,
      tags,
      pregnancySafe: form.pregnancySafe,
      source: form.source.trim() || undefined,
    }

    let targetId = recipeId
    if (isEdit && targetId !== undefined) {
      await updateRecipe(targetId, payload)
    } else {
      targetId = (await addRecipe({
        ...payload,
        photoIds: [],
        savedDate: new Date().toISOString().slice(0, 10),
      })) as number
    }

    for (const file of pendingPhotos) {
      const compressed = await compressImage(file)
      await addPhoto(targetId!, compressed)
    }

    navigate(`/recipes/${targetId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 pb-24">
      <h1 className="text-2xl font-semibold text-sage-800">{isEdit ? 'Edit recipe' : 'Add recipe'}</h1>

      <div className="mt-4 space-y-4 max-w-xl">
        <Field label="Name">
          <input
            required
            className="input"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>

        <Field label="Meal type">
          <select
            className="input"
            value={form.mealType}
            onChange={(e) => update('mealType', e.target.value as MealType)}
          >
            {MEAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Servings">
            <input
              type="number"
              min={1}
              max={12}
              className="input"
              value={form.servings}
              onChange={(e) => update('servings', Number(e.target.value) || 1)}
            />
          </Field>
          <Field label="Prep minutes">
            <input
              type="number"
              min={1}
              className="input"
              value={form.prepMinutes}
              onChange={(e) => update('prepMinutes', Number(e.target.value) || 1)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="PRO (protein)">
            <input className="input" value={form.pro} onChange={(e) => update('pro', e.target.value)} />
          </Field>
          <Field label="BASE (carb)">
            <input className="input" value={form.base} onChange={(e) => update('base', e.target.value)} />
          </Field>
          <Field label="VEG">
            <input className="input" value={form.veg} onChange={(e) => update('veg', e.target.value)} />
          </Field>
          <Field label="ENGINE (flavor)">
            <input className="input" value={form.engine} onChange={(e) => update('engine', e.target.value)} />
          </Field>
        </div>

        <Field label="Ingredients">
          <div className="space-y-2">
            {form.ingredients.map((ing, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Ingredient"
                  value={ing.name}
                  onChange={(e) => updateIngredient(i, { name: e.target.value })}
                />
                <input
                  className="input w-20"
                  placeholder="Qty"
                  type="number"
                  value={ing.qty ?? ''}
                  onChange={(e) => updateIngredient(i, { qty: e.target.value ? Number(e.target.value) : undefined })}
                />
                <input
                  className="input w-24"
                  placeholder="Unit"
                  value={ing.unit ?? ''}
                  onChange={(e) => updateIngredient(i, { unit: e.target.value || undefined })}
                />
                <select
                  className="input w-32"
                  value={ing.preferredStore ?? ''}
                  onChange={(e) => updateIngredient(i, { preferredStore: (e.target.value || undefined) as Store | undefined })}
                >
                  <option value="">Store...</option>
                  {STORES.map((s) => (
                    <option key={s} value={s}>
                      {STORE_LABEL[s]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-sage-400 hover:text-red-500"
                  onClick={() => update('ingredients', form.ingredients.filter((_, idx) => idx !== i))}
                  aria-label="Remove ingredient"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-medium text-sage-600 hover:underline"
              onClick={() => update('ingredients', [...form.ingredients, { name: '' }])}
            >
              + Add ingredient
            </button>
          </div>
        </Field>

        <Field label="Steps">
          <div className="space-y-2">
            {form.steps.map((step, i) => (
              <div key={i} className="flex gap-2">
                <span className="mt-2 text-sm text-sage-400">{i + 1}.</span>
                <textarea
                  className="input flex-1"
                  rows={2}
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                />
                <button
                  type="button"
                  className="text-sage-400 hover:text-red-500"
                  onClick={() => update('steps', form.steps.filter((_, idx) => idx !== i))}
                  aria-label="Remove step"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-medium text-sage-600 hover:underline"
              onClick={() => update('steps', [...form.steps, ''])}
            >
              + Add step
            </button>
          </div>
        </Field>

        <Field label="Tags (comma separated)">
          <input className="input" value={form.tags} onChange={(e) => update('tags', e.target.value)} />
        </Field>

        <Field label="Source (link or cookbook name)">
          <input className="input" value={form.source} onChange={(e) => update('source', e.target.value)} />
        </Field>

        {settings?.pregnancySafeMode && (
          <label className="flex items-center gap-2 text-sm text-sage-700">
            <input
              type="checkbox"
              className="h-4 w-4 accent-sage-500"
              checked={form.pregnancySafe}
              onChange={(e) => update('pregnancySafe', e.target.checked)}
            />
            Safe for pregnancy/breastfeeding
          </label>
        )}

        <Field label="Photos">
          <PhotoManager
            existingPhotoIds={existingPhotoIds}
            onRemoveExisting={handleRemoveExistingPhoto}
            pendingPhotos={pendingPhotos}
            onAddPending={(files) => setPendingPhotos((prev) => [...prev, ...files])}
            onRemovePending={(index) => setPendingPhotos((prev) => prev.filter((_, i) => i !== index))}
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-sage-600 px-5 py-2.5 font-medium text-white hover:bg-sage-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Save recipe'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-sage-700">{label}</span>
      {children}
    </label>
  )
}

function PhotoManager({
  existingPhotoIds,
  onRemoveExisting,
  pendingPhotos,
  onAddPending,
  onRemovePending,
}: {
  existingPhotoIds: number[]
  onRemoveExisting: (id: number) => void
  pendingPhotos: File[]
  onAddPending: (files: File[]) => void
  onRemovePending: (index: number) => void
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {existingPhotoIds.map((id) => (
          <ExistingPhotoThumb key={id} photoId={id} onRemove={() => onRemoveExisting(id)} />
        ))}
        {pendingPhotos.map((file, i) => (
          <PendingPhotoThumb key={i} file={file} onRemove={() => onRemovePending(i)} />
        ))}
      </div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="mt-2 text-sm"
        onChange={(e) => {
          if (e.target.files) onAddPending(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
    </div>
  )
}

function ExistingPhotoThumb({ photoId, onRemove }: { photoId: number; onRemove: () => void }) {
  const [url, setUrl] = useState<string | undefined>()

  useEffect(() => {
    let objectUrl: string | undefined
    getPhoto(photoId).then((photo) => {
      if (!photo) return
      objectUrl = URL.createObjectURL(photo.blob)
      setUrl(objectUrl)
    })
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [photoId])

  return (
    <div className="relative h-20 w-20">
      {url && <img src={url} className="h-20 w-20 rounded-lg object-cover" alt="" />}
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs shadow"
      >
        ✕
      </button>
    </div>
  )
}

function PendingPhotoThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url] = useState(() => URL.createObjectURL(file))
  useEffect(() => () => URL.revokeObjectURL(url), [url])

  return (
    <div className="relative h-20 w-20">
      <img src={url} className="h-20 w-20 rounded-lg object-cover" alt="" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs shadow"
      >
        ✕
      </button>
    </div>
  )
}
