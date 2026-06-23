import { useEffect, useState } from 'react'
import api from '../api/axios'

function InjuryRiskPage() {
  const [alerts, setAlerts] = useState([])
  const [teams, setTeams] = useState([])
  const [teamFilter, setTeamFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [tab, setTab] = useState('ACTIVA')

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
    loadAlerts()
  }, [teamFilter, tab])

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

  const loadAlerts = async () => {
    setIsLoading(true)
    setError('')
    try {
      let url = '/alertas-riesgo-lesion/?estado=' + tab
      if (teamFilter) {
        url += '&equipo=' + teamFilter
      }
      const { data } = await api.get(url)
      setAlerts(data)
    } catch (e) {
      setError('Error al cargar las alertas.')
    } finally {
      setIsLoading(false)
    }
  }

  const generateAlerts = async () => {
    if (!teamFilter) {
      setError('Debes seleccionar un equipo para generar alertas.')
      return
    }
    setIsGenerating(true)
    setError('')
    setSuccess('')
    try {
      const { data } = await api.post('/alertas-riesgo-lesion/generar/', { equipo: teamFilter })
      setSuccess(data.mensaje || 'Alertas generadas.')
      await loadAlerts()
    } catch (e) {
      setError(e.response?.data?.error || 'Error al generar alertas.')
    } finally {
      setIsGenerating(false)
    }
  }

  const markAsResolved = async (id) => {
    try {
      await api.post(`/alertas-riesgo-lesion/${id}/marcar-vista/`)
      await loadAlerts()
    } catch (e) {
      setError('Error al marcar alerta como vista.')
    }
  }

  const getRiskColor = (level) => {
    switch (level) {
      case 'CRITICAL': return 'var(--color-danger, #ef4444)'
      case 'WARNING': return 'var(--color-warning, #f59e0b)'
      case 'INFO': return 'var(--color-info, #3b82f6)'
      default: return 'var(--color-success, #10b981)'
    }
  }

  const getStatusColor = (status) => {
    return status === 'ACTIVA' ? 'var(--color-primary)' : 'var(--color-text-secondary)'
  }

  return (
    <section className="page page-fluid categories-page">
      <div className="page-header categories-header">
        <div>
          <p className="eyebrow">Salud y Rendimiento</p>
          <h1>Alertas de riesgo de lesión</h1>
          <p>Visualiza alertas preventivas basadas en asistencia, estado físico y rendimiento.</p>
        </div>
        <button type="button" className="button-primary" onClick={generateAlerts} disabled={isGenerating || !teamFilter}>
          {isGenerating ? 'Generando...' : 'Generar alertas'}
        </button>
      </div>

      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {error && <div className="clubs-alert clubs-alert-error" role="alert">{error}</div>}

      <div className="matches-toolbar" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          Equipo
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
            <option value="">Todos los equipos</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--color-border)', marginBottom: '2rem' }}>
        <button type="button" onClick={() => setTab('ACTIVA')} style={{ background: 'transparent', border: 'none', padding: '0.5rem 1rem', borderBottom: tab === 'ACTIVA' ? '2px solid var(--color-primary)' : '2px solid transparent', fontWeight: tab === 'ACTIVA' ? 'bold' : 'normal', cursor: 'pointer' }}>Activas</button>
        <button type="button" onClick={() => setTab('VISTA')} style={{ background: 'transparent', border: 'none', padding: '0.5rem 1rem', borderBottom: tab === 'VISTA' ? '2px solid var(--color-primary)' : '2px solid transparent', fontWeight: tab === 'VISTA' ? 'bold' : 'normal', cursor: 'pointer' }}>Historial</button>
      </div>

      <section className="categories-list-card">
        <div className="categories-list-heading">
          <div>
            <h2>Listado de Alertas</h2>
            <p>{alerts.length} {alerts.length === 1 ? 'alerta encontrada' : 'alertas encontradas'}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando alertas...</strong></div>
        ) : alerts.length === 0 ? (
          <div className="categories-empty">
            <span className="categories-empty-icon">✓</span>
            <strong>No hay alertas registradas</strong>
            <p>Todo en orden o selecciona un equipo y haz clic en "Generar alertas".</p>
          </div>
        ) : (
          <div className="categories-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', padding: '1.5rem' }}>
            {alerts.map((alerta) => (
              <article key={alerta.id} className="category-card" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem' }}>{alerta.jugador_nombre} {alerta.jugador_apellido}</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{alerta.equipo_nombre}</span>
                  </div>
                  <span style={{ padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600, backgroundColor: getRiskColor(alerta.nivel), color: '#fff' }}>
                    {alerta.nivel}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-text)' }}><strong>Minutos jugados (7 días):</strong> {alerta.minutos_semana} min</p>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-text)' }}><strong>Score de riesgo:</strong> {alerta.score_riesgo}</p>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-text)' }}><strong>Motivo:</strong> {alerta.motivo}</p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}><strong>Recomendación:</strong> {alerta.recomendacion}</p>
                </div>
                <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: getStatusColor(alerta.estado) }}>
                    {alerta.estado} {alerta.estado === 'VISTA' && alerta.vista_en && `(el ${new Date(alerta.vista_en).toLocaleDateString()})`}
                  </span>
                  {alerta.estado === 'ACTIVA' && (
                    <button type="button" className="button-ghost" onClick={() => markAsResolved(alerta.id)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      Marcar como vista
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

export default InjuryRiskPage
