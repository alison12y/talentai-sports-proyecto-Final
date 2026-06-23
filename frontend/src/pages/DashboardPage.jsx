import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'
import ParentPortalPage from './ParentPortalPage'

const formatDate = (dateString) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date)
}

function CoachDashboard({ data, user, handleLogout }) {
  const navigate = useNavigate()

  // 1. Alertas Activas
  const alertas = useMemo(() => {
    const list = []
    const pendingConv = data.convocatorias.filter(c => c.estado === 'PENDIENTE')
    if (pendingConv.length > 0) {
      list.push(`Hay ${pendingConv.length} convocatorias pendientes de respuesta por parte de los jugadores.`)
    }
    const ausencias = data.asistencias.filter(a => a.estado === 'AUSENTE')
    if (ausencias.length > 0) {
      list.push(`Se han registrado ${ausencias.length} ausencias recientes que podrían requerir atención.`)
    }
    const altasRiesgo = data.alertasLesion?.filter(a => a.estado === 'ACTIVA' && a.nivel === 'CRITICAL') || []
    if (altasRiesgo.length > 0) {
      list.push(`Hay ${altasRiesgo.length} jugador(es) con riesgo CRITICAL de lesión. Recomendamos revisar sus métricas y reducir carga física.`)
    }
    const mediasRiesgo = data.alertasLesion?.filter(a => a.estado === 'ACTIVA' && a.nivel === 'WARNING') || []
    if (mediasRiesgo.length > 0) {
      list.push(`Hay ${mediasRiesgo.length} jugador(es) con riesgo WARNING de lesión.`)
    }
    return list
  }, [data.convocatorias, data.asistencias, data.alertasLesion])

  // 2. Próximo Evento
  const proximoEvento = useMemo(() => {
    const futuros = data.eventos.filter(e => e.estado !== 'FINALIZADO' && e.estado !== 'CANCELADO')
    futuros.sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))
    const evento = futuros[0]
    if (!evento) return null

    const convEvento = data.convocatorias.filter(c => String(c.evento?.id || c.evento) === String(evento.id))
    const confirmados = convEvento.filter(c => c.estado === 'CONFIRMADO').length
    const pendientes = convEvento.filter(c => c.estado === 'PENDIENTE').length
    const rechazados = convEvento.filter(c => c.estado === 'RECHAZADO').length

    return { ...evento, total: convEvento.length, confirmados, pendientes, rechazados }
  }, [data.eventos, data.convocatorias])

  // 3. Top Rendimiento
  const topRendimiento = useMemo(() => {
    const statsByPlayer = {}
    data.estadisticas.forEach(est => {
      const jId = String(est.jugador?.id || est.jugador)
      if (!statsByPlayer[jId]) {
        statsByPlayer[jId] = { goles: 0, asistencias: 0, minutos: 0, id: jId }
      }
      statsByPlayer[jId].goles += (est.goles || 0)
      statsByPlayer[jId].asistencias += (est.asistencias || 0)
      statsByPlayer[jId].minutos += (est.minutos_jugados || 0)
    })

    const arr = Object.values(statsByPlayer)
    arr.sort((a, b) => (b.goles + b.asistencias) - (a.goles + a.asistencias))
    const top = arr.slice(0, 3).map(st => {
      const jugador = data.jugadores.find(j => String(j.id) === st.id)
      return { ...st, jugador }
    }).filter(st => st.jugador)

    return top
  }, [data.estadisticas, data.jugadores])

  // 4. Estado de Convocatorias (Global)
  const convGlobal = useMemo(() => {
    return {
      confirmadas: data.convocatorias.filter(c => c.estado === 'CONFIRMADO').length,
      pendientes: data.convocatorias.filter(c => c.estado === 'PENDIENTE').length,
      rechazadas: data.convocatorias.filter(c => c.estado === 'RECHAZADO').length,
    }
  }, [data.convocatorias])

  return (
    <section className="page page-fluid">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard del Entrenador</p>
          <h1>Bienvenido, {user?.nombre || 'Entrenador'}</h1>
          <p>Resumen de tu equipo y actividad deportiva.</p>
        </div>
        {user ? (
          <button type="button" className="button-secondary" onClick={handleLogout}>
            Cerrar sesión
          </button>
        ) : (
          <button type="button" className="button-primary" onClick={() => navigate('/login')}>
            Ir a login
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* 1. Alertas Activas */}
        <section>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--navy)' }}>Alertas Activas</h2>
          {alertas.length === 0 ? (
            <div className="clubs-alert" style={{ background: 'var(--panel-soft)', borderColor: 'var(--border)', color: 'var(--muted)' }}>
              No hay alertas críticas por ahora.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {alertas.slice(0, 3).map((alerta, i) => (
                <div key={i} className="clubs-alert clubs-alert-error" role="alert" style={{ margin: 0 }}>
                  <span style={{ marginRight: '0.5rem' }}>⚠️</span> {alerta}
                </div>
              ))}
              <div style={{ marginTop: '0.5rem' }}>
                <Link to="/alertas-lesion" className="button-primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Ver todas las alertas de lesión</Link>
              </div>
            </div>
          )}
        </section>

        {/* Talentos Destacados */}
        <section>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--navy)' }}>Talentos Destacados</h2>
          {(!data.recomendacionesAscenso || data.recomendacionesAscenso.filter(r => r.estado === 'ACTIVA').length === 0) ? (
            <div className="clubs-alert" style={{ background: 'var(--panel-soft)', borderColor: 'var(--border)', color: 'var(--muted)' }}>
              No hay talentos destacados activos.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {data.recomendacionesAscenso.filter(r => r.estado === 'ACTIVA').slice(0, 3).map((rec, i) => {
                const isReady = rec.nivel === 'LISTO_PARA_ASCENSO';
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#fdfdfd', border: '1px solid #e5e7eb', borderRadius: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: isReady ? '#fef08a' : '#ede9fe', border: `2px solid ${isReady ? '#fde047' : '#c4b5fd'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold', color: isReady ? '#854d0e' : '#6d28d9' }}>
                        {parseFloat(rec.score_promedio).toFixed(0)}
                      </div>
                      <div>
                        <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '1rem', color: '#111827' }}>{rec.jugador_nombre} {rec.jugador_apellido}</h4>
                        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{rec.categoria_actual} ➔ {rec.categoria_recomendada}</span>
                      </div>
                    </div>
                    <div>
                      <span style={{ background: isReady ? '#fef08a' : '#ede9fe', color: isReady ? '#854d0e' : '#6d28d9', padding: '0.2rem 0.6rem', borderRadius: '1rem', fontSize: '0.7rem', fontWeight: '600' }}>
                        {rec.nivel.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div style={{ marginTop: '0.5rem' }}>
                <Link to="/recomendaciones-ascenso" className="button-primary" style={{ display: 'inline-block', textDecoration: 'none', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>Ver todas las recomendaciones</Link>
              </div>
            </div>
          )}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          
          {/* 2. Próximo Evento */}
          <section className="card" style={{ background: 'var(--panel)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="eyebrow">Próximo Evento</p>
            {proximoEvento ? (
              <>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{proximoEvento.titulo}</h3>
                <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                  <p>📅 {formatDate(proximoEvento.fecha_inicio)}</p>
                  <p>📍 {proximoEvento.ubicacion || 'Sin ubicación'}</p>
                </div>
                
                <h4 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '0.75rem' }}>Estado de Convocatoria</h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="callup-status" style={{ background: 'var(--panel-soft)', color: 'var(--text)' }}>
                    Total: {proximoEvento.total}
                  </span>
                  <span className="callup-status callup-status-confirmado">
                    Confirmados: {proximoEvento.confirmados}
                  </span>
                  <span className="callup-status callup-status-pendiente">
                    Pendientes: {proximoEvento.pendientes}
                  </span>
                  <span className="callup-status callup-status-rechazado" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                    Rechazados: {proximoEvento.rechazados}
                  </span>
                </div>
              </>
            ) : (
              <div className="categories-empty" style={{ padding: '2rem 1rem' }}>
                <span className="categories-empty-icon">📅</span>
                <strong>No hay próximos eventos</strong>
                <p>No tienes eventos programados próximamente.</p>
              </div>
            )}
          </section>

          {/* 3. Top Rendimiento */}
          <section className="card" style={{ background: 'var(--panel)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="eyebrow">Top Rendimiento</p>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Jugadores Destacados</h3>
            {topRendimiento.length === 0 ? (
              <div className="categories-empty" style={{ padding: '1rem' }}>
                <span className="categories-empty-icon">⭐</span>
                <strong>Sin estadísticas</strong>
                <p>Aún no hay estadísticas suficientes para destacar jugadores.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {topRendimiento.map((st, i) => (
                  <div key={st.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--panel-soft)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#b45309' }}>#{i + 1}</span>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.95rem' }}>{st.jugador.nombre} {st.jugador.apellido}</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{st.minutos} min jugados</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>{st.goles}</strong> <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Goles</span>
                      <br />
                      <strong style={{ color: 'var(--sport)', fontSize: '1.1rem' }}>{st.asistencias}</strong> <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>Asist.</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          
          {/* 4. Estado de Convocatorias Global */}
          <section className="card" style={{ background: 'var(--panel)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="eyebrow">Métricas</p>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Estado Global de Convocatorias</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', textAlign: 'center' }}>
              <div style={{ padding: '1rem', background: 'var(--sport-soft)', borderRadius: '12px', color: 'var(--sport)' }}>
                <span style={{ display: 'block', fontSize: '2rem', fontWeight: '900' }}>{convGlobal.confirmadas}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Confirmadas</span>
              </div>
              <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '12px', color: '#d97706' }}>
                <span style={{ display: 'block', fontSize: '2rem', fontWeight: '900' }}>{convGlobal.pendientes}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Pendientes</span>
              </div>
              <div style={{ padding: '1rem', background: 'var(--danger-soft)', borderRadius: '12px', color: 'var(--danger)' }}>
                <span style={{ display: 'block', fontSize: '2rem', fontWeight: '900' }}>{convGlobal.rechazadas}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Rechazadas</span>
              </div>
            </div>
          </section>

          {/* 5. Accesos Rápidos del Entrenador */}
          <section className="card" style={{ background: 'linear-gradient(135deg, var(--navy), #1e293b)', color: 'white', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="eyebrow" style={{ color: 'var(--primary-soft)' }}>Accesos Rápidos</p>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Acciones Frecuentes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <Link to="/asistencias" className="button-primary" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                📋 Pasar Lista
              </Link>
              <Link to="/estadisticas" className="button-primary" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                📊 Cargar Estadísticas
              </Link>
              <button type="button" className="button-primary" style={{ textAlign: 'center', background: 'var(--primary)', cursor: 'not-allowed', opacity: 0.8 }}>
                🤖 Ver Informe IA (Próximamente)
              </button>
            </div>
          </section>
          
        </div>
      </div>
    </section>
  )
}

function CoordinatorDashboard({ data, user, handleLogout }) {
  const navigate = useNavigate()

  const futurosEventos = data.eventos.filter(e => e.estado !== 'FINALIZADO' && e.estado !== 'CANCELADO')
  const pagosVencidos = data.pagos?.filter(p => p.estado === 'VENCIDO') || []
  const pagosPendientes = data.pagos?.filter(p => p.estado === 'PENDIENTE') || []
  const pagosPagados = data.pagos?.filter(p => p.estado === 'PAGADO') || []
  const montoPendiente = [...pagosVencidos, ...pagosPendientes].reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0)

  // Alertas
  const alertas = []
  if (pagosVencidos.length > 0) {
    alertas.push(`Hay ${pagosVencidos.length} pagos vencidos que requieren seguimiento.`)
  }
  const eventosSinConv = futurosEventos.filter(e => {
    const convs = data.convocatorias.filter(c => String(c.evento) === String(e.id) || String(c.evento?.id) === String(e.id))
    return convs.length === 0
  })
  if (eventosSinConv.length > 0) {
    alertas.push(`Existen ${eventosSinConv.length} eventos próximos sin convocatorias generadas.`)
  }

  return (
    <section className="page page-fluid">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard del Coordinador</p>
          <h1>Bienvenido, {user?.nombre || 'Coordinador'}</h1>
          <p>Panel administrativo y financiero del club.</p>
        </div>
        {user ? (
          <button type="button" className="button-secondary" onClick={handleLogout}>
            Cerrar sesión
          </button>
        ) : (
          <button type="button" className="button-primary" onClick={() => navigate('/login')}>
            Ir a login
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gap: '2rem' }}>
        {/* Alertas */}
        <section>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--navy)' }}>Alertas Administrativas</h2>
          {alertas.length === 0 ? (
            <div className="clubs-alert" style={{ background: 'var(--panel-soft)', borderColor: 'var(--border)', color: 'var(--muted)' }}>
              No hay alertas administrativas por ahora.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {alertas.map((alerta, i) => (
                <div key={i} className="clubs-alert clubs-alert-error" role="alert" style={{ margin: 0 }}>
                  <span style={{ marginRight: '0.5rem' }}>⚠️</span> {alerta}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Resumen General */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', border: '1px solid var(--border)' }}>
            <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--primary)' }}>{data.jugadores.length}</strong>
            <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 'bold' }}>Jugadores</span>
          </div>
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', border: '1px solid var(--border)' }}>
            <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--primary)' }}>{data.equipos?.length || 0}</strong>
            <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 'bold' }}>Equipos</span>
          </div>
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', border: '1px solid var(--border)' }}>
            <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--primary)' }}>{futurosEventos.length}</strong>
            <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 'bold' }}>Eventos Próximos</span>
          </div>
          <div className="card" style={{ padding: '1.5rem', textAlign: 'center', border: '1px solid var(--border)' }}>
            <strong style={{ display: 'block', fontSize: '2rem', color: 'var(--danger)' }}>{pagosVencidos.length + pagosPendientes.length}</strong>
            <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 'bold' }}>Pagos Pendientes</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
          
          {/* Estado Financiero */}
          <section className="card" style={{ background: 'var(--panel)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="eyebrow">Finanzas</p>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Estado Financiero</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <span>Cuotas generadas:</span>
                <strong>{data.cuotas?.length || 0}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <span>Pagos al día (PAGADO):</span>
                <strong style={{ color: 'var(--sport)' }}>{pagosPagados.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <span>Pagos pendientes:</span>
                <strong style={{ color: 'var(--warning)' }}>{pagosPendientes.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <span>Pagos vencidos:</span>
                <strong style={{ color: 'var(--danger)' }}>{pagosVencidos.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', padding: '1rem', background: 'var(--danger-soft)', borderRadius: '8px' }}>
                <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>Monto total por cobrar:</span>
                <strong style={{ color: 'var(--danger)', fontSize: '1.1rem' }}>${montoPendiente.toFixed(2)}</strong>
              </div>
            </div>
          </section>

          {/* Accesos Rápidos */}
          <section className="card" style={{ background: 'var(--panel)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="eyebrow">Gestión Administrativa</p>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Accesos Rápidos</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <Link to="/eventos" className="button-secondary" style={{ textAlign: 'center', height: 'auto', padding: '1rem' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>📅</span>
                Crear Evento
              </Link>
              <Link to="/cuotas" className="button-secondary" style={{ textAlign: 'center', height: 'auto', padding: '1rem' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>💰</span>
                Generar Cuota
              </Link>
              <Link to="/cuotas" className="button-secondary" style={{ textAlign: 'center', height: 'auto', padding: '1rem' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>✅</span>
                Revisar Pagos
              </Link>
              <Link to="/jugadores" className="button-secondary" style={{ textAlign: 'center', height: 'auto', padding: '1rem' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>👤</span>
                Gestionar Jugadores
              </Link>
              <Link to="/equipos" className="button-secondary" style={{ textAlign: 'center', height: 'auto', padding: '1rem', gridColumn: '1 / -1' }}>
                <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }}>🛡️</span>
                Gestionar Equipos
              </Link>
            </div>
          </section>
          
        </div>
      </div>
    </section>
  )
}

function PlayerDashboard({ data, user, handleLogout }) {
  // Identificar jugador a partir del usuario
  // En este MVP, si no hay ID explícito, lo buscamos por nombre/apellido
  const jugador = data.jugadores.find(j => 
    String(j.usuario_id) === String(user?.id) || 
    (j.nombre === user?.nombre && j.apellido === user?.apellido)
  )

  const proximos = data.eventos.filter(e => e.estado !== 'FINALIZADO' && e.estado !== 'CANCELADO')
  proximos.sort((a, b) => new Date(a.fecha_inicio) - new Date(b.fecha_inicio))
  
  let miProximoEvento = null
  let miConvocatoria = null

  if (jugador) {
    // Buscar próximo evento donde el jugador esté convocado
    for (const ev of proximos) {
      const conv = data.convocatorias.find(c => 
        (String(c.jugador?.id || c.jugador) === String(jugador.id)) && 
        (String(c.evento?.id || c.evento) === String(ev.id))
      )
      if (conv) {
        miProximoEvento = ev
        miConvocatoria = conv
        break
      }
    }
  }

  return (
    <section className="page page-fluid">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard del Jugador</p>
          <h1>Hola, {user?.nombre || 'Jugador'}</h1>
          <p>Tu resumen deportivo personal.</p>
        </div>
        <button type="button" className="button-secondary" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>

      {!jugador ? (
        <div className="categories-empty" style={{ margin: '2rem 0' }}>
          <span className="categories-empty-icon">👤</span>
          <strong>Perfil no vinculado</strong>
          <p>Tu cuenta aún no está enlazada a un registro de jugador.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2rem' }}>
          
          <section className="parent-player-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}>
                {jugador.nombre.charAt(0)}{jugador.apellido.charAt(0)}
              </div>
              <div>
                <span className="eyebrow" style={{ display: 'block' }}>Mi Perfil Deportivo</span>
                <strong style={{ fontSize: '1.25rem' }}>{jugador.nombre} {jugador.apellido}</strong>
                <small style={{ display: 'block', color: 'var(--muted)' }}>
                  {jugador.equipo || jugador.categoria || 'Sin equipo asignado'}
                </small>
              </div>
            </div>
          </section>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            
            <section className="card" style={{ background: 'var(--panel)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <p className="eyebrow">Próximo Evento</p>
              {miProximoEvento ? (
                <>
                  <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{miProximoEvento.titulo}</h3>
                  <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    <p>📅 {formatDate(miProximoEvento.fecha_inicio)}</p>
                    <p>📍 {miProximoEvento.ubicacion || 'Sin ubicación'}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--panel-soft)', borderRadius: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>Mi Estado:</span>
                    <span className={`callup-status callup-status-${miConvocatoria.estado.toLowerCase()}`}>
                      {miConvocatoria.estado}
                    </span>
                  </div>
                </>
              ) : (
                <div className="categories-empty" style={{ padding: '1rem' }}>
                  <span className="categories-empty-icon">📅</span>
                  <strong>Sin eventos</strong>
                  <p>No tienes eventos próximos programados.</p>
                </div>
              )}
            </section>

            <section className="card" style={{ background: 'linear-gradient(135deg, var(--navy), #1e293b)', color: 'white', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              <p className="eyebrow" style={{ color: 'var(--primary-soft)' }}>Mis Accesos</p>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Revisa tu actividad</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <Link to="/notificaciones" className="button-primary" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  🔔 Mis Notificaciones
                </Link>
                <button type="button" className="button-primary" style={{ textAlign: 'center', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'not-allowed', opacity: 0.8 }}>
                  📈 Mi Evolución Física (Pronto)
                </button>
                <button type="button" className="button-primary" style={{ textAlign: 'center', background: 'var(--primary)', cursor: 'not-allowed', opacity: 0.8 }}>
                  📊 Mis Estadísticas (Pronto)
                </button>
              </div>
            </section>
            
          </div>
        </div>
      )}
    </section>
  )
}

function DefaultDashboard({ activeRole, user, handleLogout }) {
  const navigate = useNavigate()
  return (
    <section className="page page-fluid">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard General</p>
          <h1>Bienvenido, {user?.nombre || 'Usuario'}</h1>
          <p>Tu rol ({activeRole}) no tiene un panel especializado aún.</p>
        </div>
        <button type="button" className="button-secondary" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const user = useMemo(() => {
    const storedUser = localStorage.getItem('user')
    return storedUser ? JSON.parse(storedUser) : null
  }, [])

  const activeRole = useMemo(() => {
    const membershipsStr = localStorage.getItem('memberships')
    const memberships = membershipsStr ? JSON.parse(membershipsStr) : []
    const activeMembershipStr = localStorage.getItem('activeMembership')
    const activeMembership = activeMembershipStr ? JSON.parse(activeMembershipStr) : null
    
    const role = activeMembership?.rol || user?.rol || user?.role || memberships[0]?.rol || ''
    return String(role).trim().toUpperCase()
  }, [user])

  const [data, setData] = useState({
    jugadores: [], eventos: [], convocatorias: [],
    partidos: [], asistencias: [], estadisticas: [],
    equipos: [], cuotas: [], pagos: [], alertasLesion: [],
    recomendacionesAscenso: []
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }

    // Always fetch base stats
    const endpoints = [
      api.get('/jugadores/'),
      api.get('/eventos/'),
      api.get('/convocatorias/'),
      api.get('/partidos/'),
      api.get('/asistencias/'),
      api.get('/estadisticas-partido/'),
      api.get('/alertas-riesgo-lesion/'),
      api.get('/recomendaciones-ascenso/?estado=ACTIVA')
    ]

    // Fetch extra data for Coordinator
    if (activeRole === 'COORDINADOR' || activeRole === 'ADMINISTRADOR') {
      endpoints.push(api.get('/equipos/'))
      endpoints.push(api.get('/cuotas/'))
      endpoints.push(api.get('/pagos/'))
    }

    Promise.allSettled(endpoints).then((results) => {
      const extractData = (r) => r && r.status === 'fulfilled' ? (Array.isArray(r.value.data) ? r.value.data : r.value.data.results || []) : []
      setData({
        jugadores: extractData(results[0]),
        eventos: extractData(results[1]),
        convocatorias: extractData(results[2]),
        partidos: extractData(results[3]),
        asistencias: extractData(results[4]),
        estadisticas: extractData(results[5]),
        alertasLesion: extractData(results[6]),
        recomendacionesAscenso: extractData(results[7]),
        equipos: extractData(results[8]),
        cuotas: extractData(results[9]),
        pagos: extractData(results[10]),
      })
      setIsLoading(false)
    })
  }, [user, activeRole])

  if (!user) {
    return <div className="categories-empty" style={{ margin: '2rem' }}>Cargando sesión...</div>
  }

  if (activeRole === 'PADRE') {
    return <ParentPortalPage isDashboard={true} />
  }

  if (isLoading) {
    return (
      <section className="page page-fluid">
        <div className="categories-empty" style={{ margin: '2rem 0' }}>
          <span className="clubs-loader" />
          <strong>Cargando tu panel...</strong>
        </div>
      </section>
    )
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('memberships')
    localStorage.removeItem('activeMembership')
    localStorage.removeItem('role')
    localStorage.removeItem('token')
    navigate('/login')
  }

  if (activeRole === 'COORDINADOR' || activeRole === 'ADMINISTRADOR') {
    return <CoordinatorDashboard data={data} user={user} handleLogout={handleLogout} />
  }

  if (activeRole === 'ENTRENADOR') {
    return <CoachDashboard data={data} user={user} handleLogout={handleLogout} />
  }

  if (activeRole === 'JUGADOR') {
    return <PlayerDashboard data={data} user={user} handleLogout={handleLogout} />
  }

  // Fallback for unknown roles
  return <DefaultDashboard activeRole={activeRole} user={user} handleLogout={handleLogout} />
}
