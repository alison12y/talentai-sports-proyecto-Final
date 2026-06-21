import { useEffect, useMemo, useState } from 'react'

import api from '../api/axios'

const numericFields = [
  'minutos_jugados', 'goles', 'asistencias',
  'tarjetas_amarillas', 'tarjetas_rojas',
]

const emptyEditForm = {
  minutos_jugados: '', goles: '', asistencias: '',
  tarjetas_amarillas: '', tarjetas_rojas: '', valoracion: '', observaciones: '',
}

const asList = (data) => (Array.isArray(data) ? data : data?.results || [])
const relationId = (value) => String(value?.id || value || '')

const firstError = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(firstError).find(Boolean)
  if (value && typeof value === 'object') return Object.values(value).map(firstError).find(Boolean)
  return ''
}

const requestError = (error, fallback) => firstError(error.response?.data) || fallback

function PlayerStatsPage() {
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [matches, setMatches] = useState([])
  const [players, setPlayers] = useState([])
  const [stats, setStats] = useState([])
  const [matchStats, setMatchStats] = useState([])
  const [draft, setDraft] = useState([])
  const [clubFilter, setClubFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [matchFilter, setMatchFilter] = useState('')
  const [editingStat, setEditingStat] = useState(null)
  const [editForm, setEditForm] = useState(emptyEditForm)
  const [detailStat, setDetailStat] = useState(null)
  const [playerHistory, setPlayerHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMatchLoading, setIsMatchLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isEditSaving, setIsEditSaving] = useState(false)
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [editError, setEditError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/clubes/'),
      api.get('/equipos/'),
      api.get('/partidos/'),
      api.get('/jugadores/'),
      api.get('/estadisticas-partido/'),
    ])
      .then(([clubsResponse, teamsResponse, matchesResponse, playersResponse, statsResponse]) => {
        if (!active) return
        const loadedClubs = asList(clubsResponse.data)
        setClubs(loadedClubs)
        setTeams(asList(teamsResponse.data))
        setMatches(asList(matchesResponse.data))
        setPlayers(asList(playersResponse.data))
        setStats(asList(statsResponse.data))
        if (loadedClubs.length) setClubFilter(String(loadedClubs[0].id))
      })
      .catch(() => {
        if (active) setPageError('No pudimos cargar las estadísticas. Verifica que el backend esté disponible.')
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })
    return () => { active = false }
  }, [])

  const teamById = useMemo(() => new Map(teams.map(
    (team) => [String(team.id), team],
  )), [teams])

  const matchById = useMemo(() => new Map(matches.map(
    (match) => [String(match.id), match],
  )), [matches])

  const playerById = useMemo(() => new Map(players.map(
    (player) => [String(player.id), player],
  )), [players])

  const clubTeams = useMemo(() => teams.filter(
    (team) => relationId(team.club) === clubFilter && team.activo !== false,
  ), [clubFilter, teams])

  const teamMatches = useMemo(() => matches.filter(
    (match) => relationId(match.equipo) === teamFilter,
  ), [matches, teamFilter])

  const visibleStats = useMemo(() => stats.filter((stat) => {
    const match = matchById.get(relationId(stat.partido))
    const team = teamById.get(relationId(match?.equipo))
    if (!match || !team) return false
    if (clubFilter && relationId(team.club) !== clubFilter) return false
    if (teamFilter && relationId(match.equipo) !== teamFilter) return false
    if (matchFilter && relationId(stat.partido) !== matchFilter) return false
    return true
  }), [clubFilter, matchById, matchFilter, stats, teamById, teamFilter])

  const buildDraft = (matchId, existing) => {
    const match = matchById.get(matchId)
    if (!match) return []
    const existingByPlayer = new Map(existing.map(
      (stat) => [relationId(stat.jugador), stat],
    ))
    const playerIds = new Set(existingByPlayer.keys())
    players.forEach((player) => {
      if (player.estado === 'ACTIVO' && relationId(player.equipo_actual) === relationId(match.equipo)) {
        playerIds.add(String(player.id))
      }
    })
    return [...playerIds]
      .filter((playerId) => playerById.has(playerId))
      .map((playerId) => {
        const current = existingByPlayer.get(playerId)
        return {
          jugador: playerId,
          minutos_jugados: String(current?.minutos_jugados ?? 0),
          goles: String(current?.goles ?? 0),
          asistencias: String(current?.asistencias ?? 0),
          tarjetas_amarillas: String(current?.tarjetas_amarillas ?? 0),
          tarjetas_rojas: String(current?.tarjetas_rojas ?? 0),
          valoracion: current?.valoracion == null ? '' : String(current.valoracion),
          observaciones: current?.observaciones || '',
          dirty: false,
        }
      })
      .sort((left, right) => {
        const leftPlayer = playerById.get(left.jugador)
        const rightPlayer = playerById.get(right.jugador)
        return `${leftPlayer?.apellido} ${leftPlayer?.nombre}`.localeCompare(`${rightPlayer?.apellido} ${rightPlayer?.nombre}`)
      })
  }

  const loadMatchStats = async (matchId) => {
    setMatchFilter(matchId)
    setMatchStats([])
    setDraft([])
    setFormError('')
    setSuccess('')
    if (!matchId) return
    setIsMatchLoading(true)
    try {
      const { data } = await api.get(`/partidos/${matchId}/estadisticas/`)
      const existing = asList(data)
      setMatchStats(existing)
      setDraft(buildDraft(matchId, existing))
      setStats((current) => [
        ...current.filter((stat) => relationId(stat.partido) !== matchId),
        ...existing,
      ])
    } catch (error) {
      setPageError(requestError(error, 'No se pudieron cargar las estadísticas del partido.'))
    } finally {
      setIsMatchLoading(false)
    }
  }

  const changeClub = (event) => {
    setClubFilter(event.target.value)
    setTeamFilter('')
    setMatchFilter('')
    setMatchStats([])
    setDraft([])
    setPageError('')
    setFormError('')
    setSuccess('')
  }

  const changeTeam = (event) => {
    setTeamFilter(event.target.value)
    setMatchFilter('')
    setMatchStats([])
    setDraft([])
    setFormError('')
    setSuccess('')
  }

  const updateDraft = (playerId, field, value) => {
    setDraft((current) => current.map((row) => (
      row.jugador === playerId ? { ...row, [field]: value, dirty: true } : row
    )))
    setFormError('')
  }

  const validateValues = (values) => {
    for (const field of numericFields) {
      if (!/^\d+$/.test(String(values[field]))) {
        return 'Minutos, goles, asistencias y tarjetas deben ser enteros mayores o iguales a 0.'
      }
    }
    if (values.valoracion !== '') {
      const rating = Number(values.valoracion)
      if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
        return 'La valoración debe estar entre 0 y 10.'
      }
    }
    return ''
  }

  const rowPayload = (row) => ({
    jugador: row.jugador,
    minutos_jugados: Number(row.minutos_jugados),
    goles: Number(row.goles),
    asistencias: Number(row.asistencias),
    tarjetas_amarillas: Number(row.tarjetas_amarillas),
    tarjetas_rojas: Number(row.tarjetas_rojas),
    valoracion: row.valoracion === '' ? null : Number(row.valoracion),
    observaciones: row.observaciones.trim(),
  })

  const saveStats = async () => {
    setFormError('')
    setSuccess('')
    if (!matchFilter) return setFormError('El partido es obligatorio.')
    const modified = draft.filter((row) => row.dirty)
    if (!modified.length) return setFormError('Modifica al menos un jugador para guardar estadísticas.')
    for (const row of modified) {
      const validationError = validateValues(row)
      if (validationError) {
        const player = playerById.get(row.jugador)
        return setFormError(`${player?.nombre || 'Jugador'}: ${validationError}`)
      }
    }

    const payload = { estadisticas: modified.map(rowPayload) }
    setIsSaving(true)
    try {
      await api.post(`/partidos/${matchFilter}/registrar-estadisticas/`, payload)
      setSuccess('Estadísticas del partido guardadas correctamente.')
      const [{ data: matchData }, { data: allData }] = await Promise.all([
        api.get(`/partidos/${matchFilter}/estadisticas/`),
        api.get('/estadisticas-partido/'),
      ])
      const updated = asList(matchData)
      setMatchStats(updated)
      setDraft(buildDraft(matchFilter, updated))
      setStats(asList(allData))
    } catch (error) {
      setFormError(requestError(error, 'No se pudieron guardar las estadísticas. Revisa los datos.'))
    } finally {
      setIsSaving(false)
    }
  }

  const openEdit = (stat) => {
    setEditingStat(stat)
    setEditForm({
      minutos_jugados: String(stat.minutos_jugados),
      goles: String(stat.goles),
      asistencias: String(stat.asistencias),
      tarjetas_amarillas: String(stat.tarjetas_amarillas),
      tarjetas_rojas: String(stat.tarjetas_rojas),
      valoracion: stat.valoracion == null ? '' : String(stat.valoracion),
      observaciones: stat.observaciones || '',
    })
    setEditError('')
    setIsDetailOpen(false)
    setIsEditOpen(true)
  }

  const updateEditField = (field) => (event) => {
    setEditForm((current) => ({ ...current, [field]: event.target.value }))
    setEditError('')
  }

  const submitEdit = async (event) => {
    event.preventDefault()
    const validationError = validateValues(editForm)
    setEditError(validationError)
    if (validationError) return
    const payload = rowPayload({ ...editForm, jugador: relationId(editingStat.jugador) })
    delete payload.jugador
    setIsEditSaving(true)
    try {
      await api.patch(`/estadisticas-partido/${editingStat.id}/`, payload)
      setIsEditOpen(false)
      setEditingStat(null)
      const { data } = await api.get('/estadisticas-partido/')
      setStats(asList(data))
      if (matchFilter) await loadMatchStats(matchFilter)
      setSuccess('Estadística individual actualizada correctamente.')
    } catch (error) {
      setEditError(requestError(error, 'No se pudo actualizar la estadística.'))
    } finally {
      setIsEditSaving(false)
    }
  }

  const openDetail = async (stat) => {
    const playerId = relationId(stat.jugador)
    setDetailStat(stat)
    setPlayerHistory([])
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    setPageError('')
    try {
      const [{ data: detailData }, { data: historyData }] = await Promise.all([
        api.get(`/estadisticas-partido/${stat.id}/`),
        api.get(`/jugadores/${playerId}/estadisticas/`),
      ])
      setDetailStat(detailData)
      setPlayerHistory(asList(historyData))
    } catch (error) {
      setIsDetailOpen(false)
      setPageError(requestError(error, 'No se pudo cargar el detalle de la estadística.'))
    } finally {
      setIsDetailLoading(false)
    }
  }

  const selectedMatch = matchById.get(matchFilter)
  const playerName = (stat) => {
    const player = playerById.get(relationId(stat?.jugador))
    return player ? `${player.nombre} ${player.apellido}` : 'Jugador no disponible'
  }
  const matchLabel = (stat) => {
    const match = matchById.get(relationId(stat?.partido))
    return match ? `vs. ${match.rival}` : 'Partido no disponible'
  }

  return (
    <section className="page page-fluid categories-page player-stats-page">
      <div className="page-header categories-header"><div><p className="eyebrow">Rendimiento en partido</p><h1>Estadísticas individuales</h1><p>Registra el desempeño de cada jugador y consulta su historial competitivo.</p></div></div>
      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="player-stats-toolbar"><label>Club<select value={clubFilter} onChange={changeClub} disabled={isLoading || !clubs.length}>{!clubs.length && <option value="">No hay clubes</option>}{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><label>Equipo<select value={teamFilter} onChange={changeTeam} disabled={!clubFilter}><option value="">Selecciona un equipo</option>{clubTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label><label>Partido<select value={matchFilter} onChange={(event) => loadMatchStats(event.target.value)} disabled={!teamFilter}><option value="">Selecciona un partido</option>{teamMatches.map((match) => <option key={match.id} value={match.id}>vs. {match.rival} · {match.goles_equipo}-{match.goles_rival}</option>)}</select></label></div>

      {matchFilter && <section className="stats-register-panel"><div className="stats-panel-heading"><div><span className="eyebrow">Registro masivo</span><h2>{selectedMatch ? `vs. ${selectedMatch.rival}` : 'Partido'}</h2><p>{matchStats.length} estadísticas existentes · solo se enviarán filas modificadas</p></div><span className="stats-pending-chip">{draft.filter((row) => row.dirty).length} pendientes</span></div>{isMatchLoading ? <div className="stats-loading"><span className="clubs-loader" /><strong>Cargando jugadores...</strong></div> : draft.length === 0 ? <div className="stats-loading"><strong>No hay jugadores disponibles</strong></div> : <div className="stats-roster">{draft.map((row) => {
        const player = playerById.get(row.jugador)
        return <article className={`stats-player-row ${row.dirty ? 'is-dirty' : ''}`} key={row.jugador}><div className="stats-player-name"><span>{player?.numero_camiseta || '—'}</span><div><strong>{player?.nombre} {player?.apellido}</strong><small>{player?.posicion_principal || 'Sin posición'}</small></div></div><div className="stats-fields">{[['minutos_jugados', 'Minutos'], ['goles', 'Goles'], ['asistencias', 'Asist.'], ['tarjetas_amarillas', 'T. amarillas'], ['tarjetas_rojas', 'T. rojas'], ['valoracion', 'Valoración']].map(([field, label]) => <label key={field}>{label}<input type="number" min="0" max={field === 'valoracion' ? '10' : undefined} step={field === 'valoracion' ? '0.1' : '1'} value={row[field]} onChange={(event) => updateDraft(row.jugador, field, event.target.value)} /></label>)}</div><label className="stats-observations">Observaciones<input value={row.observaciones} onChange={(event) => updateDraft(row.jugador, 'observaciones', event.target.value)} placeholder="Buen desempeño" /></label></article>
      })}</div>}{formError && <div className="clubs-alert clubs-alert-error" role="alert">{formError}</div>}<div className="stats-save-actions"><span>{draft.filter((row) => row.dirty).length} de {draft.length} jugadores modificados</span><button type="button" className="button-primary" onClick={saveStats} disabled={isSaving || !draft.length}>{isSaving ? 'Guardando...' : 'Guardar estadísticas'}</button></div></section>}

      <section className="categories-list-card"><div className="categories-list-heading"><div><h2>Estadísticas registradas</h2><p>{visibleStats.length} {visibleStats.length === 1 ? 'registro encontrado' : 'registros encontrados'}</p></div></div>{isLoading ? <div className="categories-empty"><span className="clubs-loader" /></div> : visibleStats.length === 0 ? <div className="categories-empty"><span className="categories-empty-icon">E</span><strong>No hay estadísticas en esta vista</strong><p>Selecciona un equipo y partido para comenzar.</p></div> : <div className="categories-grid player-stats-grid">{visibleStats.map((stat) => <article className="category-card player-stat-card" key={stat.id}><div className="category-card-top"><div><span className="category-card-kicker">{matchLabel(stat)}</span><h3>{playerName(stat)}</h3></div><span className="stat-rating">{stat.valoracion ?? '—'}</span></div><div className="stat-numbers"><div><span>Min</span><strong>{stat.minutos_jugados}</strong></div><div><span>Goles</span><strong>{stat.goles}</strong></div><div><span>Asist.</span><strong>{stat.asistencias}</strong></div><div><span>Tarjetas</span><strong>{stat.tarjetas_amarillas}/{stat.tarjetas_rojas}</strong></div></div><p>{stat.observaciones || 'Sin observaciones.'}</p><div className="category-actions"><button type="button" onClick={() => openDetail(stat)}>Ver detalle</button><button type="button" onClick={() => openEdit(stat)}>Editar</button></div></article>)}</div>}</section>

      {isEditOpen && editingStat && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isEditSaving) setIsEditOpen(false) }}><section className="clubs-modal stat-edit-modal" role="dialog" aria-modal="true" aria-labelledby="stat-edit-title"><div className="clubs-modal-header"><div><span className="eyebrow">Edición individual</span><h2 id="stat-edit-title">Editar estadística</h2><p>{playerName(editingStat)} · {matchLabel(editingStat)}</p></div><button type="button" className="clubs-modal-close" onClick={() => setIsEditOpen(false)} aria-label="Cerrar formulario">×</button></div><form className="stat-edit-form" onSubmit={submitEdit} noValidate>{[['minutos_jugados', 'Minutos jugados'], ['goles', 'Goles'], ['asistencias', 'Asistencias'], ['tarjetas_amarillas', 'Tarjetas amarillas'], ['tarjetas_rojas', 'Tarjetas rojas'], ['valoracion', 'Valoración']].map(([field, label]) => <label className="clubs-form-group" key={field}>{label}<input type="number" min="0" max={field === 'valoracion' ? '10' : undefined} step={field === 'valoracion' ? '0.1' : '1'} value={editForm[field]} onChange={updateEditField(field)} /></label>)}<label className="clubs-form-group stat-field-full">Observaciones<textarea rows="3" value={editForm.observaciones} onChange={updateEditField('observaciones')} /></label>{editError && <div className="clubs-alert clubs-alert-error stat-field-full" role="alert">{editError}</div>}<div className="clubs-form-actions stat-field-full"><button type="button" className="button-ghost" onClick={() => setIsEditOpen(false)} disabled={isEditSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isEditSaving}>{isEditSaving ? 'Guardando...' : 'Guardar cambios'}</button></div></form></section></div>}

      {isDetailOpen && detailStat && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}><section className="clubs-modal stat-detail-modal" role="dialog" aria-modal="true" aria-labelledby="stat-detail-title"><div className="clubs-modal-header"><div><span className="eyebrow">Rendimiento individual</span><h2 id="stat-detail-title">Detalle de estadística</h2><p>{playerName(detailStat)}</p></div><button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button></div>{isDetailLoading ? <div className="stats-loading"><span className="clubs-loader" /></div> : <><div className="stat-detail-hero"><div><span>{matchLabel(detailStat)}</span><h3>{playerName(detailStat)}</h3></div><strong>{detailStat.valoracion ?? '—'}</strong></div><dl className="stat-detail-grid"><div><dt>Minutos</dt><dd>{detailStat.minutos_jugados}</dd></div><div><dt>Goles</dt><dd>{detailStat.goles}</dd></div><div><dt>Asistencias</dt><dd>{detailStat.asistencias}</dd></div><div><dt>Amarillas</dt><dd>{detailStat.tarjetas_amarillas}</dd></div><div><dt>Rojas</dt><dd>{detailStat.tarjetas_rojas}</dd></div><div><dt>Valoración</dt><dd>{detailStat.valoracion ?? 'Sin valorar'}</dd></div></dl><div className="stat-history"><h3>Historial del jugador</h3><p>{playerHistory.length} {playerHistory.length === 1 ? 'partido con estadísticas' : 'partidos con estadísticas'}</p><div>{playerHistory.slice(0, 4).map((history) => <span key={history.id}><strong>{matchLabel(history)}</strong><small>{history.minutos_jugados} min · {history.goles} goles · valoración {history.valoracion ?? '—'}</small></span>)}</div></div><div className="clubs-form-actions category-detail-actions"><button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button><button type="button" className="button-primary" onClick={() => openEdit(detailStat)}>Editar</button></div></>}</section></div>}
    </section>
  )
}

export default PlayerStatsPage
