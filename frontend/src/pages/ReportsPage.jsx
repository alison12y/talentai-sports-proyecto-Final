import { useState, useEffect } from 'react'
import api from '../api/axios'

function ReportsPage() {
  const [equipos, setEquipos] = useState([])
  const [filtros, setFiltros] = useState({
    tipo: 'equipo',
    equipo: '',
    jugador: '',
    fecha_inicio: '',
    fecha_fin: ''
  })
  
  const [reporte, setReporte] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    api.get('/equipos/').then(res => {
      setEquipos(Array.isArray(res.data) ? res.data : res.data.results || [])
    }).catch(() => setEquipos([]))
  }, [])

  const [jugadoresOpciones, setJugadoresOpciones] = useState([])

  useEffect(() => {
    if (filtros.equipo) {
      api.get(`/reportes/jugadores-por-equipo/?equipo=${filtros.equipo}`)
        .then(res => setJugadoresOpciones(Array.isArray(res.data) ? res.data : []))
        .catch(() => setJugadoresOpciones([]))
    } else {
      setJugadoresOpciones([])
    }
  }, [filtros.equipo])

  const handleFilterChange = (e) => {
    const { name, value } = e.target
    setFiltros(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'tipo' ? { equipo: '', jugador: '' } : {})
    }))
  }

  const generarReporte = async () => {
    if (filtros.tipo === 'equipo' && !filtros.equipo) {
      setError('Debes seleccionar un equipo.')
      return
    }
    if (filtros.tipo === 'jugador' && !filtros.jugador) {
      setError('Debes seleccionar un jugador.')
      return
    }

    setError('')
    setSuccess('')
    setIsLoading(true)
    
    try {
      const params = new URLSearchParams()
      params.append('tipo', filtros.tipo)
      if (filtros.equipo) params.append('equipo', filtros.equipo)
      if (filtros.jugador) params.append('jugador', filtros.jugador)
      if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio)
      if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin)

      const response = await api.get(`/reportes/rendimiento/?${params.toString()}`)
      setReporte(response.data)
    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error)
      } else {
        setError('Ocurrió un error al procesar el reporte.')
      }
      setReporte(null)
    } finally {
      setIsLoading(false)
    }
  }

  const exportarExcel = async () => {
    setIsExporting(true)
    setError('')
    setSuccess('Generando archivo...')
    try {
      const params = new URLSearchParams()
      params.append('tipo', filtros.tipo)
      if (filtros.equipo) params.append('equipo', filtros.equipo)
      if (filtros.jugador) params.append('jugador', filtros.jugador)
      if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio)
      if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin)

      const response = await api.get(`/reportes/rendimiento/exportar-excel/?${params.toString()}`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `reporte-estadisticas-${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      setSuccess('Archivo generado correctamente.')
    } catch (err) {
      setError('No hay datos para exportar o ocurrió un error.')
      setSuccess('')
    } finally {
      setIsExporting(false)
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const exportarPDF = () => {
    window.print()
  }

  return (
    <section className="page page-fluid reports-page">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-report, .printable-report * { visibility: visible; }
          .printable-report { position: absolute; left: 0; top: 0; width: 100%; padding: 2rem; background: white; color: black; }
          .reports-filters, .reports-actions, .topbar, .sidebar, .mobile-nav { display: none !important; }
          .card { border: 1px solid #ddd; box-shadow: none; break-inside: avoid; }
        }
      `}</style>

      <div className="page-header">
        <div>
          <p className="eyebrow">Análisis de Datos</p>
          <h1>Reportes de rendimiento</h1>
          <p>Genera reportes detallados y exporta las estadísticas para compartirlas.</p>
        </div>
      </div>

      <div className="card reports-filters" style={{ background: 'var(--panel)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', marginBottom: '2rem' }}>
        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Filtros del Reporte</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          
          <label style={{ flex: '1 1 200px' }}>
            <span>Tipo de Reporte</span>
            <select name="tipo" value={filtros.tipo} onChange={handleFilterChange} className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <option value="equipo">Por Equipo</option>
              <option value="jugador">Por Jugador</option>
            </select>
          </label>

          <label style={{ flex: '1 1 200px' }}>
            <span>Equipo</span>
            <select name="equipo" value={filtros.equipo} onChange={handleFilterChange} className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <option value="">-- Seleccionar Equipo --</option>
              {equipos.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.nombre}</option>
              ))}
            </select>
          </label>

          {filtros.tipo === 'jugador' && (
            <label style={{ flex: '1 1 200px' }}>
              <span>Jugador</span>
              <select name="jugador" value={filtros.jugador} onChange={handleFilterChange} className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)' }}>
                <option value="">-- Seleccionar Jugador --</option>
                {jugadoresOpciones.map(j => (
                  <option key={j.id} value={j.id}>{j.nombre} {j.apellido}</option>
                ))}
              </select>
            </label>
          )}

          <label style={{ flex: '1 1 150px' }}>
            <span>Fecha Inicio</span>
            <input type="date" name="fecha_inicio" value={filtros.fecha_inicio} onChange={handleFilterChange} className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)' }} />
          </label>
          <label style={{ flex: '1 1 150px' }}>
            <span>Fecha Fin</span>
            <input type="date" name="fecha_fin" value={filtros.fecha_fin} onChange={handleFilterChange} className="form-control" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg)' }} />
          </label>
        </div>

        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button type="button" className="button-primary" onClick={generarReporte} disabled={isLoading}>
            {isLoading ? 'Generando...' : 'Generar reporte'}
          </button>
          
          {error && <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{error}</span>}
          {success && <span style={{ color: 'var(--sport)', fontWeight: 'bold' }}>{success}</span>}
        </div>
      </div>

      {reporte && (
        <>
          <div className="reports-actions" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'flex-end' }}>
            <button type="button" className="button-secondary" onClick={exportarPDF} disabled={isExporting}>
              📄 Exportar PDF
            </button>
            <button type="button" className="button-secondary" onClick={exportarExcel} disabled={isExporting}>
              📊 Exportar Excel
            </button>
          </div>

          <div className="printable-report">
            {/* Header for PDF */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--navy)', paddingBottom: '1rem', marginBottom: '2rem' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '2rem', color: 'var(--navy)' }}>TalentAI Sports</h1>
                <p style={{ margin: 0, color: 'var(--muted)' }}>Reporte de Rendimiento</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0 }}><strong>Fecha:</strong> {new Date().toLocaleDateString()}</p>
                <p style={{ margin: 0 }}><strong>Tipo:</strong> {filtros.tipo.toUpperCase()}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Datos Generales</h3>
                <p><strong>Nombre:</strong> {reporte.resumen?.nombre}</p>
                {reporte.resumen?.equipo && <p><strong>Equipo:</strong> {reporte.resumen.equipo}</p>}
                {reporte.resumen?.posicion && <p><strong>Posición:</strong> {reporte.resumen.posicion}</p>}
                {reporte.resumen?.categoria && <p><strong>Categoría:</strong> {reporte.resumen.categoria}</p>}
                {reporte.resumen?.total_jugadores && <p><strong>Total Jugadores:</strong> {reporte.resumen.total_jugadores}</p>}
              </div>

              <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Actividad</h3>
                <p><strong>Partidos Jugados:</strong> {reporte.partidos?.length || 0}</p>
                <p><strong>Registros de Asistencia:</strong> {reporte.asistencias?.length || 0}</p>
                <p><strong>Registros de Evolución:</strong> {reporte.evolucion_fisica?.length || 0}</p>
                <p><strong>Registros Estadísticos:</strong> {reporte.estadisticas?.length || 0}</p>
              </div>
            </div>

            <h3 style={{ fontSize: '1.5rem', color: 'var(--navy)', marginBottom: '1rem' }}>Estadísticas de Rendimiento</h3>
            {reporte.estadisticas?.length === 0 ? (
              <p style={{ color: 'var(--muted)', background: 'var(--panel)', padding: '1rem', borderRadius: 'var(--radius)' }}>No hay registros suficientes para los filtros seleccionados.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ background: 'var(--panel)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Jugador</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Goles</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Asistencias</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>T. Amarillas</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>T. Rojas</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Minutos</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.estadisticas.map((st, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem' }}>{st.jugador_nombre_completo || st.jugador?.nombre || st.jugador}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--primary)' }}><strong>{st.goles}</strong></td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--sport)' }}><strong>{st.asistencias}</strong></td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{st.tarjetas_amarillas}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--danger)' }}>{st.tarjetas_rojas}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{st.minutos_jugados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h3 style={{ fontSize: '1.5rem', color: 'var(--navy)', marginBottom: '1rem' }}>Evolución Física</h3>
            {reporte.evolucion_fisica?.length === 0 ? (
              <p style={{ color: 'var(--muted)', background: 'var(--panel)', padding: '1rem', borderRadius: 'var(--radius)' }}>No hay registros suficientes para los filtros seleccionados.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ background: 'var(--panel)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Fecha</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Jugador</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Peso (kg)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Altura (cm)</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Velocidad (40m)</th>
                  </tr>
                </thead>
                <tbody>
                  {reporte.evolucion_fisica.map((ev, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem' }}>{ev.fecha_medicion}</td>
                      <td style={{ padding: '0.75rem' }}>{ev.jugador_nombre_completo || ev.jugador?.nombre || ev.jugador}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{ev.peso}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{ev.altura}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>{ev.velocidad_40m || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'var(--panel-soft)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--navy)' }}>Informes IA y Scouting</h3>
              <p style={{ color: 'var(--muted)', margin: 0 }}>No hay registros suficientes para los filtros seleccionados.</p>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default ReportsPage
