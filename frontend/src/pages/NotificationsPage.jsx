import { useEffect, useState } from 'react'
import api from '../api/axios'

const getFullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://127.0.0.1:8000';
  return `${baseUrl}${url}`;
};

function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [selectedNotification, setSelectedNotification] = useState(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [notificationDetailType, setNotificationDetailType] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [reportError, setReportError] = useState('')

  const openClipsModal = (notif) => {
    setSelectedNotification(notif)
    setNotificationDetailType('VIDEO_SCOUT_CLIPS')
    setIsDetailModalOpen(true)
  }

  const openReportModal = async (notif) => {
    setSelectedNotification(notif)
    setNotificationDetailType('informe_scouting')
    setIsDetailModalOpen(true)
    setIsLoadingReport(true)
    setReportError('')
    setReportData(null)

    try {
      const { data } = await api.get(`/partidos/${notif.data_extra.partido_id}/informe-scouting/`)
      setReportData(data)
    } catch (err) {
      setReportError('No se pudo cargar el informe.')
    } finally {
      setIsLoadingReport(false)
    }
  }

  const closeModal = () => {
    setIsDetailModalOpen(false)
    setSelectedNotification(null)
    setNotificationDetailType(null)
    setReportData(null)
    setReportError('')
  }

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

                <div className="category-actions callup-actions" style={{ marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  {(notif.data_extra?.tipo === 'VIDEO_SCOUT_CLIPS' || notif.data_extra?.clips?.length > 0) && (
                    <button type="button" className="button-primary" onClick={() => openClipsModal(notif)}>
                      Ver clips
                    </button>
                  )}
                  {notif.data_extra?.tipo === 'informe_scouting' && (
                    <button type="button" className="button-primary" onClick={() => openReportModal(notif)}>
                      Ver informe
                    </button>
                  )}
                  {!notif.leida && (
                    <>
                      <button
                        type="button"
                        className={notif.data_extra?.tipo ? "button-ghost" : "button-primary"}
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
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {isDetailModalOpen && selectedNotification && (
        <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <section className="clubs-modal match-modal" role="dialog" aria-modal="true" style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="clubs-modal-header">
              <div>
                <span className="eyebrow">Detalle de notificación</span>
                <h2 id="modal-title">
                  {notificationDetailType === 'VIDEO_SCOUT_CLIPS' ? 'Clips de video' : 'Informe de scouting IA'}
                </h2>
                <p>
                  {notificationDetailType === 'VIDEO_SCOUT_CLIPS' 
                    ? `Jugador: ${selectedNotification.data_extra?.jugador_nombre || 'Desconocido'}` 
                    : 'Análisis automatizado del partido'}
                </p>
              </div>
              <button type="button" className="clubs-modal-close" onClick={closeModal} aria-label="Cerrar">×</button>
            </div>
            
            <div className="clubs-modal-content" style={{ padding: '1rem 1.5rem' }}>
              {notificationDetailType === 'VIDEO_SCOUT_CLIPS' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                  {selectedNotification.data_extra?.clips?.map((clip, idx) => (
                    <div key={idx} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                      <video controls style={{ width: '100%', display: 'block', background: '#000' }} src={getFullUrl(clip.clip_url)} />
                      <div style={{ padding: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--panel-soft)', padding: '0.2rem 0.5rem', borderRadius: '1rem', display: 'inline-block', marginBottom: '0.5rem' }}>
                          {clip.tipo_label} - Min {clip.minuto}
                        </span>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>{clip.descripcion || 'Sin descripción'}</p>
                        {clip.mensaje_padre && (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '3px solid var(--primary)', paddingLeft: '0.5rem' }}>
                            "{clip.mensaje_padre}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!selectedNotification.data_extra?.clips || selectedNotification.data_extra.clips.length === 0) && (
                    <p style={{ color: 'var(--text-secondary)' }}>No hay clips disponibles en esta notificación.</p>
                  )}
                </div>
              )}

              {notificationDetailType === 'informe_scouting' && (
                <>
                  {isLoadingReport ? (
                    <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando informe...</strong></div>
                  ) : reportError ? (
                    <div className="clubs-alert clubs-alert-error">{reportError}</div>
                  ) : reportData ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div style={{ background: 'var(--panel-soft)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', color: 'var(--primary)' }}>Resumen táctico</h3>
                        <p style={{ margin: 0, lineHeight: 1.5, fontSize: '0.9rem' }}>
                          {reportData.metricas_json?.resumen_tactico || reportData.resumen || 'Sin resumen táctico disponible.'}
                        </p>
                      </div>

                      {reportData.metricas_json?.top_rendimiento?.length > 0 && (
                        <div>
                          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', color: 'var(--primary)' }}>Top Rendimiento</h3>
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {reportData.metricas_json.top_rendimiento.map((top, idx) => (
                              <div key={idx} style={{ flex: '1 1 200px', padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{top.posicion}</p>
                                <p style={{ margin: '0 0 0.5rem', fontWeight: 700 }}>{top.nombre}</p>
                                <span style={{ fontSize: '0.8rem', color: 'var(--success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{top.motivo}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {reportData.metricas_json?.metricas_jugadores?.length > 0 && (
                        <div>
                          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', color: 'var(--primary)' }}>Métricas por Jugador</h3>
                          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                              <thead>
                                <tr style={{ background: 'var(--panel)', textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                                  <th style={{ padding: '0.75rem' }}>Jugador</th>
                                  <th style={{ padding: '0.75rem' }}>Posición</th>
                                  <th style={{ padding: '0.75rem' }}>Valoración</th>
                                  <th style={{ padding: '0.75rem' }}>Perfil</th>
                                </tr>
                              </thead>
                              <tbody>
                                {reportData.metricas_json.metricas_jugadores.map((j, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.75rem', fontWeight: 500 }}>{j.nombre_completo}</td>
                                    <td style={{ padding: '0.75rem' }}>{j.posicion}</td>
                                    <td style={{ padding: '0.75rem', fontWeight: 600, color: j.valoracion > 7 ? 'var(--success)' : 'inherit' }}>{j.valoracion}</td>
                                    <td style={{ padding: '0.75rem' }}>{j.perfil_sugerido}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {reportData.metricas_json?.heatmap_url && (
                        <div>
                          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem', color: 'var(--primary)' }}>Mapa de Calor</h3>
                          <img 
                            src={getFullUrl(reportData.metricas_json.heatmap_url)} 
                            alt="Mapa de calor" 
                            style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border)' }} 
                          />
                        </div>
                      )}
                    </div>
                  ) : null}
                </>
              )}
            </div>
            
            <div className="clubs-form-actions" style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" className="button-ghost" onClick={closeModal}>Cerrar</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default NotificationsPage
