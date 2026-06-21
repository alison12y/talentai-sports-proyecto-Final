import { useEffect, useMemo, useState } from 'react'

import api from '../api/axios'

const emptyForm = {
  club: '', equipo: '', jugador: '', fecha_medicion: '',
  peso: '', altura: '', velocidad_40m: '', test_cooper: '', observaciones: '',
}

const asList = (data) => (Array.isArray(data) ? data : data?.results || [])
const relationId = (value) => String(value?.id || value || '')
const today = new Date().toISOString().slice(0, 10)

const firstError = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(firstError).find(Boolean)
  if (value && typeof value === 'object') return Object.values(value).map(firstError).find(Boolean)
  return ''
}

const requestError = (error, fallback) => firstError(error.response?.data) || fallback

const formatDate = (value) => {
  if (!value) return 'Sin fecha'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(date)
}

function PhysicalEvolutionPage() {
  const [measurements, setMeasurements] = useState([])
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [clubFilter, setClubFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [playerFilter, setPlayerFilter] = useState('')
  const [history, setHistory] = useState([])
  const [lastTwelve, setLastTwelve] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingMeasurement, setEditingMeasurement] = useState(null)
  const [detailMeasurement, setDetailMeasurement] = useState(null)
  const [detailLastTwelve, setDetailLastTwelve] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/evoluciones-fisicas/'),
      api.get('/clubes/'),
      api.get('/equipos/'),
      api.get('/jugadores/'),
    ])
      .then(([measurementsResponse, clubsResponse, teamsResponse, playersResponse]) => {
        if (!active) return
        const loadedClubs = asList(clubsResponse.data)
        setMeasurements(asList(measurementsResponse.data))
        setClubs(loadedClubs)
        setTeams(asList(teamsResponse.data))
        setPlayers(asList(playersResponse.data))
        if (loadedClubs.length) setClubFilter(String(loadedClubs[0].id))
      })
      .catch(() => {
        if (active) setPageError('No pudimos cargar la evolución física. Verifica que el backend esté disponible.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [])

  const playerById = useMemo(() => new Map(players.map(
    (player) => [String(player.id), player],
  )), [players])

  const clubTeams = useMemo(() => teams.filter(
    (team) => relationId(team.club) === clubFilter && team.activo !== false,
  ), [clubFilter, teams])

  const teamPlayers = useMemo(() => players.filter((player) => (
    player.estado === 'ACTIVO'
    && relationId(player.club) === clubFilter
    && (!teamFilter || relationId(player.equipo_actual) === teamFilter)
  )), [clubFilter, players, teamFilter])

  const formTeams = useMemo(() => teams.filter(
    (team) => relationId(team.club) === form.club && team.activo !== false,
  ), [form.club, teams])

  const formPlayers = useMemo(() => players.filter((player) => (
    player.estado === 'ACTIVO'
    && relationId(player.club) === form.club
    && (!form.equipo || relationId(player.equipo_actual) === form.equipo)
  )), [form.club, form.equipo, players])

  const visibleMeasurements = useMemo(() => measurements.filter((measurement) => {
    const player = playerById.get(relationId(measurement.jugador))
    if (!player) return false
    if (clubFilter && relationId(player.club) !== clubFilter) return false
    if (teamFilter && relationId(player.equipo_actual) !== teamFilter) return false
    if (playerFilter && relationId(measurement.jugador) !== playerFilter) return false
    return true
  }), [clubFilter, measurements, playerById, playerFilter, teamFilter])

  const maxima = useMemo(() => ({
    peso: Math.max(...lastTwelve.map((item) => Number(item.peso) || 0), 1),
    altura: Math.max(...lastTwelve.map((item) => Number(item.altura) || 0), 1),
    velocidad_40m: Math.max(...lastTwelve.map((item) => Number(item.velocidad_40m) || 0), 1),
    test_cooper: Math.max(...lastTwelve.map((item) => Number(item.test_cooper) || 0), 1),
  }), [lastTwelve])

  const loadPlayerHistory = async (playerId) => {
    setPlayerFilter(playerId)
    setHistory([])
    setLastTwelve([])
    setPageError('')
    if (!playerId) return
    setIsHistoryLoading(true)
    try {
      const [{ data: historyData }, { data: lastData }] = await Promise.all([
        api.get(`/jugadores/${playerId}/evolucion-fisica/`),
        api.get(`/jugadores/${playerId}/evolucion-fisica/ultimos-12/`),
      ])
      setHistory(asList(historyData))
      setLastTwelve(asList(lastData).slice().reverse())
    } catch (error) {
      setPageError(requestError(error, 'No se pudo cargar el historial del jugador.'))
    } finally {
      setIsHistoryLoading(false)
    }
  }

  const changeClub = (event) => {
    setClubFilter(event.target.value)
    setTeamFilter('')
    setPlayerFilter('')
    setHistory([])
    setLastTwelve([])
    setPageError('')
    setSuccess('')
  }

  const changeTeam = (event) => {
    setTeamFilter(event.target.value)
    setPlayerFilter('')
    setHistory([])
    setLastTwelve([])
    setSuccess('')
  }

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFormError('')
  }

  const changeFormClub = (event) => {
    setForm((current) => ({ ...current, club: event.target.value, equipo: '', jugador: '' }))
    setFormError('')
  }

  const changeFormTeam = (event) => {
    setForm((current) => ({ ...current, equipo: event.target.value, jugador: '' }))
    setFormError('')
  }

  const openCreate = () => {
    setEditingMeasurement(null)
    setForm({
      ...emptyForm,
      club: clubFilter,
      equipo: teamFilter,
      jugador: playerFilter,
      fecha_medicion: today,
    })
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
  }

  const openEdit = (measurement) => {
    const player = playerById.get(relationId(measurement.jugador))
    setEditingMeasurement(measurement)
    setForm({
      club: relationId(player?.club),
      equipo: relationId(player?.equipo_actual),
      jugador: relationId(measurement.jugador),
      fecha_medicion: measurement.fecha_medicion || '',
      peso: String(measurement.peso ?? ''),
      altura: String(measurement.altura ?? ''),
      velocidad_40m: String(measurement.velocidad_40m ?? ''),
      test_cooper: String(measurement.test_cooper ?? ''),
      observaciones: measurement.observaciones || '',
    })
    setFormError('')
    setSuccess('')
    setIsDetailOpen(false)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingMeasurement(null)
    setForm(emptyForm)
    setFormError('')
  }

  const validateForm = () => {
    if (!form.jugador) return 'El jugador es obligatorio.'
    if (!form.fecha_medicion) return 'La fecha de medición es obligatoria.'
    if (form.fecha_medicion > today) return 'La fecha de medición no puede ser futura.'
    for (const [field, label] of [
      ['peso', 'El peso'], ['altura', 'La altura'],
      ['velocidad_40m', 'La velocidad 40m'], ['test_cooper', 'El test de Cooper'],
    ]) {
      if (!form[field] || !Number.isFinite(Number(form[field])) || Number(form[field]) <= 0) {
        return `${label} debe ser mayor que 0.`
      }
    }
    return ''
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const validationError = validateForm()
    setFormError(validationError)
    if (validationError) return
    const payload = {
      jugador: form.jugador,
      fecha_medicion: form.fecha_medicion,
      peso: Number(form.peso),
      altura: Number(form.altura),
      velocidad_40m: Number(form.velocidad_40m),
      test_cooper: Number(form.test_cooper),
      observaciones: form.observaciones.trim(),
    }
    setIsSaving(true)
    try {
      if (editingMeasurement) {
        await api.patch(`/evoluciones-fisicas/${editingMeasurement.id}/`, payload)
      } else {
        await api.post('/evoluciones-fisicas/', payload)
      }
      setIsFormOpen(false)
      setEditingMeasurement(null)
      setForm(emptyForm)
      const { data } = await api.get('/evoluciones-fisicas/')
      setMeasurements(asList(data))
      if (playerFilter) await loadPlayerHistory(playerFilter)
      setSuccess(editingMeasurement ? 'Medición actualizada correctamente.' : 'Medición registrada correctamente.')
    } catch (error) {
      setFormError(requestError(error, 'No se pudo guardar la medición. Revisa los datos.'))
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = async (measurement) => {
    const playerId = relationId(measurement.jugador)
    setDetailMeasurement(measurement)
    setDetailLastTwelve([])
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    try {
      const [{ data: detailData }, { data: lastData }] = await Promise.all([
        api.get(`/evoluciones-fisicas/${measurement.id}/`),
        api.get(`/jugadores/${playerId}/evolucion-fisica/ultimos-12/`),
      ])
      setDetailMeasurement(detailData)
      setDetailLastTwelve(asList(lastData))
    } catch (error) {
      setIsDetailOpen(false)
      setPageError(requestError(error, 'No se pudo cargar el detalle de la medición.'))
    } finally {
      setIsDetailLoading(false)
    }
  }

  const removeMeasurement = async (measurement) => {
    if (!window.confirm('¿Deseas dar de baja esta medición física?')) return
    setPendingAction(`delete:${measurement.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/evoluciones-fisicas/${measurement.id}/`)
      const { data } = await api.get('/evoluciones-fisicas/')
      setMeasurements(asList(data))
      if (playerFilter) await loadPlayerHistory(playerFilter)
      setSuccess('Medición dada de baja correctamente.')
    } catch (error) {
      setPageError(requestError(error, 'No se pudo dar de baja la medición.'))
    } finally {
      setPendingAction('')
    }
  }

  const playerName = (measurement) => {
    const player = playerById.get(relationId(measurement?.jugador))
    return player ? `${player.nombre} ${player.apellido}` : 'Jugador no disponible'
  }

  const barWidth = (value, field) => `${Math.max((Number(value) / maxima[field]) * 100, 3)}%`

  return (
    <section className="page page-fluid categories-page evolution-page">
      <div className="page-header categories-header"><div><p className="eyebrow">Seguimiento del jugador</p><h1>Evolución física</h1><p>Registra mediciones periódicas y compara el progreso de cada jugador.</p></div><button type="button" className="button-primary" onClick={openCreate} disabled={!players.length}>+ Nueva medición</button></div>
      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="evolution-toolbar"><label>Club<select value={clubFilter} onChange={changeClub} disabled={isLoading || !clubs.length}>{!clubs.length && <option value="">No hay clubes</option>}{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><label>Equipo<select value={teamFilter} onChange={changeTeam} disabled={!clubFilter}><option value="">Todos los equipos</option>{clubTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label><label>Jugador<select value={playerFilter} onChange={(event) => loadPlayerHistory(event.target.value)} disabled={!clubFilter}><option value="">Todos los jugadores</option>{teamPlayers.map((player) => <option key={player.id} value={player.id}>{player.nombre} {player.apellido}</option>)}</select></label></div>

      {playerFilter && <section className="evolution-history-panel"><div className="evolution-history-heading"><div><span className="eyebrow">Últimos 12 registros</span><h2>{playerById.get(playerFilter)?.nombre} {playerById.get(playerFilter)?.apellido}</h2><p>{history.length} mediciones en el historial completo</p></div><span className="evolution-count">{lastTwelve.length}/12</span></div>{isHistoryLoading ? <div className="evolution-loading"><span className="clubs-loader" /></div> : lastTwelve.length === 0 ? <div className="evolution-loading"><strong>Sin mediciones para comparar</strong></div> : <div className="evolution-chart">{lastTwelve.map((item) => <article key={item.id}><strong>{formatDate(item.fecha_medicion)}</strong><div><span>Peso <small>{item.peso} kg</small></span><i><b style={{ width: barWidth(item.peso, 'peso') }} /></i></div><div><span>Altura <small>{item.altura} m</small></span><i><b style={{ width: barWidth(item.altura, 'altura') }} /></i></div><div><span>40 m <small>{item.velocidad_40m} s</small></span><i><b style={{ width: barWidth(item.velocidad_40m, 'velocidad_40m') }} /></i></div><div><span>Cooper <small>{item.test_cooper} m</small></span><i><b style={{ width: barWidth(item.test_cooper, 'test_cooper') }} /></i></div></article>)}</div>}</section>}

      <section className="categories-list-card"><div className="categories-list-heading"><div><h2>Mediciones físicas</h2><p>{visibleMeasurements.length} {visibleMeasurements.length === 1 ? 'medición encontrada' : 'mediciones encontradas'}</p></div></div>{isLoading ? <div className="categories-empty"><span className="clubs-loader" /></div> : visibleMeasurements.length === 0 ? <div className="categories-empty"><span className="categories-empty-icon">F</span><strong>No hay mediciones en esta vista</strong><p>Registra una nueva medición o cambia los filtros.</p><button type="button" className="button-primary" onClick={openCreate}>Crear medición</button></div> : <div className="categories-grid evolution-grid">{visibleMeasurements.map((measurement) => {
        const busy = pendingAction === `delete:${measurement.id}`
        return <article className="category-card evolution-card" key={measurement.id}><div className="category-card-top"><div><span className="category-card-kicker">{formatDate(measurement.fecha_medicion)}</span><h3>{playerName(measurement)}</h3></div><span className="evolution-week-chip">Semanal</span></div><div className="evolution-metrics"><div><span>Peso</span><strong>{measurement.peso} kg</strong></div><div><span>Altura</span><strong>{measurement.altura} m</strong></div><div><span>40 metros</span><strong>{measurement.velocidad_40m} s</strong></div><div><span>Cooper</span><strong>{measurement.test_cooper} m</strong></div></div><p>{measurement.observaciones || 'Sin observaciones.'}</p><div className="category-actions evolution-actions"><button type="button" onClick={() => openDetail(measurement)} disabled={busy}>Ver detalle</button><button type="button" onClick={() => openEdit(measurement)} disabled={busy}>Editar</button><button type="button" className="is-danger" onClick={() => removeMeasurement(measurement)} disabled={busy}>{busy ? 'Procesando...' : 'Dar de baja'}</button></div></article>
      })}</div>}</section>

      {isFormOpen && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="clubs-modal evolution-modal" role="dialog" aria-modal="true" aria-labelledby="evolution-form-title"><div className="clubs-modal-header"><div><span className="eyebrow">{editingMeasurement ? 'Actualizar medición' : 'Nuevo seguimiento'}</span><h2 id="evolution-form-title">{editingMeasurement ? 'Editar evolución física' : 'Registrar evolución física'}</h2><p>Solo se permite una medición por jugador cada semana.</p></div><button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button></div><form className="evolution-form" onSubmit={submitForm} noValidate><fieldset><legend>Jugador</legend><label className="clubs-form-group">Club <span>*</span><select value={form.club} onChange={changeFormClub} disabled={!!editingMeasurement}><option value="">Selecciona un club</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><label className="clubs-form-group">Equipo<select value={form.equipo} onChange={changeFormTeam} disabled={!form.club || !!editingMeasurement}><option value="">Todos los equipos</option>{formTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label><label className="clubs-form-group evolution-field-full">Jugador <span>*</span><select value={form.jugador} onChange={updateField('jugador')} disabled={!form.club || !!editingMeasurement}><option value="">Selecciona un jugador</option>{formPlayers.map((player) => <option key={player.id} value={player.id}>{player.nombre} {player.apellido}</option>)}</select></label></fieldset><fieldset><legend>Medición</legend><label className="clubs-form-group evolution-field-full">Fecha de medición <span>*</span><input type="date" max={today} value={form.fecha_medicion} onChange={updateField('fecha_medicion')} /></label><label className="clubs-form-group">Peso (kg) <span>*</span><input type="number" min="0.01" step="0.01" value={form.peso} onChange={updateField('peso')} /></label><label className="clubs-form-group">Altura (m) <span>*</span><input type="number" min="0.01" step="0.01" value={form.altura} onChange={updateField('altura')} /></label><label className="clubs-form-group">Velocidad 40 m (s) <span>*</span><input type="number" min="0.01" step="0.01" value={form.velocidad_40m} onChange={updateField('velocidad_40m')} /></label><label className="clubs-form-group">Test de Cooper (m) <span>*</span><input type="number" min="0.01" step="0.01" value={form.test_cooper} onChange={updateField('test_cooper')} /></label><label className="clubs-form-group evolution-field-full">Observaciones<textarea rows="3" value={form.observaciones} onChange={updateField('observaciones')} placeholder="Mejoró resistencia" /></label></fieldset>{formError && <div className="clubs-alert clubs-alert-error" role="alert">{formError}</div>}<div className="clubs-form-actions"><button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar medición'}</button></div></form></section></div>}

      {isDetailOpen && detailMeasurement && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}><section className="clubs-modal evolution-detail-modal" role="dialog" aria-modal="true" aria-labelledby="evolution-detail-title"><div className="clubs-modal-header"><div><span className="eyebrow">Seguimiento físico</span><h2 id="evolution-detail-title">Detalle de medición</h2><p>{playerName(detailMeasurement)}</p></div><button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button></div>{isDetailLoading ? <div className="evolution-loading"><span className="clubs-loader" /></div> : <><div className="evolution-detail-hero"><div><span>{formatDate(detailMeasurement.fecha_medicion)}</span><h3>{playerName(detailMeasurement)}</h3></div><strong>{detailLastTwelve.length}/12</strong></div><dl className="evolution-detail-grid"><div><dt>Peso</dt><dd>{detailMeasurement.peso} kg</dd></div><div><dt>Altura</dt><dd>{detailMeasurement.altura} m</dd></div><div><dt>Velocidad 40 m</dt><dd>{detailMeasurement.velocidad_40m} s</dd></div><div><dt>Test Cooper</dt><dd>{detailMeasurement.test_cooper} m</dd></div></dl><div className="evolution-detail-notes"><span>Observaciones</span><p>{detailMeasurement.observaciones || 'Sin observaciones.'}</p></div><div className="clubs-form-actions category-detail-actions"><button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button><button type="button" className="button-primary" onClick={() => openEdit(detailMeasurement)}>Editar</button></div></>}</section></div>}
    </section>
  )
}

export default PhysicalEvolutionPage
