import { useEffect, useMemo, useState } from 'react'

import api from '../api/axios'

const emptyForm = { evento: '', jugador: '' }
const statuses = [
  ['PENDIENTE', 'Pendiente'],
  ['CONFIRMADO', 'Confirmado'],
  ['RECHAZADO', 'Rechazado'],
  ['NO_CONVOCADO', 'No convocado'],
]

const asList = (data) => (Array.isArray(data) ? data : data?.results || [])
const relationId = (value) => String(value?.id || value || '')

const formatDateTime = (value) => {
  if (!value) return 'Sin notificación'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const requestErrorMessage = (error, fallback) => {
  if (error.response?.status === 403) {
    return 'No tienes permisos para gestionar convocatorias de este club.'
  }
  const data = error.response?.data
  if (!data) return fallback
  for (const field of ['non_field_errors', 'evento', 'equipo', 'jugador', 'estado', 'detail']) {
    const candidate = data[field]
    const message = Array.isArray(candidate) ? candidate[0] : candidate
    if (typeof message === 'string') return message
  }
  return fallback
}

function CallUpsPage() {
  const [callUps, setCallUps] = useState([])
  const [events, setEvents] = useState([])
  const [players, setPlayers] = useState([])
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [clubFilter, setClubFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [summaryEventId, setSummaryEventId] = useState('')
  const [summary, setSummary] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isActive = true
    Promise.all([
      api.get('/convocatorias/'),
      api.get('/eventos/'),
      api.get('/jugadores/'),
      api.get('/clubes/'),
      api.get('/equipos/'),
    ])
      .then(([callUpsResponse, eventsResponse, playersResponse, clubsResponse, teamsResponse]) => {
        if (!isActive) return
        const loadedClubs = asList(clubsResponse.data)
        setCallUps(asList(callUpsResponse.data))
        setEvents(asList(eventsResponse.data))
        setPlayers(asList(playersResponse.data))
        setClubs(loadedClubs)
        setTeams(asList(teamsResponse.data))
        if (loadedClubs.length) setClubFilter(String(loadedClubs[0].id))
      })
      .catch(() => {
        if (isActive) setPageError('No pudimos cargar las convocatorias. Verifica que el backend esté disponible.')
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })
    return () => { isActive = false }
  }, [])

  const eventById = useMemo(() => new Map(events.map(
    (event) => [String(event.id), event],
  )), [events])

  const playerById = useMemo(() => new Map(players.map(
    (player) => [String(player.id), player],
  )), [players])

  const clubTeams = useMemo(() => teams.filter(
    (team) => relationId(team.club) === clubFilter && team.activo !== false,
  ), [clubFilter, teams])

  const filteredEvents = useMemo(() => events.filter((event) => {
    if (clubFilter && relationId(event.club) !== clubFilter) return false
    if (teamFilter && relationId(event.equipo) !== teamFilter) return false
    return true
  }), [clubFilter, events, teamFilter])

  const selectedFormEvent = eventById.get(form.evento)

  const eligiblePlayers = useMemo(() => {
    if (!selectedFormEvent) return []
    return players.filter((player) => {
      if (player.estado !== 'ACTIVO') return false
      if (relationId(player.club) !== relationId(selectedFormEvent.club)) return false
      const eventTeamId = relationId(selectedFormEvent.equipo)
      if (eventTeamId && relationId(player.equipo_actual) !== eventTeamId) return false
      return true
    })
  }, [players, selectedFormEvent])

  const visibleCallUps = useMemo(() => callUps.filter((callUp) => {
    const event = eventById.get(relationId(callUp.evento))
    if (!event) return false
    if (clubFilter && relationId(event.club) !== clubFilter) return false
    if (teamFilter && relationId(event.equipo) !== teamFilter) return false
    if (eventFilter && String(event.id) !== eventFilter) return false
    if (statusFilter && callUp.estado !== statusFilter) return false
    return true
  }), [callUps, clubFilter, eventById, eventFilter, statusFilter, teamFilter])

  const selectedSummaryEvent = eventById.get(summaryEventId)

  const loadCallUps = async () => {
    const { data } = await api.get('/convocatorias/')
    setCallUps(asList(data))
  }

  const loadSummary = async (eventId) => {
    setSummaryEventId(eventId)
    setSummary(null)
    if (!eventId) return
    setIsSummaryLoading(true)
    try {
      const { data } = await api.get(`/eventos/${eventId}/resumen-convocatorias/`)
      setSummary(data)
    } catch (error) {
      setPageError(requestErrorMessage(error, 'No se pudo cargar el resumen de la convocatoria.'))
    } finally {
      setIsSummaryLoading(false)
    }
  }

  const changeClub = (event) => {
    setClubFilter(event.target.value)
    setTeamFilter('')
    setEventFilter('')
    setSummaryEventId('')
    setSummary(null)
    setPageError('')
    setSuccess('')
  }

  const changeTeam = (event) => {
    setTeamFilter(event.target.value)
    setEventFilter('')
    setSummaryEventId('')
    setSummary(null)
  }

  const changeEventFilter = (event) => {
    const eventId = event.target.value
    setEventFilter(eventId)
    loadSummary(eventId)
  }

  const openCreateForm = () => {
    const preferredEvent = eventFilter
      ? eventById.get(eventFilter)
      : filteredEvents.find((event) => event.estado === 'PROGRAMADO')
    setForm({ evento: preferredEvent ? String(preferredEvent.id) : '', jugador: '' })
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
    if (preferredEvent) loadSummary(String(preferredEvent.id))
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setForm(emptyForm)
    setFormError('')
  }

  const changeFormEvent = (event) => {
    const eventId = event.target.value
    setForm({ evento: eventId, jugador: '' })
    setFormError('')
    loadSummary(eventId)
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setFormError('')
    if (!form.evento) return setFormError('El evento es obligatorio.')
    if (!form.jugador) return setFormError('El jugador es obligatorio.')
    if (selectedFormEvent?.estado !== 'PROGRAMADO') {
      return setFormError('No se pueden agregar jugadores a un evento cancelado o finalizado.')
    }

    setIsSaving(true)
    try {
      await api.post('/convocatorias/', {
        evento: form.evento,
        jugador: form.jugador,
      })
      setSuccess('Jugador convocado correctamente.')
      setEventFilter(form.evento)
      setIsFormOpen(false)
      setForm(emptyForm)
      await Promise.all([loadCallUps(), loadSummary(form.evento)])
    } catch (error) {
      setFormError(requestErrorMessage(error, 'No se pudo crear la convocatoria. Revisa los datos.'))
    } finally {
      setIsSaving(false)
    }
  }

  const generateCallUps = async () => {
    if (!summaryEventId || !selectedSummaryEvent) return
    setPendingAction(`generate:${summaryEventId}`)
    setPageError('')
    setSuccess('')
    try {
      const { data } = await api.post(`/eventos/${summaryEventId}/generar-convocatorias/`)
      const created = data.convocatorias_creadas ?? 0
      setSuccess(created
        ? `${created} ${created === 1 ? 'convocatoria generada' : 'convocatorias generadas'} correctamente.`
        : 'La convocatoria ya estaba actualizada; no se generaron duplicados.')
      await Promise.all([loadCallUps(), loadSummary(summaryEventId)])
    } catch (error) {
      setPageError(requestErrorMessage(error, 'No se pudieron generar las convocatorias.'))
    } finally {
      setPendingAction('')
    }
  }

  const removeCallUp = async (callUp) => {
    const player = playerById.get(relationId(callUp.jugador))
    const playerName = player ? `${player.nombre} ${player.apellido}` : 'este jugador'
    if (!window.confirm(`¿Deseas quitar a ${playerName} de la convocatoria?`)) return
    setPendingAction(`delete:${callUp.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/convocatorias/${callUp.id}/`)
      setSuccess('Jugador marcado como no convocado.')
      await Promise.all([
        loadCallUps(),
        summaryEventId ? loadSummary(summaryEventId) : Promise.resolve(),
      ])
    } catch (error) {
      setPageError(requestErrorMessage(error, 'No se pudo quitar al jugador de la convocatoria.'))
    } finally {
      setPendingAction('')
    }
  }

  const clubName = (event) => clubs.find(
    (club) => String(club.id) === relationId(event?.club),
  )?.nombre || 'Club no disponible'

  const teamName = (event) => teams.find(
    (team) => String(team.id) === relationId(event?.equipo),
  )?.nombre || 'Sin equipo'

  const statusLabel = (status) => statuses.find(([value]) => value === status)?.[1] || status
  const canGenerate = selectedSummaryEvent?.estado === 'PROGRAMADO' && relationId(selectedSummaryEvent?.equipo)

  return (
    <section className="page page-fluid categories-page callups-page">
      <div className="page-header categories-header">
        <div>
          <p className="eyebrow">Planteles convocados</p>
          <h1>Gestión de convocatorias</h1>
          <p>Organiza los jugadores llamados a entrenamientos y partidos del club.</p>
        </div>
        <button type="button" className="button-primary" onClick={openCreateForm} disabled={!events.length}>
          + Convocar jugador
        </button>
      </div>

      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="callups-toolbar">
        <label>Club<select value={clubFilter} onChange={changeClub} disabled={isLoading || !clubs.length}>{!clubs.length && <option value="">No hay clubes</option>}{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label>
        <label>Equipo<select value={teamFilter} onChange={changeTeam} disabled={!clubFilter}><option value="">Todos los equipos</option>{clubTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label>
        <label>Evento<select value={eventFilter} onChange={changeEventFilter} disabled={!clubFilter}><option value="">Todos los eventos</option>{filteredEvents.map((event) => <option key={event.id} value={event.id}>{event.titulo} · {event.estado}</option>)}</select></label>
        <label>Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos los estados</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>

      {summaryEventId && (
        <section className="callups-summary-panel">
          <div className="callups-summary-heading">
            <div>
              <span className="eyebrow">Resumen del evento</span>
              <h2>{selectedSummaryEvent?.titulo || 'Convocatoria'}</h2>
              <p>{selectedSummaryEvent ? `${clubName(selectedSummaryEvent)} · ${teamName(selectedSummaryEvent)}` : ''}</p>
            </div>
            <button type="button" className="button-secondary" onClick={generateCallUps} disabled={!canGenerate || pendingAction === `generate:${summaryEventId}`}>
              {pendingAction === `generate:${summaryEventId}` ? 'Generando...' : 'Generar automáticamente'}
            </button>
          </div>
          {isSummaryLoading ? <div className="callups-summary-loading"><span className="clubs-loader" /></div> : summary && (
            <div className="callups-summary-grid">
              <div><span>Total</span><strong>{summary.total}</strong></div>
              <div><span>Pendientes</span><strong>{summary.pendientes}</strong></div>
              <div><span>Confirmados</span><strong>{summary.confirmados}</strong></div>
              <div><span>Rechazados</span><strong>{summary.rechazados}</strong></div>
              <div><span>No convocados</span><strong>{summary.no_convocados}</strong></div>
            </div>
          )}
          {selectedSummaryEvent?.estado !== 'PROGRAMADO' && <p className="callups-summary-note">Este evento está {selectedSummaryEvent?.estado?.toLowerCase()} y no admite nuevas convocatorias.</p>}
          {selectedSummaryEvent?.estado === 'PROGRAMADO' && !relationId(selectedSummaryEvent.equipo) && <p className="callups-summary-note">La generación automática requiere que el evento tenga equipo.</p>}
        </section>
      )}

      <section className="categories-list-card">
        <div className="categories-list-heading"><div><h2>Jugadores convocados</h2><p>{visibleCallUps.length} {visibleCallUps.length === 1 ? 'convocatoria encontrada' : 'convocatorias encontradas'}</p></div></div>
        {isLoading ? <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando convocatorias...</strong></div> : visibleCallUps.length === 0 ? (
          <div className="categories-empty"><span className="categories-empty-icon">+</span><strong>No hay convocatorias en esta vista</strong><p>Selecciona un evento, genera su convocatoria o agrega un jugador manualmente.</p>{!!events.length && <button type="button" className="button-primary" onClick={openCreateForm}>Convocar jugador</button>}</div>
        ) : (
          <div className="categories-grid callups-grid">
            {visibleCallUps.map((callUp) => {
              const event = eventById.get(relationId(callUp.evento))
              const player = playerById.get(relationId(callUp.jugador))
              const busy = pendingAction === `delete:${callUp.id}`
              return (
                <article className="category-card callup-card" key={callUp.id}>
                  <div className="category-card-top"><div><span className="category-card-kicker">{event?.tipo || 'Evento'}</span><h3>{player ? `${player.nombre} ${player.apellido}` : 'Jugador no disponible'}</h3></div><span className={`callup-status callup-status-${callUp.estado.toLowerCase().replace('_', '-')}`}>{statusLabel(callUp.estado)}</span></div>
                  <p>{event?.titulo || 'Evento no disponible'}</p>
                  <div className="category-card-meta callup-card-meta"><span>Equipo <strong>{teamName(event)}</strong></span><span>Notificación <strong>{formatDateTime(callUp.fecha_notificacion)}</strong></span></div>
                  <div className="category-actions callup-actions"><button type="button" className="is-danger" onClick={() => removeCallUp(callUp)} disabled={busy || callUp.estado === 'NO_CONVOCADO'}>{busy ? 'Procesando...' : callUp.estado === 'NO_CONVOCADO' ? 'No convocado' : 'Quitar'}</button></div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {isFormOpen && (
        <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <section className="clubs-modal callup-modal" role="dialog" aria-modal="true" aria-labelledby="callup-form-title">
            <div className="clubs-modal-header"><div><span className="eyebrow">Alta manual</span><h2 id="callup-form-title">Convocar jugador</h2><p>Selecciona un evento programado y un jugador elegible.</p></div><button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button></div>
            <form className="callup-form" onSubmit={submitForm} noValidate>
              <label className="clubs-form-group">Evento <span>*</span><select value={form.evento} onChange={changeFormEvent}><option value="">Selecciona un evento</option>{filteredEvents.map((event) => <option key={event.id} value={event.id}>{event.titulo} · {event.estado}</option>)}</select></label>
              <label className="clubs-form-group">Jugador <span>*</span><select value={form.jugador} onChange={(event) => { setForm((current) => ({ ...current, jugador: event.target.value })); setFormError('') }} disabled={!form.evento || selectedFormEvent?.estado !== 'PROGRAMADO'}><option value="">Selecciona un jugador</option>{eligiblePlayers.map((player) => <option key={player.id} value={player.id}>{player.nombre} {player.apellido}</option>)}</select></label>
              {selectedFormEvent && <div className="callup-event-context"><strong>{selectedFormEvent.titulo}</strong><span>{clubName(selectedFormEvent)} · {teamName(selectedFormEvent)}</span><small>Estado: {selectedFormEvent.estado}</small></div>}
              {selectedFormEvent?.estado !== 'PROGRAMADO' && <div className="teams-form-note">Este evento no permite agregar convocatorias.</div>}
              {formError && <div className="clubs-alert clubs-alert-error" role="alert">{formError}</div>}
              <div className="clubs-form-actions"><button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isSaving || selectedFormEvent?.estado !== 'PROGRAMADO'}>{isSaving ? 'Guardando...' : 'Crear convocatoria'}</button></div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}

export default CallUpsPage
