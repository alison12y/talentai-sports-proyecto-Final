import { NavLink, Outlet, useNavigate } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/clubes', label: 'Clubes' },
  { to: '/equipos', label: 'Equipos' },
  { to: '/jugadores', label: 'Jugadores' },
]

function MainLayout() {
  const navigate = useNavigate()
  const storedUser = localStorage.getItem('user')
  const user = storedUser ? JSON.parse(storedUser) : null

  const handleLogout = () => {
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">TS</span>
          <span className="brand-name">TalentAI Sports</span>
        </div>

        <nav className="side-nav" aria-label="Principal">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <p className="topbar-kicker">Sprint 1</p>
            <strong>Gestion deportiva</strong>
          </div>

          <div className="topbar-actions">
            {user ? (
              <>
                <span className="topbar-user">{user.nombre}</span>
                <button type="button" className="button-ghost" onClick={handleLogout}>
                  Cerrar sesion
                </button>
              </>
            ) : (
              <NavLink to="/login" className="topbar-link">
                Acceso
              </NavLink>
            )}
          </div>
        </header>

        <nav className="mobile-nav" aria-label="Principal movil">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout
