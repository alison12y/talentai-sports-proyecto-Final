import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import api from '../api/axios'

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
  { to: '/alertas-lesion', label: 'Riesgo de lesión' },
  { to: '/recomendaciones-ascenso', label: 'Ascenso de categoría' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/roles-permisos', label: 'Roles y permisos' },
  { to: '/cuotas', label: 'Cuotas' },
  { to: '/portal-padre', label: 'Portal Padre' },
  { to: '/notificaciones', label: 'Notificaciones' },
  { to: '/reportes', label: 'Reportes' },
]

const menuPathsByRole = {
  COORDINADOR: navItems
    .filter((item) => item.to !== '/portal-padre')
    .map((item) => item.to),
  ENTRENADOR: [
    '/dashboard', '/equipos', '/jugadores', '/eventos', '/convocatorias',
    '/asistencias', '/partidos', '/estadisticas', '/evolucion-fisica', '/alertas-lesion',
    '/recomendaciones-ascenso', '/notificaciones', '/reportes'
  ],
  PADRE: ['/dashboard', '/portal-padre', '/notificaciones'],
  JUGADOR: ['/dashboard', '/notificaciones'],
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
  const [unreadCount, setUnreadCount] = useState(0)
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
    
    const updateUnread = () => {
      if (!user) return
      api.get(`/notificaciones/?usuario_id=${user.id}`)
        .then(({ data }) => {
          const list = Array.isArray(data) ? data : data.results || []
          setUnreadCount(list.filter(n => !n.leida).length)
        })
        .catch(() => {})
    }

    if (user) {
      updateUnread()
      window.addEventListener('notificaciones_actualizadas', updateUnread)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('notificaciones_actualizadas', updateUnread)
    }
  }, [user])

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
                <NavLink to="/notificaciones" className="topbar-bell" style={{ position: 'relative', marginRight: '1rem', textDecoration: 'none', color: 'var(--text)', display: 'flex', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.25rem' }}>🔔</span>
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: '-6px', right: '-8px',
                      background: 'var(--danger)', color: '#ffffff', borderRadius: '999px',
                      padding: '2px 6px', fontSize: '0.7rem', fontWeight: '900',
                      boxShadow: '0 0 0 2px var(--panel)'
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </NavLink>
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
