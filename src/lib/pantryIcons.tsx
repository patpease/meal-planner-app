import avocado from '../assets/icons/pantry/avocado.svg?raw'
import beer from '../assets/icons/pantry/beer.svg?raw'
import berries from '../assets/icons/pantry/berries.svg?raw'
import bread from '../assets/icons/pantry/bread.svg?raw'
import burger from '../assets/icons/pantry/burger.svg?raw'
import cake from '../assets/icons/pantry/cake.svg?raw'
import carrot from '../assets/icons/pantry/carrot.svg?raw'
import cheese from '../assets/icons/pantry/cheese.svg?raw'
import citrus from '../assets/icons/pantry/citrus.svg?raw'
import coffee from '../assets/icons/pantry/coffee.svg?raw'
import condiment from '../assets/icons/pantry/condiment.svg?raw'
import cookie from '../assets/icons/pantry/cookie.svg?raw'
import egg from '../assets/icons/pantry/egg.svg?raw'
import fish from '../assets/icons/pantry/fish.svg?raw'
import grains from '../assets/icons/pantry/grains.svg?raw'
import grocery from '../assets/icons/pantry/grocery.svg?raw'
import herbs from '../assets/icons/pantry/herbs.svg?raw'
import iceCream from '../assets/icons/pantry/ice-cream.svg?raw'
import leftovers from '../assets/icons/pantry/leftovers.svg?raw'
import meat from '../assets/icons/pantry/meat.svg?raw'
import milk from '../assets/icons/pantry/milk.svg?raw'
import nuts from '../assets/icons/pantry/nuts.svg?raw'
import packaged from '../assets/icons/pantry/packaged.svg?raw'
import pizza from '../assets/icons/pantry/pizza.svg?raw'
import popcorn from '../assets/icons/pantry/popcorn.svg?raw'
import poultry from '../assets/icons/pantry/poultry.svg?raw'
import shrimp from '../assets/icons/pantry/shrimp.svg?raw'
import spice from '../assets/icons/pantry/spice.svg?raw'
import tea from '../assets/icons/pantry/tea.svg?raw'
import wine from '../assets/icons/pantry/wine.svg?raw'

/**
 * Curated set of Phosphor Icons (MIT) "regular" food icons — identified via
 * iconshock.com/freeicons (which features Phosphor as its flagship open-source
 * collection) and pulled from the official @phosphor-icons/core package for a
 * clean, license-clear source. See src/assets/icons/pantry/LICENSE.txt.
 */
export const PANTRY_ICONS = {
  egg,
  milk,
  cheese,
  bread,
  grains,
  carrot,
  avocado,
  citrus,
  berries,
  fish,
  shrimp,
  meat,
  poultry,
  pizza,
  burger,
  cookie,
  cake,
  'ice-cream': iceCream,
  popcorn,
  nuts,
  spice,
  coffee,
  tea,
  wine,
  beer,
  condiment,
  leftovers,
  packaged,
  herbs,
  grocery,
} as const

export type PantryIconKey = keyof typeof PANTRY_ICONS

export const PANTRY_ICON_KEYS = Object.keys(PANTRY_ICONS) as PantryIconKey[]

export function isPantryIconKey(value: string): value is PantryIconKey {
  return (PANTRY_ICON_KEYS as string[]).includes(value)
}

const KEYWORD_MAP: [PantryIconKey, RegExp][] = [
  ['egg', /\begg/i],
  ['milk', /milk|cream|half.?and.?half|buttermilk/i],
  ['cheese', /cheese|mozzarella|cheddar|parmesan|feta|brie/i],
  ['bread', /bread|bagel|tortilla|bun|toast|baguette/i],
  ['grains', /rice|pasta|noodle|cereal|oat|quinoa|flour|couscous/i],
  ['carrot', /carrot/i],
  ['avocado', /avocado/i],
  ['citrus', /orange|lemon|lime|grapefruit|citrus/i],
  ['berries', /berr|grape|cherry|cherries/i],
  ['fish', /fish|salmon|tuna|cod|tilapia|anchovy|sardine/i],
  ['shrimp', /shrimp|prawn|crab|lobster|scallop/i],
  ['meat', /beef|steak|pork|bacon|sausage|ham\b|lamb|ground meat/i],
  ['poultry', /chicken|turkey|poultry/i],
  ['pizza', /pizza/i],
  ['burger', /burger|patty/i],
  ['cookie', /cookie|biscuit/i],
  ['cake', /cake|baking|brownie/i],
  ['ice-cream', /ice cream|gelato|sorbet|frozen yogurt/i],
  ['popcorn', /popcorn|chips|pretzel|snack/i],
  ['nuts', /nut|almond|cashew|peanut|walnut|pecan|pistachio/i],
  ['spice', /spice|pepper|paprika|cumin|cinnamon|seasoning/i],
  ['coffee', /coffee|espresso/i],
  ['tea', /\btea\b/i],
  ['wine', /wine/i],
  ['beer', /beer|ale|lager/i],
  ['condiment', /honey|jam|jelly|sauce|syrup|ketchup|mustard|mayo|dressing|salsa|pickle/i],
  ['leftovers', /leftover/i],
  ['herbs', /basil|cilantro|parsley|mint|thyme|rosemary|herb|greens|lettuce|spinach|kale/i],
  ['packaged', /can\b|canned|jar\b|box\b|package|bag of/i],
]

/** Best-effort keyword match against a pantry item name; falls back to a generic grocery icon. */
export function guessPantryIcon(name: string): PantryIconKey {
  for (const [key, pattern] of KEYWORD_MAP) {
    if (pattern.test(name)) return key
  }
  return 'grocery'
}

export function PantryIcon({ icon, className }: { icon: PantryIconKey; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: PANTRY_ICONS[icon] }} />
}
