import { useEffect, useState } from 'react'
import api from '../api/axios'

function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchNotifications()
  }, [])

  const fetchNotifications = async () => {
    setIsLoading(true)
    try {
      const user = JSON.parse(localStorage.getItem('user')) || {}
      const userIdQuery = user.id ? `?usuario_id=${user.id}` : ''
      const { data } = await api.get(`/notificaciones/${userIdQuery}`)
      // Django REST framework returns paginated or direct array depending on config. We assume array or data.results.
      const list = Array.isArray(data) ? data : data.results || []
      setNotifications(list)
    } catch (err) {
      setError('Error al cargar las notificaciones.')
    } finally {
      setIsLoading(false)
    }
  }

  const markAsRead = async (id) => {
    try {
      const user = JSON.parse(localStorage.getItem('user')) || {}
      const userIdQuery = user.id ? `?usuario_id=${user.id}` : ''
      const { data } = await api.post(`/notificaciones/${id}/marcar-leida/${userIdQuery}`)
      setNotifications((prev) =>
        prev.map((notif) => (notif.id === id ? data.notificacion : notif))
      )
      window.dispatchEvent(new Event('notificaciones_actualizadas'))
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Hubo un error al marcar la notificación como leída.'
      alert(errorMsg)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(date)
  }

  return (
    <section className="page page-fluid categories-page">
      <div className="page-header categories-header">
        <div>
          <p className="eyebrow">Avisos y alertas</p>
          <h1>Notificaciones</h1>
          <p>Revisa tus notificaciones y alertas recientes.</p>
        </div>
      </div>

      {error && (
        <div className="clubs-alert clubs-alert-error" role="alert">
          {error}
        </div>
      )}

      <section className="categories-list-card">
        <div className="categories-list-heading">
          <div>
            <h2>Mis notificaciones</h2>
            <p>{notifications.length} {notifications.length === 1 ? 'registrada' : 'registradas'}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="categories-empty">
            <span className="clubs-loader" />
            <strong>Cargando notificaciones...</strong>
          </div>
        ) : notifications.length === 0 ? (
          <div className="categories-empty">
            <span className="categories-empty-icon" style={{ fontSize: '2rem' }}>🔔</span>
            <strong>No hay notificaciones</strong>
            <p>No tienes notificaciones registradas.</p>
          </div>
        ) : (
          <div className="categories-grid callups-grid">
            {notifications.map((notif) => (
              <article className="category-card callup-card" key={notif.id} style={{ opacity: notif.leida ? 0.75 : 1, transition: 'opacity 0.2s' }}>
                <div className="category-card-top">
                  <div>
                    <span className="category-card-kicker">{notif.tipo || 'Sistema'}</span>
                    <h3>{notif.titulo}</h3>
                  </div>
                  <span className={`callup-status callup-status-${notif.leida ? 'confirmado' : 'pendiente'}`}>
                    {notif.leida ? 'Leída' : 'No leída'}
                  </span>
                </div>
                <p style={{ marginTop: '0.5rem', marginBottom: '1rem', color: 'var(--text)' }}>{notif.mensaje}</p>
                
                <div className="category-card-meta callup-card-meta" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem' }}>Recibida: <strong>{formatDate(notif.fecha_creacion)}</strong></span>
                  {notif.fecha_lectura && (
                    <span style={{ fontSize: '0.85rem' }}>Leída el: <strong>{formatDate(notif.fecha_lectura)}</strong></span>
                  )}
                </div>

                {!notif.leida && (
                  <div className="category-actions callup-actions" style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={() => markAsRead(notif.id)}
                    >
                      Marcar como leída
                    </button>
                    <button
                      type="button"
                      className="button-ghost"
                      onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                    >
                      Ignorar ahora
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default NotificationsPage
