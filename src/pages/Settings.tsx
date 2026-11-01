import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { readSettings, updateSettings } from '../lib/repo'
import SendToPease from '../components/SendToPease'

export default function Settings() {
  const settings = useLiveQuery(readSettings, [], undefined)

  if (!settings) return null

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold text-sage-800">Settings</h1>

      <div className="mt-4 max-w-md space-y-6">
        <SendToPease />

        <label className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4">
          <span>
            <span className="block font-medium text-sage-800">Pregnancy/breastfeeding-safe mode</span>
            <span className="block text-sm text-sage-600">
              Filters meal suggestions and flags recipes. Turn off any time — nothing on saved
              recipes is lost, it just stops being applied.
            </span>
          </span>
          <input
            type="checkbox"
            className="ml-4 h-5 w-5 accent-sage-500"
            checked={settings.pregnancySafeMode}
            onChange={(e) => updateSettings({ pregnancySafeMode: e.target.checked })}
          />
        </label>

        <label className="block rounded-xl border border-stone-200 bg-white p-4">
          <span className="block font-medium text-sage-800">Default servings per meal</span>
          <input
            type="number"
            min={1}
            max={12}
            className="mt-2 w-24 rounded-lg border border-stone-300 px-3 py-2"
            value={settings.defaultServings}
            onChange={(e) => updateSettings({ defaultServings: Number(e.target.value) || 1 })}
          />
        </label>

        <StorePreferencesList storePreferences={settings.storePreferences} />

        <Link
          to="/import"
          className="block rounded-xl border border-sage-300 bg-sage-50 p-4 text-center font-medium text-sage-700 hover:bg-sage-100"
        >
          Import existing recipes & pantry →
        </Link>
      </div>
    </div>
  )
}

function StorePreferencesList({ storePreferences }: { storePreferences: Record<string, string> }) {
  const entries = Object.entries(storePreferences)

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <span className="block font-medium text-sage-800">Ingredient store preferences</span>
      <span className="block text-sm text-sage-600">
        Set the first time you choose a store for an ingredient on the shopping list.
      </span>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-sage-500">None set yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {entries.map(([name, store]) => (
            <li key={name} className="flex justify-between">
              <span className="capitalize text-sage-700">{name}</span>
              <span className="text-sage-500">{store === 'trader-joes' ? "Trader Joe's" : 'Whole Foods'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
