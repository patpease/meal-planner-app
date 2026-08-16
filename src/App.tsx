import { HashRouter, Routes, Route, NavLink } from 'react-router-dom'
import Recipes from './pages/Recipes'
import Pantry from './pages/Pantry'
import Planner from './pages/Planner'
import Settings from './pages/Settings'

const navItems = [
  { to: '/', label: 'Plan', end: true },
  { to: '/recipes', label: 'Recipes' },
  { to: '/pantry', label: 'Pantry' },
  { to: '/settings', label: 'Settings' },
]

function navLinkClass({ isActive }: { isActive: boolean }) {
  return [
    'flex-1 md:flex-none md:w-full text-center md:text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
    isActive
      ? 'bg-sage-500 text-white'
      : 'text-sage-700 hover:bg-sage-100',
  ].join(' ')
}

function App() {
  return (
    <HashRouter>
      <div className="flex flex-1 flex-col md:flex-row bg-stone-50">
        <nav className="hidden md:flex md:w-48 md:flex-col md:gap-1 md:p-4 md:border-r md:border-stone-200">
          <span className="mb-4 text-lg font-semibold text-sage-800">Meal Planner</span>
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={<Planner />} />
            <Route path="/recipes" element={<Recipes />} />
            <Route path="/pantry" element={<Pantry />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 flex gap-1 border-t border-stone-200 bg-white p-2 md:hidden">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </HashRouter>
  )
}

export default App
