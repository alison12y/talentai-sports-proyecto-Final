import { useEffect, useState } from 'react'
import api from '../api/axios'

function PromotionRecommendationsPage() {
  const [recommendations, setRecommendations] = useState([])
  const [teams, setTeams] = useState([])
  const [teamFilter, setTeamFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [info, setInfo] = useState('')
  const [trackingModal, setTrackingModal] = useState({ show: false, id: null, text: '' })

  const activeMembership = (() => {
    try {
      return JSON.parse(localStorage.getItem('activeMembership')) || null
    } catch {
      return null
    }
  })()

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    loadRecommendations()
  }, [teamFilter, levelFilter, statusFilter])

  const loadTeams = async () => {
    try {
      const endpoint = activeMembership?.club_id 
        ? `/equipos/?club=${activeMembership.club_id}`
        : '/equipos/'
      const { data } = await api.get(endpoint)
      setTeams(data.results || data || [])
    } catch (e) {
      setError('Error al cargar equipos.')
    }
  }

  const loadRecommendations = async () => {
    setIsLoading(true)
    setError('')
    try {
      let url = '/recomendaciones-ascenso/?'
      if (teamFilter) url += `&equipo=${teamFilter}`
      if (levelFilter) url += `&nivel=${levelFilter}`
      if (statusFilter) url += `&estado=${statusFilter}`
      
      const { data } = await api.get(url)
      setRecommendations(data)
    } catch (e) {
      setError('Error al cargar las recomendaciones.')
    } finally {
      setIsLoading(false)
    }
  }

  const generateRecommendations = async () => {
    if (!teamFilter) {
      setError('Debes seleccionar un equipo para generar recomendaciones.')
      return
    }
    setIsGenerating(true)
    setError('')
    setSuccess('')
    setInfo('')
    try {
      const { data, status } = await api.post('/recomendaciones-ascenso/generar/', { equipo: teamFilter })
      if (status === 200 || status === 201) {
        if (data.recomendaciones_generadas === 0 && data.recomendaciones_actualizadas === 0) {
          setInfo(data.mensaje || 'No hay jugadores con al menos 3 análisis IA completados.')
        } else {
          setSuccess(data.mensaje || 'Recomendaciones generadas correctamente.')
          await loadRecommendations()
        }
      }
    } catch (e) {
      setError('No se pudieron generar las recomendaciones. Intente nuevamente.')
    } finally {
      setIsGenerating(false)
    }
  }

  const markAsReviewed = async (id) => {
    try {
      await api.post(`/recomendaciones-ascenso/${id}/marcar-revisada/`)
      await loadRecommendations()
    } catch (e) {
      setError('Error al marcar como revisada.')
    }
  }

  const saveTracking = async () => {
    if (!trackingModal.text.trim()) return
    try {
      await api.post(`/recomendaciones-ascenso/${trackingModal.id}/crear-seguimiento/`, {
        accion_seguimiento: trackingModal.text
      })
      setTrackingModal({ show: false, id: null, text: '' })
      await loadRecommendations()
      setSuccess('Seguimiento creado exitosamente.')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError('Error al guardar el seguimiento.')
    }
  }

  // Derived metrics for summary cards
  const activeCount = recommendations.filter(r => r.estado === 'ACTIVA').length
  const talentCount = recommendations.filter(r => r.nivel === 'TALENTO_DESTACADO').length
  const readyCount = recommendations.filter(r => r.nivel === 'LISTO_PARA_ASCENSO').length
  const trackingCount = recommendations.filter(r => r.estado === 'SEGUIMIENTO').length

  const getLevelColor = (nivel) => {
    if (nivel === 'TALENTO_DESTACADO') return { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd' } // Purple
    if (nivel === 'LISTO_PARA_ASCENSO') return { bg: '#fef08a', text: '#854d0e', border: '#fde047' } // Gold/Yellow
    return { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' }
  }

  const getStatusColor = (estado) => {
    if (estado === 'ACTIVA') return { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' } // Green
    if (estado === 'REVISADA') return { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' } // Gray
    if (estado === 'SEGUIMIENTO') return { bg: '#ffedd5', text: '#9a3412', border: '#fed7aa' } // Orange
    return { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' }
  }

  return (
    <div className="clubs-container" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem', color: '#111827' }}>Recomendaciones de ascenso</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '1rem' }}>
            Identifica jugadores con rendimiento superior en sus últimos análisis IA.
          </p>
        </div>
        <button
          onClick={generateRecommendations}
          disabled={isGenerating || !teamFilter}
          style={{
            background: '#2563eb', color: 'white', padding: '0.75rem 1.5rem',
            border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: (!teamFilter || isGenerating) ? 'not-allowed' : 'pointer',
            opacity: (!teamFilter || isGenerating) ? 0.7 : 1, transition: 'all 0.2s'
          }}
        >
          {isGenerating ? 'Generando...' : 'Generar recomendaciones'}
        </button>
      </div>

      {/* Alerts */}
      {success && <div style={{ padding: '1rem', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>{success}</div>}
      {info && <div style={{ padding: '1rem', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>{info}</div>}
      {error && <div style={{ padding: '1rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>{error}</div>}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>Recomendaciones activas</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#111827', marginTop: '0.5rem' }}>{activeCount}</div>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>Talentos destacados</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#6d28d9', marginTop: '0.5rem' }}>{talentCount}</div>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>Listos para ascenso</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#854d0e', marginTop: '0.5rem' }}>{readyCount}</div>
        </div>
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: '500' }}>En seguimiento</div>
          <div style={{ fontSize: '2rem', fontWeight: '700', color: '#9a3412', marginTop: '0.5rem' }}>{trackingCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'white', padding: '1.5rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', marginBottom: '2rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', color: '#111827' }}>Filtros</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>Equipo</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
            >
              <option value="">Seleccione un equipo</option>
              {teams.map(t => (
                <option key={t.id} value={t.id}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>Nivel</label>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
            >
              <option value="">Todos los niveles</option>
              <option value="TALENTO_DESTACADO">Talento Destacado</option>
              <option value="LISTO_PARA_ASCENSO">Listo para Ascenso</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', color: '#374151', marginBottom: '0.5rem' }}>Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
            >
              <option value="">Todos los estados</option>
              <option value="ACTIVA">Activa</option>
              <option value="REVISADA">Revisada</option>
              <option value="SEGUIMIENTO">Seguimiento</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => { setTeamFilter(''); setLevelFilter(''); setStatusFilter(''); }}
              style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', width: '100%' }}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* List / Empty State */}
      {isLoading ? (
        <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>Cargando recomendaciones...</p>
      ) : recommendations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', background: 'white', borderRadius: '0.5rem', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#111827', fontSize: '1.25rem' }}>No hay recomendaciones de ascenso disponibles.</h3>
          <p style={{ margin: 0, color: '#6b7280' }}>Genere recomendaciones cuando existan al menos 3 análisis IA completados por jugador.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          {recommendations.map(r => {
            const levelStyle = getLevelColor(r.nivel);
            const statusStyle = getStatusColor(r.estado);
            return (
              <div key={r.id} style={{ background: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#f8fafc', border: `3px solid ${levelStyle.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', fontWeight: 'bold', color: levelStyle.text }}>
                      {parseFloat(r.score_promedio).toFixed(0)}
                    </div>
                    <div>
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.25rem', color: '#111827' }}>{r.jugador_nombre} {r.jugador_apellido}</h3>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.875rem', color: '#4b5563', background: '#f3f4f6', padding: '0.1rem 0.5rem', borderRadius: '1rem' }}>{r.equipo_actual_nombre}</span>
                        <span style={{ fontSize: '0.875rem', color: '#4b5563', background: '#f3f4f6', padding: '0.1rem 0.5rem', borderRadius: '1rem' }}>{r.categoria_actual} ➔ {r.categoria_recomendada}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ background: levelStyle.bg, color: levelStyle.text, border: `1px solid ${levelStyle.border}`, padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: '600', letterSpacing: '0.05em' }}>
                      {r.nivel.replace(/_/g, ' ')}
                    </span>
                    <span style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}`, padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: '600' }}>
                      {r.estado}
                    </span>
                  </div>
                </div>
                
                <div style={{ padding: '1.5rem', background: '#fdfdfd' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Motivo de la recomendación</h4>
                      <p style={{ margin: 0, color: '#1f2937', fontSize: '0.95rem', lineHeight: '1.5' }}>{r.motivo}</p>
                      <p style={{ margin: '0.5rem 0 0 0', color: '#4b5563', fontSize: '0.875rem' }}><em>Análisis IA considerados: {r.analisis_considerados}</em></p>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sugerencia IA</h4>
                      <p style={{ margin: 0, color: '#1f2937', fontSize: '0.95rem', lineHeight: '1.5' }}>{r.recomendacion}</p>
                      {r.accion_seguimiento && (
                        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '0.25rem' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: '#b45309', marginBottom: '0.25rem' }}>ACCIÓN DE SEGUIMIENTO:</span>
                          <span style={{ fontSize: '0.875rem', color: '#92400e' }}>{r.accion_seguimiento}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1rem 1.5rem', background: '#f9fafb', borderTop: '1px solid #f3f4f6', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  {r.estado === 'ACTIVA' && (
                    <button
                      onClick={() => markAsReviewed(r.id)}
                      style={{ padding: '0.5rem 1rem', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500', transition: 'background 0.2s' }}
                      onMouseOver={(e) => e.target.style.background = '#f3f4f6'}
                      onMouseOut={(e) => e.target.style.background = 'white'}
                    >
                      Marcar como revisada
                    </button>
                  )}
                  {r.estado !== 'SEGUIMIENTO' && (
                    <button
                      onClick={() => setTrackingModal({ show: true, id: r.id, text: '' })}
                      style={{ padding: '0.5rem 1rem', background: '#f59e0b', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500', transition: 'background 0.2s' }}
                      onMouseOver={(e) => e.target.style.background = '#d97706'}
                      onMouseOut={(e) => e.target.style.background = '#f59e0b'}
                    >
                      Crear seguimiento
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tracking Modal */}
      {trackingModal.show && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#111827' }}>Crear Seguimiento</h3>
            <p style={{ margin: '0 0 1rem 0', color: '#4b5563', fontSize: '0.875rem' }}>Escribe la acción o plan de desarrollo técnico que vas a ejecutar para este jugador.</p>
            <textarea
              style={{ width: '100%', height: '100px', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', marginBottom: '1rem', resize: 'vertical' }}
              value={trackingModal.text}
              onChange={e => setTrackingModal({ ...trackingModal, text: e.target.value })}
              placeholder="Ej. Invitar a entrenar con la Sub-17 los días martes..."
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button 
                onClick={() => setTrackingModal({ show: false, id: null, text: '' })}
                style={{ padding: '0.5rem 1rem', background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={saveTracking}
                disabled={!trackingModal.text.trim()}
                style={{ padding: '0.5rem 1rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: trackingModal.text.trim() ? 'pointer' : 'not-allowed', opacity: trackingModal.text.trim() ? 1 : 0.5 }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PromotionRecommendationsPage
