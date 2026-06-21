import { useEffect, useMemo, useState } from 'react'

import api from '../api/axios'

const emptyForm = {
  evento: '',
  equipo: '',
  rival: '',
  goles_equipo: '',
  goles_rival: '',
  notas_tecnicas: '',
}

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
  if (value && typeof value === 'object') return Object.values(value).map(firstError).find(Boolean)
  return ''
}

const requestError = (error, fallback) => firstError(error.response?.data) || fallback

const resultLabel = (result) => ({
  VICTORIA: 'Victoria',
  DERROTA: 'Derrota',
  EMPATE: 'Empate',
}[result] || result || 'Sin resultado')

function MatchesPage() {
  const [matches, setMatches] = useState([])
  const [teamHistory, setTeamHistory] = useState([])
  const [events, setEvents] = useState([])
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [clubFilter, setClubFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingMatch, setEditingMatch] = useState(null)
  const [detailMatch, setDetailMatch] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/partidos/'),
      api.get('/eventos/'),
      api.get('/clubes/'),
      api.get('/equipos/'),
    ])
      .then(([matchesResponse, eventsResponse, clubsResponse, teamsResponse]) => {
        if (!active) return
        const loadedClubs = asList(clubsResponse.data)
        setMatches(asList(matchesResponse.data))
        setEvents(asList(eventsResponse.data))
        setClubs(loadedClubs)
        setTeams(asList(teamsResponse.data))
        if (loadedClubs.length) setClubFilter(String(loadedClubs[0].id))
      })
      .catch(() => {
        if (active) setPageError('No pudimos cargar los partidos. Verifica que el backend esté disponible.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [])

  const eventById = useMemo(() => new Map(events.map(
    (event) => [String(event.id), event],
  )), [events])

  const teamById = useMemo(() => new Map(teams.map(
    (team) => [String(team.id), team],
  )), [teams])

  const clubTeams = useMemo(() => teams.filter(
    (team) => relationId(team.club) === clubFilter && team.activo !== false,
  ), [clubFilter, teams])

  const matchEvents = useMemo(() => events.filter((event) => {
    if (event.tipo !== 'PARTIDO') return false
    if (event.estado === 'CANCELADO') return false
    if (clubFilter && relationId(event.club) !== clubFilter) return false
    if (teamFilter && relationId(event.equipo) !== teamFilter) return false
    return true
  }), [clubFilter, events, teamFilter])

  const formEvents = useMemo(() => events.filter((event) => (
    event.tipo === 'PARTIDO'
    && event.estado !== 'CANCELADO'
    && relationId(event.equipo) === form.equipo
  )), [events, form.equipo])

  const visibleMatches = useMemo(() => {
    const source = teamFilter ? teamHistory : matches
    return source.filter((match) => {
      const team = teamById.get(relationId(match.equipo))
      if (clubFilter && relationId(team?.club) !== clubFilter) return false
      if (teamFilter && relationId(match.equipo) !== teamFilter) return false
      return true
    })
  }, [clubFilter, matches, teamById, teamFilter, teamHistory])

  const loadMatches = async () => {
    const { data } = await api.get('/partidos/')
    setMatches(asList(data))
  }

  const loadTeamHistory = async (teamId) => {
    setTeamHistory([])
    if (!teamId) return
    setIsHistoryLoading(true)
    try {
      const { data } = await api.get(`/equipos/${teamId}/partidos/`)
      setTeamHistory(asList(data))
    } catch (error) {
      setPageError(requestError(error, 'No se pudo cargar el historial del equipo.'))
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const changeClub = (event) => {
    setClubFilter(event.target.value)
    setTeamFilter('')
    setTeamHistory([])
    setPageError('')
    setSuccess('')
  }

  const changeTeam = (event) => {
    const teamId = event.target.value
    setTeamFilter(teamId)
    setPageError('')
    setSuccess('')
    loadTeamHistory(teamId)
  }

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFormError('')
  }

  const changeFormTeam = (event) => {
    setForm((current) => ({ ...current, equipo: event.target.value, evento: '' }))
    setFormError('')
  }

  const openCreateForm = () => {
    setEditingMatch(null)
    setForm({ ...emptyForm, equipo: teamFilter })
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
  }

  const openEditForm = (match) => {
    setEditingMatch(match)
    setForm({
      evento: relationId(match.evento),
      equipo: relationId(match.equipo),
      rival: match.rival || '',
      goles_equipo: String(match.goles_equipo ?? ''),
      goles_rival: String(match.goles_rival ?? ''),
      notas_tecnicas: match.notas_tecnicas || '',
    })
    setFormError('')
    setSuccess('')
    setIsDetailOpen(false)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingMatch(null)
    setForm(emptyForm)
    setFormError('')
  }

  const validateForm = () => {
    if (!form.equipo) return 'El equipo es obligatorio.'
    if (!form.evento) return 'El evento es obligatorio.'
    const selectedEvent = eventById.get(form.evento)
    if (selectedEvent?.tipo !== 'PARTIDO') return 'Debe seleccionarse un evento de tipo PARTIDO.'
    if (!form.rival.trim()) return 'El rival es obligatorio.'
    if (form.goles_equipo === '') return 'Los goles del equipo son obligatorios.'
    if (form.goles_rival === '') return 'Los goles del rival son obligatorios.'
    if (!/^\d+$/.test(form.goles_equipo) || !/^\d+$/.test(form.goles_rival)) {
      return 'Los goles deben ser enteros mayores o iguales a 0.'
    }
    return ''
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const validationError = validateForm()
    setFormError(validationError)
    if (validationError) return

    const payload = {
      evento: form.evento,
      equipo: form.equipo,
      rival: form.rival.trim(),
      goles_equipo: Number(form.goles_equipo),
      goles_rival: Number(form.goles_rival),
      notas_tecnicas: form.notas_tecnicas.trim(),
    }
    setIsSaving(true)
    try {
      if (editingMatch) {
        await api.patch(`/partidos/${editingMatch.id}/`, payload)
        setSuccess('Partido actualizado correctamente.')
      } else {
        await api.post('/partidos/', payload)
        setSuccess('Partido registrado correctamente.')
      }
      setIsFormOpen(false)
      setEditingMatch(null)
      setForm(emptyForm)
      await Promise.all([
        loadMatches(),
        teamFilter ? loadTeamHistory(teamFilter) : Promise.resolve(),
      ])
    } catch (error) {
      setFormError(requestError(error, 'No se pudo guardar el partido. Revisa los datos.'))
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = async (match) => {
    setDetailMatch(match)
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    setPageError('')
    try {
      const { data } = await api.get(`/partidos/${match.id}/`)
      setDetailMatch(data)
    } catch (error) {
      setIsDetailOpen(false)
      setPageError(requestError(error, 'No se pudo cargar el detalle del partido.'))
    } finally {
      setIsDetailLoading(false)
    }
  }

  const removeMatch = async (match) => {
    if (!window.confirm(`¿Deseas dar de baja el partido contra ${match.rival}?`)) return
    setPendingAction(`delete:${match.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/partidos/${match.id}/`)
      setSuccess('Partido dado de baja correctamente.')
      await Promise.all([
        loadMatches(),
        teamFilter ? loadTeamHistory(teamFilter) : Promise.resolve(),
      ])
    } catch (error) {
      setPageError(requestError(error, 'No se pudo dar de baja el partido.'))
    } finally {
      setPendingAction('')
    }
  }

  const teamName = (match) => teamById.get(relationId(match?.equipo))?.nombre || 'Equipo no disponible'
  const matchEvent = (match) => eventById.get(relationId(match?.evento))

  return (
    <section className="page page-fluid categories-page matches-page">
      <div className="page-header categories-header">
        <div><p className="eyebrow">Competencia</p><h1>Partidos y resultados</h1><p>Registra resultados e historial competitivo de los equipos del club.</p></div>
        <button type="button" className="button-primary" onClick={openCreateForm} disabled={!matchEvents.length}>+ Registrar partido</button>
      </div>

      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="matches-toolbar">
        <label>Club<select value={clubFilter} onChange={changeClub} disabled={isLoading || !clubs.length}>{!clubs.length && <option value="">No hay clubes</option>}{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label>
        <label>Equipo<select value={teamFilter} onChange={changeTeam} disabled={!clubFilter}><option value="">Todos los equipos</option>{clubTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label>
      </div>

      {teamFilter && <section className="matches-history-banner"><div><span className="eyebrow">Historial por equipo</span><h2>{teamById.get(teamFilter)?.nombre}</h2><p>{teamHistory.length} {teamHistory.length === 1 ? 'partido registrado' : 'partidos registrados'}</p></div><span className="matches-history-mark">H</span></section>}

      <section className="categories-list-card">
        <div className="categories-list-heading"><div><h2>{teamFilter ? 'Historial de partidos' : 'Partidos registrados'}</h2><p>{visibleMatches.length} {visibleMatches.length === 1 ? 'partido encontrado' : 'partidos encontrados'}</p></div></div>
        {isLoading || isHistoryLoading ? <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando partidos...</strong></div> : visibleMatches.length === 0 ? <div className="categories-empty"><span className="categories-empty-icon">P</span><strong>No hay partidos en esta vista</strong><p>Selecciona un equipo o registra el resultado de un evento tipo partido.</p>{!!matchEvents.length && <button type="button" className="button-primary" onClick={openCreateForm}>Registrar partido</button>}</div> : <div className="categories-grid matches-grid">{visibleMatches.map((match) => {
          const matchEventData = matchEvent(match)
          const busy = pendingAction === `delete:${match.id}`
          return <article className="category-card match-card" key={match.id}><div className="category-card-top"><div><span className="category-card-kicker">{teamName(match)}</span><h3>vs. {match.rival}</h3></div><span className={`match-result result-${match.resultado?.toLowerCase()}`}>{resultLabel(match.resultado)}</span></div><div className="match-score"><strong>{match.goles_equipo}</strong><span>—</span><strong>{match.goles_rival}</strong></div><p>{match.notas_tecnicas || 'Sin notas técnicas registradas.'}</p><div className="category-card-meta"><span>Evento <strong>{matchEventData?.titulo || 'No disponible'}</strong></span><span>Fecha <strong>{formatDateTime(matchEventData?.fecha_inicio)}</strong></span></div><div className="category-actions match-actions"><button type="button" onClick={() => openDetail(match)} disabled={busy}>Ver detalle</button><button type="button" onClick={() => openEditForm(match)} disabled={busy}>Editar</button><button type="button" className="is-danger" onClick={() => removeMatch(match)} disabled={busy}>{busy ? 'Procesando...' : 'Dar de baja'}</button></div></article>
        })}</div>}
      </section>

      {isFormOpen && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="clubs-modal match-modal" role="dialog" aria-modal="true" aria-labelledby="match-form-title"><div className="clubs-modal-header"><div><span className="eyebrow">{editingMatch ? 'Actualizar resultado' : 'Nuevo resultado'}</span><h2 id="match-form-title">{editingMatch ? 'Editar partido' : 'Registrar partido'}</h2><p>Completa el rival, marcador y notas técnicas.</p></div><button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button></div><form className="match-form" onSubmit={submitForm} noValidate><label className="clubs-form-group">Equipo <span>*</span><select value={form.equipo} onChange={changeFormTeam}><option value="">Selecciona un equipo</option>{clubTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label><label className="clubs-form-group">Evento tipo partido <span>*</span><select value={form.evento} onChange={updateField('evento')} disabled={!form.equipo}><option value="">Selecciona un evento</option>{formEvents.map((event) => <option key={event.id} value={event.id}>{event.titulo} · {formatDateTime(event.fecha_inicio)}</option>)}</select></label><label className="clubs-form-group match-field-full">Rival <span>*</span><input value={form.rival} onChange={updateField('rival')} placeholder="Ej. Tigres FC" /></label><label className="clubs-form-group">Goles del equipo <span>*</span><input type="number" min="0" step="1" value={form.goles_equipo} onChange={updateField('goles_equipo')} /></label><label className="clubs-form-group">Goles del rival <span>*</span><input type="number" min="0" step="1" value={form.goles_rival} onChange={updateField('goles_rival')} /></label><label className="clubs-form-group match-field-full">Notas técnicas <small>(opcional)</small><textarea rows="4" value={form.notas_tecnicas} onChange={updateField('notas_tecnicas')} placeholder="Buen desempeño colectivo" /></label>{formError && <div className="clubs-alert clubs-alert-error match-field-full" role="alert">{formError}</div>}<div className="clubs-form-actions match-field-full"><button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar partido'}</button></div></form></section></div>}

      {isDetailOpen && detailMatch && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}><section className="clubs-modal match-detail-modal" role="dialog" aria-modal="true" aria-labelledby="match-detail-title"><div className="clubs-modal-header"><div><span className="eyebrow">Resultado registrado</span><h2 id="match-detail-title">Detalle del partido</h2></div><button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button></div>{isDetailLoading ? <div className="categories-empty"><span className="clubs-loader" /></div> : <><div className="match-detail-hero"><div><span>{teamName(detailMatch)}</span><h3>vs. {detailMatch.rival}</h3><p>{formatDateTime(matchEvent(detailMatch)?.fecha_inicio)}</p></div><div className="match-detail-score"><strong>{detailMatch.goles_equipo}</strong><span>—</span><strong>{detailMatch.goles_rival}</strong></div></div><dl className="category-detail-grid match-detail-grid"><div><dt>Resultado</dt><dd>{resultLabel(detailMatch.resultado)}</dd></div><div><dt>Equipo</dt><dd>{teamName(detailMatch)}</dd></div><div><dt>Evento</dt><dd>{matchEvent(detailMatch)?.titulo || 'No disponible'}</dd></div><div><dt>Rival</dt><dd>{detailMatch.rival}</dd></div></dl><div className="match-detail-notes"><span>Notas técnicas</span><p>{detailMatch.notas_tecnicas || 'Sin notas técnicas registradas.'}</p></div><div className="clubs-form-actions category-detail-actions"><button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button><button type="button" className="button-primary" onClick={() => openEditForm(detailMatch)}>Editar partido</button></div></>}</section></div>}
    </section>
  )
}

export default MatchesPage
