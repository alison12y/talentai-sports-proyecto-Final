import { useEffect, useMemo, useState } from 'react'

import api from '../api/axios'

const ATTENDANCE_STATES = [
  ['PRESENTE', 'Presente'],
  ['AUSENTE', 'Ausente'],
  ['JUSTIFICADO', 'Justificado'],
]

const asList = (data) => (Array.isArray(data) ? data : data?.results || [])
const relationId = (value) => String(value?.id || value || '')

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const firstError = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(firstError).find(Boolean)
  if (value && typeof value === 'object') {
    return Object.values(value).map(firstError).find(Boolean)
  }
  return ''
}

const requestError = (error, fallback) => firstError(error.response?.data) || fallback

function AttendancePage() {
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [events, setEvents] = useState([])
  const [players, setPlayers] = useState([])
  const [callUps, setCallUps] = useState([])
  const [attendances, setAttendances] = useState([])
  const [eventAttendances, setEventAttendances] = useState([])
  const [draft, setDraft] = useState([])
  const [clubFilter, setClubFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [summaryPlayer, setSummaryPlayer] = useState(null)
  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSummaryOpen, setIsSummaryOpen] = useState(false)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/clubes/'),
      api.get('/equipos/'),
      api.get('/eventos/'),
      api.get('/jugadores/'),
      api.get('/convocatorias/'),
      api.get('/asistencias/'),
    ])
      .then(([clubsResponse, teamsResponse, eventsResponse, playersResponse, callUpsResponse, attendancesResponse]) => {
        if (!active) return
        const loadedClubs = asList(clubsResponse.data)
        setClubs(loadedClubs)
        setTeams(asList(teamsResponse.data))
        setEvents(asList(eventsResponse.data))
        setPlayers(asList(playersResponse.data))
        setCallUps(asList(callUpsResponse.data))
        setAttendances(asList(attendancesResponse.data))
        if (loadedClubs.length) setClubFilter(String(loadedClubs[0].id))
      })
      .catch(() => {
        if (active) setPageError('No pudimos cargar la información de asistencia. Verifica que el backend esté disponible.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [])

  const playerById = useMemo(() => new Map(players.map(
    (player) => [String(player.id), player],
  )), [players])

  const eventById = useMemo(() => new Map(events.map(
    (event) => [String(event.id), event],
  )), [events])

  const clubTeams = useMemo(() => teams.filter(
    (team) => relationId(team.club) === clubFilter && team.activo !== false,
  ), [clubFilter, teams])

  const trainingEvents = useMemo(() => events.filter((event) => (
    event.tipo === 'ENTRENAMIENTO'
    && relationId(event.club) === clubFilter
    && relationId(event.equipo) === teamFilter
  )), [clubFilter, events, teamFilter])

  const selectedEvent = eventById.get(eventFilter)

  const visibleAttendances = useMemo(() => attendances.filter((attendance) => {
    const event = eventById.get(relationId(attendance.evento))
    if (!event || event.tipo !== 'ENTRENAMIENTO') return false
    if (clubFilter && relationId(event.club) !== clubFilter) return false
    if (teamFilter && relationId(event.equipo) !== teamFilter) return false
    if (eventFilter && String(event.id) !== eventFilter) return false
    return true
  }), [attendances, clubFilter, eventById, eventFilter, teamFilter])

  const buildDraft = (eventId, existing) => {
    const event = eventById.get(eventId)
    if (!event) return []
    const eligibleIds = new Set(existing.map((attendance) => relationId(attendance.jugador)))
    players.forEach((player) => {
      if (player.estado === 'ACTIVO' && relationId(player.equipo_actual) === relationId(event.equipo)) {
        eligibleIds.add(String(player.id))
      }
    })
    callUps.forEach((callUp) => {
      if (relationId(callUp.evento) === eventId && callUp.estado !== 'NO_CONVOCADO') {
        eligibleIds.add(relationId(callUp.jugador))
      }
    })
    const existingByPlayer = new Map(existing.map(
      (attendance) => [relationId(attendance.jugador), attendance],
    ))
    return [...eligibleIds]
      .filter((playerId) => playerById.has(playerId))
      .map((playerId) => {
        const attendance = existingByPlayer.get(playerId)
        return {
          jugador: playerId,
          estado: attendance?.estado || '',
          motivo: attendance?.motivo || '',
        }
      })
      .sort((left, right) => {
        const leftPlayer = playerById.get(left.jugador)
        const rightPlayer = playerById.get(right.jugador)
        return `${leftPlayer?.apellido} ${leftPlayer?.nombre}`.localeCompare(`${rightPlayer?.apellido} ${rightPlayer?.nombre}`)
      })
  }

  const loadEventAttendances = async (eventId) => {
    setEventFilter(eventId)
    setEventAttendances([])
    setDraft([])
    setFormError('')
    setSuccess('')
    if (!eventId) return
    const event = eventById.get(eventId)
    if (event?.tipo !== 'ENTRENAMIENTO') {
      setFormError('Debe seleccionarse un evento de tipo ENTRENAMIENTO.')
      return
    }
    setIsAttendanceLoading(true)
    try {
      const { data } = await api.get(`/eventos/${eventId}/asistencias/`)
      const existing = asList(data)
      setEventAttendances(existing)
      setDraft(buildDraft(eventId, existing))
      setAttendances((current) => [
        ...current.filter((attendance) => relationId(attendance.evento) !== eventId),
        ...existing,
      ])
    } catch (error) {
      setPageError(requestError(error, 'No se pudieron cargar las asistencias del entrenamiento.'))
    } finally {
      setIsAttendanceLoading(false)
    }
  }

  const changeClub = (event) => {
    setClubFilter(event.target.value)
    setTeamFilter('')
    setEventFilter('')
    setEventAttendances([])
    setDraft([])
    setPageError('')
    setFormError('')
    setSuccess('')
  }

  const changeTeam = (event) => {
    setTeamFilter(event.target.value)
    setEventFilter('')
    setEventAttendances([])
    setDraft([])
    setFormError('')
    setSuccess('')
  }

  const updateAttendance = (playerId, field, value) => {
    setDraft((current) => current.map((item) => {
      if (item.jugador !== playerId) return item
      if (field === 'estado') {
        return { ...item, estado: value, motivo: value === 'JUSTIFICADO' ? item.motivo : '' }
      }
      return { ...item, [field]: value }
    }))
    setFormError('')
  }

  const setAllPresent = () => {
    setDraft((current) => current.map((item) => ({
      ...item,
      estado: 'PRESENTE',
      motivo: '',
    })))
    setFormError('')
  }

  const saveAttendances = async () => {
    setFormError('')
    setSuccess('')
    if (!eventFilter) return setFormError('El evento es obligatorio.')
    if (selectedEvent?.tipo !== 'ENTRENAMIENTO') {
      return setFormError('Debe seleccionarse un evento de tipo ENTRENAMIENTO.')
    }
    if (!draft.length) return setFormError('No hay jugadores o asistencias para registrar.')
    const markedAttendances = draft.filter((item) => item.estado)
    if (!markedAttendances.length) {
      return setFormError('Marca al menos un jugador para guardar asistencia.')
    }
    const withoutReason = markedAttendances.find(
      (item) => item.estado === 'JUSTIFICADO' && !item.motivo.trim(),
    )
    if (withoutReason) {
      return setFormError('El motivo es obligatorio para una ausencia justificada.')
    }

    const payload = {
      asistencias: markedAttendances.map((item) => ({
        jugador: item.jugador,
        estado: item.estado,
        motivo: item.estado === 'JUSTIFICADO' ? item.motivo.trim() : '',
      })),
    }
    setIsSaving(true)
    try {
      await api.post(`/eventos/${eventFilter}/registrar-asistencias/`, payload)
      setSuccess('Asistencia del entrenamiento guardada correctamente.')
      const [{ data: eventData }, { data: allData }] = await Promise.all([
        api.get(`/eventos/${eventFilter}/asistencias/`),
        api.get('/asistencias/'),
      ])
      const updated = asList(eventData)
      setEventAttendances(updated)
      setDraft(buildDraft(eventFilter, updated))
      setAttendances(asList(allData))
    } catch (error) {
      setFormError(requestError(error, 'No se pudo registrar la asistencia. Revisa los datos.'))
    } finally {
      setIsSaving(false)
    }
  }

  const openPlayerSummary = async (playerId) => {
    const player = playerById.get(String(playerId))
    if (!player) return
    setSummaryPlayer(player)
    setSummary(null)
    setIsSummaryOpen(true)
    setIsSummaryLoading(true)
    try {
      const { data } = await api.get(`/jugadores/${player.id}/resumen-asistencia/`)
      setSummary(data)
    } catch (error) {
      setPageError(requestError(error, 'No se pudo cargar el resumen del jugador.'))
      setIsSummaryOpen(false)
    } finally {
      setIsSummaryLoading(false)
    }
  }

  const stateLabel = (state) => ATTENDANCE_STATES.find(([value]) => value === state)?.[1] || state

  return (
    <section className="page page-fluid categories-page attendance-page">
      <div className="page-header categories-header">
        <div>
          <p className="eyebrow">Entrenamientos</p>
          <h1>Registro de asistencia</h1>
          <p>Marca la asistencia de jugadores convocados o pertenecientes al equipo.</p>
        </div>
      </div>

      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="attendance-toolbar">
        <label>Club<select value={clubFilter} onChange={changeClub} disabled={isLoading || !clubs.length}>{!clubs.length && <option value="">No hay clubes</option>}{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label>
        <label>Equipo<select value={teamFilter} onChange={changeTeam} disabled={!clubFilter}><option value="">Selecciona un equipo</option>{clubTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label>
        <label>Entrenamiento<select value={eventFilter} onChange={(event) => loadEventAttendances(event.target.value)} disabled={!teamFilter}><option value="">Selecciona un entrenamiento</option>{trainingEvents.map((event) => <option key={event.id} value={event.id}>{event.titulo} · {formatDateTime(event.fecha_inicio)}</option>)}</select></label>
      </div>

      {eventFilter && (
        <section className="attendance-register-panel">
          <div className="attendance-panel-heading">
            <div><span className="eyebrow">Registro masivo</span><h2>{selectedEvent?.titulo || 'Entrenamiento'}</h2><p>{formatDateTime(selectedEvent?.fecha_inicio)} · {eventAttendances.length} registros existentes</p></div>
            <button type="button" className="button-secondary" onClick={setAllPresent} disabled={!draft.length || isSaving}>Marcar todos presentes</button>
          </div>
          {isAttendanceLoading ? <div className="attendance-loading"><span className="clubs-loader" /><strong>Cargando jugadores...</strong></div> : draft.length === 0 ? <div className="attendance-empty"><strong>No hay jugadores para registrar</strong><p>El equipo no tiene jugadores activos ni convocados para este evento.</p></div> : <div className="attendance-roster">{draft.map((item) => {
            const player = playerById.get(item.jugador)
            return <article className="attendance-player-row" key={item.jugador}><div className="attendance-player-name"><span>{player?.numero_camiseta || '—'}</span><div><strong>{player?.nombre} {player?.apellido}</strong><small>{player?.posicion_principal || 'Sin posición registrada'}</small></div></div><div className="attendance-state-buttons" aria-label={`Asistencia de ${player?.nombre}`}>{ATTENDANCE_STATES.map(([value, label]) => <button type="button" key={value} className={`${item.estado === value ? 'is-selected' : ''} state-${value.toLowerCase()}`} onClick={() => updateAttendance(item.jugador, 'estado', value)}>{label}</button>)}</div>{item.estado === 'JUSTIFICADO' && <label className="attendance-reason">Motivo <span>*</span><input value={item.motivo} onChange={(event) => updateAttendance(item.jugador, 'motivo', event.target.value)} placeholder="Ej. Enfermedad" /></label>}<button type="button" className="attendance-summary-link" onClick={() => openPlayerSummary(item.jugador)}>Ver resumen</button></article>
          })}</div>}
          {formError && <div className="clubs-alert clubs-alert-error" role="alert">{formError}</div>}
          <div className="attendance-save-actions"><span>{draft.filter((item) => item.estado).length} de {draft.length} jugadores marcados</span><button type="button" className="button-primary" onClick={saveAttendances} disabled={isSaving || !draft.length}>{isSaving ? 'Guardando...' : 'Guardar asistencia'}</button></div>
        </section>
      )}

      <section className="categories-list-card">
        <div className="categories-list-heading"><div><h2>Asistencias registradas</h2><p>{visibleAttendances.length} {visibleAttendances.length === 1 ? 'registro encontrado' : 'registros encontrados'}</p></div></div>
        {isLoading ? <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando asistencias...</strong></div> : visibleAttendances.length === 0 ? <div className="categories-empty"><span className="categories-empty-icon">A</span><strong>No hay asistencias en esta vista</strong><p>Selecciona un equipo y entrenamiento para comenzar el registro.</p></div> : <div className="categories-grid attendance-grid">{visibleAttendances.map((attendance) => {
          const player = playerById.get(relationId(attendance.jugador))
          const event = eventById.get(relationId(attendance.evento))
          return <article className="category-card attendance-card" key={attendance.id}><div className="category-card-top"><div><span className="category-card-kicker">{event?.titulo || 'Entrenamiento'}</span><h3>{player ? `${player.nombre} ${player.apellido}` : 'Jugador no disponible'}</h3></div><span className={`attendance-status state-${attendance.estado.toLowerCase()}`}>{stateLabel(attendance.estado)}</span></div><p>{attendance.motivo || 'Sin motivo registrado.'}</p><div className="category-card-meta"><span>Fecha de registro <strong>{formatDateTime(attendance.registrado_en)}</strong></span><span>Estado <strong>{stateLabel(attendance.estado)}</strong></span></div><div className="category-actions"><button type="button" onClick={() => openPlayerSummary(attendance.jugador)}>Ver resumen</button></div></article>
        })}</div>}
      </section>

      {isSummaryOpen && summaryPlayer && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsSummaryOpen(false) }}><section className="clubs-modal attendance-summary-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-summary-title"><div className="clubs-modal-header"><div><span className="eyebrow">Historial del jugador</span><h2 id="attendance-summary-title">Resumen de asistencia</h2><p>{summaryPlayer.nombre} {summaryPlayer.apellido}</p></div><button type="button" className="clubs-modal-close" onClick={() => setIsSummaryOpen(false)} aria-label="Cerrar resumen">×</button></div>{isSummaryLoading ? <div className="attendance-loading"><span className="clubs-loader" /></div> : summary && <><div className="attendance-summary-grid"><div><span>Total</span><strong>{summary.total}</strong></div><div><span>Presentes</span><strong>{summary.presentes}</strong></div><div><span>Ausentes</span><strong>{summary.ausentes}</strong></div><div><span>Justificados</span><strong>{summary.justificados}</strong></div></div><div className="attendance-rate"><span>Porcentaje de asistencia</span><strong>{summary.porcentaje_asistencia}%</strong></div><div className="clubs-form-actions"><button type="button" className="button-primary" onClick={() => setIsSummaryOpen(false)}>Cerrar</button></div></>}</section></div>}
    </section>
  )
}

export default AttendancePage
