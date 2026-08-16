import type { Ingredient, MealType, PantryItem, PantryLevel, Recipe } from './db'

const TITLE_RE = /^-\s*(?:\[[^\]]*\]\s*)?(.+?)\s*[—-]\s*source:\s*(.*)$/i
const PILLARS_RE = /^PRO:\s*(.*?)\s*\|\s*BASE:\s*(.*?)\s*\|\s*VEG:\s*(.*?)\s*\|\s*ENGINE:\s*(.*)$/i
const PREP_RE = /^Prep:\s*(\d+)\s*min(?:\s*[·•]\s*Tags:\s*(.*))?$/i
const STEPS_RE = /^Steps:\s*(.*)$/i
const FLAG_RE = /^Flag:\s*(.*)$/i

const PANTRY_RE = /^-\s*(?:\[[^\]]*\]\s*)?(.+?)\s*—\s*(.+?)(?:\s*[·•]\s*updated\s*(.*))?$/i
const LEVELS: PantryLevel[] = ['full', 'half', 'low', 'empty']
const QTY_RE = /^([\d.]+)\s*(.*)$/

function pillarIngredients(pro: string, base: string, veg: string, engine: string): Ingredient[] {
  return [pro, base, veg, engine]
    .map((v) => v.trim())
    .filter((v) => v && !/^none$/i.test(v))
    .map((name) => ({ name }))
}

/** Splits memory-file text into top-level bullet blocks ("- ..." starts a new entry). */
function splitEntries(text: string): string[][] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const blocks: string[][] = []
  for (const line of lines) {
    if (line.startsWith('- ')) {
      blocks.push([line])
    } else if (blocks.length > 0) {
      blocks[blocks.length - 1].push(line)
    }
  }
  return blocks
}

export interface ParsedRecipe extends Omit<Recipe, 'id'> {}

export function parseRecipesText(text: string, mealType: MealType): ParsedRecipe[] {
  const today = new Date().toISOString().slice(0, 10)
  const results: ParsedRecipe[] = []

  for (const block of splitEntries(text)) {
    const titleMatch = block[0].match(TITLE_RE)
    if (!titleMatch) continue

    const [, name, source] = titleMatch
    let pro = '', base = '', veg = '', engine = ''
    let prepMinutes = 15
    let tags: string[] = []
    const steps: string[] = []
    let flag = ''

    for (const line of block.slice(1)) {
      const pillars = line.match(PILLARS_RE)
      const prep = line.match(PREP_RE)
      const stepsMatch = line.match(STEPS_RE)
      const flagMatch = line.match(FLAG_RE)

      if (pillars) {
        ;[, pro, base, veg, engine] = pillars
      } else if (prep) {
        prepMinutes = Number(prep[1])
        tags = prep[2] ? prep[2].split(',').map((t) => t.trim()).filter(Boolean) : []
      } else if (stepsMatch) {
        steps.push(...stepsMatch[1].split(/\.\s+/).map((s) => s.trim()).filter(Boolean))
      } else if (flagMatch) {
        flag = flagMatch[1]
      }
    }

    const pregnancySafe = !/pregnan|breastfeed/i.test(flag)

    results.push({
      name,
      mealType,
      pro,
      base,
      veg,
      engine,
      ingredients: pillarIngredients(pro, base, veg, engine),
      steps,
      prepMinutes,
      servings: 2,
      tags: flag ? [...tags, `imported-flag: ${flag}`] : tags,
      pregnancySafe,
      photoIds: [],
      source: source || undefined,
      savedDate: today,
    })
  }

  return results
}

export interface ParsedPantryItem extends Omit<PantryItem, 'id'> {}

export function parsePantryText(text: string): ParsedPantryItem[] {
  const today = new Date().toISOString().slice(0, 10)
  const results: ParsedPantryItem[] = []

  for (const block of splitEntries(text)) {
    const match = block[0].match(PANTRY_RE)
    if (!match) continue

    const [, name, stock, updated] = match
    const stockTrimmed = stock.trim()
    const levelMatch = LEVELS.find((l) => new RegExp(`^${l}$`, 'i').test(stockTrimmed))

    if (levelMatch) {
      results.push({ name, level: levelMatch, updatedDate: updated || today })
    } else {
      const qtyMatch = stockTrimmed.match(QTY_RE)
      if (qtyMatch) {
        results.push({
          name,
          qty: Number(qtyMatch[1]),
          unit: qtyMatch[2] || undefined,
          updatedDate: updated || today,
        })
      } else {
        results.push({ name, level: 'full', updatedDate: updated || today })
      }
    }
  }

  return results
}
