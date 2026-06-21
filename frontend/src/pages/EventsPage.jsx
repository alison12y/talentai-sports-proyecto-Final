import { useEffect, useMemo, useState } from 'react'

import api from '../api/axios'

const emptyForm = {
  club: '',
  equipo: '',
  titulo: '',
  descripcion: '',
  tipo: 'ENTRENAMIENTO',
  rival: '',
  fecha_inicio: '',
  fecha_fin: '',
  ubicacion: '',
}

const eventTypes = [
  ['ENTRENAMIENTO', 'Entrenamiento'],
  ['PARTIDO', 'Partido'],
  ['REUNION', 'Reunión'],
  ['OTRO', 'Otro'],
]

const eventStatuses = [
  ['PROGRAMADO', 'Programado'],
  ['CANCELADO', 'Cancelado'],
  ['FINALIZADO', 'Finalizado'],
]

const asList = (data) => (Array.isArray(data) ? data : data?.results || [])
const relationId = (value) => String(value?.id || value || '')

const toLocalDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

const formatDateTime = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const backendMessage = (error, fallback) => {
  if (error.response?.status === 403) {
    return 'No tienes permisos para realizar esta acción. Debes ser entrenador o administrador activo del club.'
  }

  const data = error.response?.data
  if (!data) return fallback
  const fields = [
    'non_field_errors', 'club', 'equipo', 'titulo', 'tipo', 'rival',
    'fecha_inicio', 'fecha_fin', 'ubicacion', 'estado', 'detail',
  ]
  for (const field of fields) {
    const candidate = data[field]
    const message = Array.isArray(candidate) ? candidate[0] : candidate
    if (typeof message === 'string') return message
  }
  return fallback
}

function EventsPage() {
  const [events, setEvents] = useState([])
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [clubFilter, setClubFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingEvent, setEditingEvent] = useState(null)
  const [detailEvent, setDetailEvent] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isActive = true
    Promise.all([
      api.get('/eventos/'),
      api.get('/clubes/'),
      api.get('/equipos/'),
    ])
      .then(([eventsResponse, clubsResponse, teamsResponse]) => {
        if (!isActive) return
        const loadedClubs = asList(clubsResponse.data)
        setEvents(asList(eventsResponse.data))
        setClubs(loadedClubs)
        setTeams(asList(teamsResponse.data))
        if (loadedClubs.length) setClubFilter(String(loadedClubs[0].id))
      })
      .catch(() => {
        if (isActive) setPageError('No pudimos cargar los eventos. Verifica que el backend esté disponible.')
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })
    return () => { isActive = false }
  }, [])

  const filterTeams = useMemo(() => teams.filter(
    (team) => relationId(team.club) === clubFilter && team.activo !== false,
  ), [clubFilter, teams])

  const formTeams = useMemo(() => teams.filter(
    (team) => relationId(team.club) === form.club && team.activo !== false,
  ), [form.club, teams])

  const visibleEvents = useMemo(() => events.filter((event) => {
    if (clubFilter && relationId(event.club) !== clubFilter) return false
    if (teamFilter && relationId(event.equipo) !== teamFilter) return false
    if (typeFilter && event.tipo !== typeFilter) return false
    if (statusFilter && event.estado !== statusFilter) return false
    return true
  }), [clubFilter, events, statusFilter, teamFilter, typeFilter])

  const loadEvents = async () => {
    const { data } = await api.get('/eventos/')
    setEvents(asList(data))
  }

  const updateField = (field) => (event) => {
    const value = event.target.value
    setForm((current) => ({ ...current, [field]: value }))
    setFormError('')
  }

  const changeFilterClub = (event) => {
    setClubFilter(event.target.value)
    setTeamFilter('')
    setPageError('')
    setSuccess('')
  }

  const changeFormClub = (event) => {
    setForm((current) => ({ ...current, club: event.target.value, equipo: '' }))
    setFormError('')
  }

  const changeType = (event) => {
    const tipo = event.target.value
    setForm((current) => ({
      ...current,
      tipo,
      rival: tipo === 'PARTIDO' ? current.rival : '',
    }))
    setFormError('')
  }

  const openCreateForm = () => {
    if (!clubs.length) {
      setPageError('Debes crear un club antes de registrar eventos.')
      return
    }
    setEditingEvent(null)
    setForm({ ...emptyForm, club: clubFilter || String(clubs[0].id) })
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
  }

  const openEditForm = (event) => {
    setEditingEvent(event)
    setForm({
      club: relationId(event.club),
      equipo: relationId(event.equipo),
      titulo: event.titulo || '',
      descripcion: event.descripcion || '',
      tipo: event.tipo || 'ENTRENAMIENTO',
      rival: event.rival || '',
      fecha_inicio: toLocalDateTime(event.fecha_inicio),
      fecha_fin: toLocalDateTime(event.fecha_fin),
      ubicacion: event.ubicacion || '',
    })
    setFormError('')
    setSuccess('')
    setIsDetailOpen(false)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingEvent(null)
    setForm(emptyForm)
    setFormError('')
  }

  const validateForm = () => {
    if (!form.club) return 'El club es obligatorio.'
    if (!form.titulo.trim()) return 'El título es obligatorio.'
    if (!form.tipo) return 'El tipo es obligatorio.'
    if (!form.fecha_inicio) return 'La fecha de inicio es obligatoria.'
    if (!form.fecha_fin) return 'La fecha de finalización es obligatoria.'
    if (new Date(form.fecha_fin) <= new Date(form.fecha_inicio)) {
      return 'La fecha de finalización debe ser mayor que la fecha de inicio.'
    }
    if (form.tipo === 'PARTIDO' && !form.rival.trim()) {
      return 'El rival es obligatorio para un partido.'
    }
    return ''
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setFormError('')
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    const payload = {
      club: form.club,
      equipo: form.equipo || null,
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      tipo: form.tipo,
      rival: form.tipo === 'PARTIDO' ? form.rival.trim() : null,
      fecha_inicio: new Date(form.fecha_inicio).toISOString(),
      fecha_fin: new Date(form.fecha_fin).toISOString(),
      ubicacion: form.ubicacion.trim() || null,
    }

    setIsSaving(true)
    try {
      if (editingEvent) await api.patch(`/eventos/${editingEvent.id}/`, payload)
      else await api.post('/eventos/', payload)
      setClubFilter(form.club)
      setTeamFilter('')
      setSuccess(editingEvent ? 'Evento actualizado correctamente.' : 'Evento creado correctamente.')
      setIsFormOpen(false)
      setEditingEvent(null)
      setForm(emptyForm)
      await loadEvents()
    } catch (error) {
      setFormError(backendMessage(error, 'No se pudo guardar el evento. Revisa los datos e intenta nuevamente.'))
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = async (event) => {
    setDetailEvent(event)
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    setPageError('')
    try {
      const { data } = await api.get(`/eventos/${event.id}/`)
      setDetailEvent(data)
    } catch (error) {
      setPageError(backendMessage(error, 'No se pudo cargar el detalle del evento.'))
      setIsDetailOpen(false)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const changeStatus = async (event, action) => {
    const verb = action === 'cancelar' ? 'cancelar' : 'finalizar'
    if (!window.confirm(`¿Deseas ${verb} el evento "${event.titulo}"?`)) return
    setPendingAction(`${action}:${event.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.patch(`/eventos/${event.id}/${action}/`)
      setSuccess(action === 'cancelar' ? 'Evento cancelado correctamente.' : 'Evento finalizado correctamente.')
      await loadEvents()
    } catch (error) {
      setPageError(backendMessage(error, `No se pudo ${verb} el evento.`))
    } finally {
      setPendingAction('')
    }
  }

  const deleteEvent = async (event) => {
    if (!window.confirm(`¿Deseas dar de baja el evento "${event.titulo}"?`)) return
    setPendingAction(`delete:${event.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/eventos/${event.id}/`)
      setSuccess('Evento dado de baja correctamente.')
      await loadEvents()
    } catch (error) {
      setPageError(backendMessage(error, 'No se pudo dar de baja el evento.'))
    } finally {
      setPendingAction('')
    }
  }

  const clubName = (event) => clubs.find(
    (club) => String(club.id) === relationId(event.club),
  )?.nombre || 'Club no disponible'

  const teamName = (event) => teams.find(
    (team) => String(team.id) === relationId(event.equipo),
  )?.nombre || 'Todo el club'

  const typeLabel = (type) => eventTypes.find(([value]) => value === type)?.[1] || type
  const statusLabel = (status) => eventStatuses.find(([value]) => value === status)?.[1] || status

  return (
    <section className="page page-fluid categories-page events-page">
      <div className="page-header categories-header">
        <div>
          <p className="eyebrow">Calendario del club</p>
          <h1>Gestión de eventos</h1>
          <p>Planifica entrenamientos, partidos, reuniones y actividades internas.</p>
        </div>
        <button type="button" className="button-primary" onClick={openCreateForm} disabled={!clubs.length}>
          + Nuevo evento
        </button>
      </div>

      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="events-toolbar">
        <label>
          Club
          <select value={clubFilter} onChange={changeFilterClub} disabled={isLoading || !clubs.length}>
            {!clubs.length && <option value="">No hay clubes</option>}
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}
          </select>
        </label>
        <label>
          Equipo
          <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} disabled={!clubFilter}>
            <option value="">Todos los equipos</option>
            {filterTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}
          </select>
        </label>
        <label>
          Tipo
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Todos los tipos</option>
            {eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos los estados</option>
            {eventStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <section className="categories-list-card">
        <div className="categories-list-heading">
          <div>
            <h2>Próximos eventos y actividades</h2>
            <p>{visibleEvents.length} {visibleEvents.length === 1 ? 'evento encontrado' : 'eventos encontrados'}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando eventos...</strong></div>
        ) : visibleEvents.length === 0 ? (
          <div className="categories-empty">
            <span className="categories-empty-icon">+</span>
            <strong>No hay eventos en esta vista</strong>
            <p>Crea un evento o cambia los filtros seleccionados.</p>
            {!!clubs.length && <button type="button" className="button-primary" onClick={openCreateForm}>Crear evento</button>}
          </div>
        ) : (
          <div className="categories-grid events-grid">
            {visibleEvents.map((event) => {
              const busy = pendingAction.endsWith(`:${event.id}`)
              const programmed = event.estado === 'PROGRAMADO'
              return (
                <article className={`category-card event-card event-type-${event.tipo.toLowerCase()}`} key={event.id}>
                  <div className="category-card-top">
                    <div>
                      <span className="category-card-kicker">{typeLabel(event.tipo)}</span>
                      <h3>{event.titulo}</h3>
                    </div>
                    <span className={`event-status event-status-${event.estado.toLowerCase()}`}>{statusLabel(event.estado)}</span>
                  </div>
                  <p>{event.descripcion || 'Sin descripción registrada.'}</p>
                  <div className="event-time-block">
                    <strong>{formatDateTime(event.fecha_inicio)}</strong>
                    <span>hasta {formatDateTime(event.fecha_fin)}</span>
                  </div>
                  <div className="category-card-meta event-card-meta">
                    <span>Equipo <strong>{teamName(event)}</strong></span>
                    <span>Ubicación <strong>{event.ubicacion || 'Por definir'}</strong></span>
                  </div>
                  <div className="category-actions event-actions">
                    <button type="button" onClick={() => openDetail(event)} disabled={busy}>Ver</button>
                    <button type="button" onClick={() => openEditForm(event)} disabled={busy}>Editar</button>
                    {programmed && <button type="button" className="is-warning" onClick={() => changeStatus(event, 'cancelar')} disabled={busy}>{pendingAction === `cancelar:${event.id}` ? 'Procesando...' : 'Cancelar'}</button>}
                    {programmed && <button type="button" className="is-success" onClick={() => changeStatus(event, 'finalizar')} disabled={busy}>{pendingAction === `finalizar:${event.id}` ? 'Procesando...' : 'Finalizar'}</button>}
                    <button type="button" className="is-danger" onClick={() => deleteEvent(event)} disabled={busy}>{pendingAction === `delete:${event.id}` ? 'Procesando...' : 'Dar de baja'}</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {isFormOpen && (
        <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <section className="clubs-modal event-modal" role="dialog" aria-modal="true" aria-labelledby="event-form-title">
            <div className="clubs-modal-header">
              <div>
                <span className="eyebrow">{editingEvent ? 'Actualizar evento' : 'Nuevo evento'}</span>
                <h2 id="event-form-title">{editingEvent ? 'Editar evento' : 'Crear evento'}</h2>
                <p>Completa los datos de agenda y asignación.</p>
              </div>
              <button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button>
            </div>

            <form className="event-form" onSubmit={submitForm} noValidate>
              <fieldset>
                <legend>Organización</legend>
                <label className="clubs-form-group">Club <span>*</span><select value={form.club} onChange={changeFormClub}><option value="">Selecciona un club</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label>
                <label className="clubs-form-group">Equipo <small>(opcional)</small><select value={form.equipo} onChange={updateField('equipo')} disabled={!form.club}><option value="">Todo el club / sin equipo</option>{formTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label>
                <label className="clubs-form-group event-field-full">Título <span>*</span><input value={form.titulo} onChange={updateField('titulo')} placeholder="Ej. Entrenamiento táctico" autoFocus /></label>
                <label className="clubs-form-group">Tipo <span>*</span><select value={form.tipo} onChange={changeType}>{eventTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="clubs-form-group">Rival {form.tipo === 'PARTIDO' ? <span>*</span> : <small>(solo partidos)</small>}<input value={form.rival} onChange={updateField('rival')} disabled={form.tipo !== 'PARTIDO'} placeholder="Nombre del rival" /></label>
              </fieldset>

              <fieldset>
                <legend>Fecha y lugar</legend>
                <label className="clubs-form-group">Inicio <span>*</span><input type="datetime-local" value={form.fecha_inicio} onChange={updateField('fecha_inicio')} /></label>
                <label className="clubs-form-group">Finalización <span>*</span><input type="datetime-local" value={form.fecha_fin} onChange={updateField('fecha_fin')} min={form.fecha_inicio} /></label>
                <label className="clubs-form-group event-field-full">Ubicación <small>(opcional en entrenamientos)</small><input value={form.ubicacion} onChange={updateField('ubicacion')} placeholder="Ej. Cancha principal" /></label>
                <label className="clubs-form-group event-field-full">Descripción <small>(opcional)</small><textarea value={form.descripcion} onChange={updateField('descripcion')} rows="3" placeholder="Indicaciones o información adicional" /></label>
              </fieldset>

              {formError && <div className="clubs-alert clubs-alert-error" role="alert">{formError}</div>}
              <div className="clubs-form-actions">
                <button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button>
                <button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar evento'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isDetailOpen && detailEvent && (
        <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}>
          <section className="clubs-modal event-detail-modal" role="dialog" aria-modal="true" aria-labelledby="event-detail-title">
            <div className="clubs-modal-header">
              <div><span className="eyebrow">Agenda del club</span><h2 id="event-detail-title">Detalle del evento</h2></div>
              <button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button>
            </div>
            {isDetailLoading ? <div className="categories-empty"><span className="clubs-loader" /></div> : (
              <>
                <div className="event-detail-hero">
                  <div><span>{typeLabel(detailEvent.tipo)}</span><h3>{detailEvent.titulo}</h3><p>{formatDateTime(detailEvent.fecha_inicio)}</p></div>
                  <span className={`event-status event-status-${detailEvent.estado.toLowerCase()}`}>{statusLabel(detailEvent.estado)}</span>
                </div>
                <p className="category-detail-description">{detailEvent.descripcion || 'Sin descripción registrada.'}</p>
                <dl className="category-detail-grid event-detail-grid">
                  <div><dt>Club</dt><dd>{clubName(detailEvent)}</dd></div>
                  <div><dt>Equipo</dt><dd>{teamName(detailEvent)}</dd></div>
                  <div><dt>Inicio</dt><dd>{formatDateTime(detailEvent.fecha_inicio)}</dd></div>
                  <div><dt>Finalización</dt><dd>{formatDateTime(detailEvent.fecha_fin)}</dd></div>
                  <div><dt>Ubicación</dt><dd>{detailEvent.ubicacion || 'No definida'}</dd></div>
                  <div><dt>Rival</dt><dd>{detailEvent.rival || 'No aplica'}</dd></div>
                </dl>
                <div className="clubs-form-actions category-detail-actions">
                  <button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button>
                  <button type="button" className="button-primary" onClick={() => openEditForm(detailEvent)}>Editar</button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

export default EventsPage
