export interface UrlRecipeDraft {
  name: string
  ingredients: string[]
  steps: string[]
  prepMinutes?: number
  servings?: number
  imageUrl?: string
  source: string
}

/** Parses an ISO 8601 duration like "PT15M" or "PT1H30M" into whole minutes. */
function durationToMinutes(iso: string | undefined): number | undefined {
  if (!iso) return undefined
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match) return undefined
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const total = hours * 60 + minutes
  return total > 0 ? total : undefined
}

function firstNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const match = value.match(/\d+/)
    return match ? Number(match[0]) : undefined
  }
  if (Array.isArray(value)) return firstNumber(value[0])
  return undefined
}

function instructionsToSteps(instructions: unknown): string[] {
  if (!instructions) return []
  if (typeof instructions === 'string') {
    return instructions
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (Array.isArray(instructions)) {
    return instructions.flatMap((step): string[] => {
      if (typeof step === 'string') return [step]
      if (step && typeof step === 'object') {
        const obj = step as Record<string, unknown>
        if (obj['@type'] === 'HowToSection' && Array.isArray(obj.itemListElement)) {
          return instructionsToSteps(obj.itemListElement)
        }
        if (typeof obj.text === 'string') return [obj.text]
      }
      return []
    })
  }
  return []
}

function imageToUrl(image: unknown): string | undefined {
  if (typeof image === 'string') return image
  if (Array.isArray(image)) return imageToUrl(image[0])
  if (image && typeof image === 'object') {
    const obj = image as Record<string, unknown>
    if (typeof obj.url === 'string') return obj.url
  }
  return undefined
}

function findRecipeNode(json: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(json)) {
    for (const item of json) {
      const found = findRecipeNode(item)
      if (found) return found
    }
    return undefined
  }
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    const type = obj['@type']
    const isRecipe = type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
    if (isRecipe) return obj
    if (Array.isArray(obj['@graph'])) return findRecipeNode(obj['@graph'])
  }
  return undefined
}

/**
 * Fetches a recipe page directly from the browser and extracts schema.org/Recipe JSON-LD data.
 * Most recipe sites embed this for SEO/rich-results, so it's a straightforward parse rather than
 * scraping — but a plain client-side fetch will fail on sites that don't send permissive CORS
 * headers. Callers should surface that as "couldn't fetch — enter manually" rather than an error.
 */
export async function fetchAndParseRecipeUrl(url: string): Promise<UrlRecipeDraft> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`)
  const html = await response.text()

  const doc = new DOMParser().parseFromString(html, 'text/html')
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))

  for (const script of scripts) {
    try {
      const json = JSON.parse(script.textContent ?? '')
      const recipe = findRecipeNode(json)
      if (!recipe || typeof recipe.name !== 'string') continue

      const ingredients = Array.isArray(recipe.recipeIngredient)
        ? recipe.recipeIngredient.filter((i): i is string => typeof i === 'string')
        : []

      return {
        name: recipe.name,
        ingredients,
        steps: instructionsToSteps(recipe.recipeInstructions),
        prepMinutes: durationToMinutes(recipe.prepTime as string) ?? durationToMinutes(recipe.totalTime as string),
        servings: firstNumber(recipe.recipeYield),
        imageUrl: imageToUrl(recipe.image),
        source: url,
      }
    } catch {
      // Not valid JSON or not the recipe node — try the next script tag.
    }
  }

  throw new Error('No schema.org Recipe data found on that page')
}

/** Best-effort: many image CDNs block cross-origin reads, so failures here should be silent. */
export async function fetchImageBlob(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    return await response.blob()
  } catch {
    return null
  }
}
