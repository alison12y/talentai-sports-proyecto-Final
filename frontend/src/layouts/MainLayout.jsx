import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/clubes', label: 'Clubes' },
  { to: '/categorias', label: 'Categorías' },
  { to: '/equipos', label: 'Equipos' },
  { to: '/jugadores', label: 'Jugadores' },
  { to: '/eventos', label: 'Eventos' },
  { to: '/convocatorias', label: 'Convocatorias' },
  { to: '/asistencias', label: 'Asistencias' },
  { to: '/partidos', label: 'Partidos' },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/evolucion-fisica', label: 'Evolución física' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/roles-permisos', label: 'Roles y permisos' },
]

const readStoredJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const membershipKey = (membership) => membership
  ? `${membership.club?.id || ''}:${membership.rol || ''}`
  : ''

const roleLabel = (role) => role
  ? role.charAt(0) + role.slice(1).toLowerCase()
  : ''

function MainLayout() {
  const navigate = useNavigate()
  const user = readStoredJson('user', null)
  const memberships = readStoredJson('memberships', [])
  const [activeMembership, setActiveMembership] = useState(
    () => readStoredJson('activeMembership', null),
  )

  const handleMembershipChange = (event) => {
    const membership = memberships.find(
      (item) => membershipKey(item) === event.target.value,
    ) || null
    setActiveMembership(membership)
    if (membership) {
      localStorage.setItem('activeMembership', JSON.stringify(membership))
    } else {
      localStorage.removeItem('activeMembership')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('memberships')
    localStorage.removeItem('activeMembership')
    localStorage.removeItem('role')
    localStorage.removeItem('token')
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
                <div className="topbar-account">
                  <span className="topbar-user">{user.nombre}</span>
                  {activeMembership && (
                    <span className="topbar-membership">
                      <strong>{activeMembership.club?.nombre || 'Club'}</strong>
                      <small>{roleLabel(activeMembership.rol)}</small>
                    </span>
                  )}
                </div>
                {memberships.length > 1 && (
                  <label className="topbar-membership-select">
                    <span>Contexto</span>
                    <select
                      value={membershipKey(activeMembership)}
                      onChange={handleMembershipChange}
                      aria-label="Membresía activa"
                    >
                      {memberships.map((membership) => (
                        <option
                          key={membershipKey(membership)}
                          value={membershipKey(membership)}
                        >
                          {membership.club?.nombre || 'Club'} · {roleLabel(membership.rol)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
