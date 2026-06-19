import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const summaryCards = [
  { label: 'Clubes', value: 'CU-05', tone: 'blue' },
  { label: 'Equipos', value: 'CU-09', tone: 'green' },
  { label: 'Jugadores', value: 'CU-10', tone: 'slate' },
  { label: 'Sprint 1', value: 'Base MVP', tone: 'amber' },
]

const quickLinks = [
  { to: '/clubes', label: 'Ir a Clubes' },
  { to: '/equipos', label: 'Ir a Equipos' },
  { to: '/jugadores', label: 'Ir a Jugadores' },
]

function DashboardPage() {
  const navigate = useNavigate()
  const user = useMemo(() => {
    const storedUser = localStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <section className="page page-fluid">
      <div className="page-header">
        <div>
          <p className="eyebrow">Resumen operativo</p>
          <h1>Bienvenido, {user?.nombre || 'usuario'}</h1>
          <p>
            TalentAI Sports centraliza clubes, equipos y jugadores para acelerar la gestion deportiva.
          </p>
        </div>
        {user ? (
          <button type="button" className="button-secondary" onClick={handleLogout}>
            Cerrar sesion
          </button>
        ) : (
          <button type="button" className="button-primary" onClick={() => navigate('/login')}>
            Ir a login
          </button>
        )}
      </div>

      {user && (
        <div className="profile-strip">
          <span className="avatar">{user.nombre?.charAt(0) || 'U'}</span>
          <div>
            <strong>{user.nombre} {user.apellido}</strong>
            <p>{user.email}</p>
          </div>
        </div>
      )}

      <div className="stats-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className={`stat-card stat-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="workspace-card">
        <div>
          <p className="eyebrow">Accesos rapidos</p>
          <h2>Gestiona el Sprint 1</h2>
          <p>Continua con las secciones principales mientras preparamos las tablas y formularios completos.</p>
        </div>
        <div className="quick-actions">
          {quickLinks.map((item) => (
            <Link key={item.to} to={item.to} className="button-secondary">
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

export default DashboardPage
