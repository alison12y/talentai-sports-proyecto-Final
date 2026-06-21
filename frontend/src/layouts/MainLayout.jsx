import { useEffect, useState } from 'react'
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
  { to: '/cuotas', label: 'Cuotas' },
  { to: '/portal-padre', label: 'Portal Padre' },
]

const menuPathsByRole = {
  COORDINADOR: navItems
    .filter((item) => item.to !== '/portal-padre')
    .map((item) => item.to),
  ENTRENADOR: [
    '/dashboard', '/equipos', '/jugadores', '/eventos', '/convocatorias',
    '/asistencias', '/partidos', '/estadisticas', '/evolucion-fisica',
  ],
  PADRE: ['/dashboard', '/portal-padre'],
  JUGADOR: ['/dashboard'],
}

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

const normalizeRole = (role) => String(role || '').trim().toUpperCase()

function MainLayout() {
  const navigate = useNavigate()
  const user = readStoredJson('user', null)
  const memberships = readStoredJson('memberships', [])
  const [activeMembership, setActiveMembership] = useState(
    () => readStoredJson('activeMembership', null),
  )
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const activeRole = normalizeRole(
    activeMembership?.rol
      || user?.rol
      || user?.role
      || memberships[0]?.rol,
  )
  const allowedMenuPaths = menuPathsByRole[activeRole] || ['/dashboard']
  const visibleNavItems = navItems.filter(
    (item) => allowedMenuPaths.includes(item.to),
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

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
          {visibleNavItems.map((item) => (
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
          {visibleNavItems.map((item) => (
            <NavLink key={item.to} to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {!isOnline && (
          <div className="clubs-alert parent-offline-alert app-offline-banner" role="status">
            Modo offline
          </div>
        )}

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default MainLayout
