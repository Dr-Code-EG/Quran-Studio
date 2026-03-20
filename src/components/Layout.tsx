import { Outlet, NavLink } from 'react-router-dom'
import { Film, Wand2 } from 'lucide-react'

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-deep-blue overflow-hidden">
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <nav className="border-t border-border-blue bg-surface flex-shrink-0">
        <div className="flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                isActive ? 'text-gold' : 'text-text-muted hover:text-text-secondary'
              }`
            }
          >
            <Wand2 size={22} />
            <span className="text-xs font-medium">Studio</span>
          </NavLink>
          <NavLink
            to="/library"
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                isActive ? 'text-gold' : 'text-text-muted hover:text-text-secondary'
              }`
            }
          >
            <Film size={22} />
            <span className="text-xs font-medium">Library</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
