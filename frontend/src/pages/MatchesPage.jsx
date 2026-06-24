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

const clipTypeOptions = [
  { value: 'GOL', label: 'Gol' },
  { value: 'ASISTENCIA', label: 'Asistencia' },
  { value: 'PASE_CLAVE', label: 'Pase clave' },
  { value: 'SPRINT', label: 'Sprint ofensivo' },
  { value: 'RECUPERACION', label: 'Recuperación' },
  { value: 'RIESGO_LESION', label: 'Alerta preventiva' },
  { value: 'CAMBIO_POSICION', label: 'Cambio de posición' },
  { value: 'ACCION_DESTACADA', label: 'Acción destacada' },
]

const emptyClipEvent = {
  jugador_id: '',
  tipo: 'GOL',
  minuto: '',
  descripcion: '',
  enviar_padres: true,
}

const resultLabel = (result) => ({
  VICTORIA: 'Victoria',
  DERROTA: 'Derrota',
  EMPATE: 'Empate',
}[result] || result || 'Sin resultado')

const getFullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const baseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://127.0.0.1:8000';
  return `${baseUrl}${url}`;
};

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

  const [videoMatch, setVideoMatch] = useState(null)
  const [videoFile, setVideoFile] = useState(null)
  const [isVideoUploading, setIsVideoUploading] = useState(false)
  const [videoUploadError, setVideoUploadError] = useState('')
  const [videoStatus, setVideoStatus] = useState(null)
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [isReportLoading, setIsReportLoading] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [isHeatmapLoaded, setIsHeatmapLoaded] = useState(false)

  const [clipEvents, setClipEvents] = useState([{ ...emptyClipEvent }])
  const [clipsData, setClipsData] = useState([])
  const [isGeneratingClips, setIsGeneratingClips] = useState(false)
  const [isSharingClips, setIsSharingClips] = useState(false)
  const [clipsError, setClipsError] = useState('')

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

  useEffect(() => {
    let interval;
    if (isVideoModalOpen && videoMatch && videoStatus?.analisis_estado && ['PENDIENTE', 'PROCESANDO'].includes(videoStatus.analisis_estado)) {
      interval = setInterval(async () => {
        try {
          const { data } = await api.get(`/partidos/${videoMatch.id}/estado-analisis/`)
          setVideoStatus(data)
        } catch (e) {
          // ignore
        }
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [isVideoModalOpen, videoMatch, videoStatus?.analisis_estado])

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

  const openVideoModal = async (match) => {
    setVideoMatch(match)
    setVideoFile(null)
    setVideoUploadError('')
    setVideoStatus(null)
    setIsVideoModalOpen(true)
    try {
      const { data } = await api.get(`/partidos/${match.id}/estado-analisis/`)
      setVideoStatus(data)
    } catch (e) {
      if (e.response?.status !== 404) {
        setVideoUploadError(requestError(e, 'Error al consultar estado de video'))
      }
    }
  }

    const openReportModal = async (match) => {
    setIsVideoModalOpen(false)
    setReportData(null)
    setPageError('')
    setClipsError('')
    setClipsData([])
    setClipEvents([{ ...emptyClipEvent }])
    setIsReportModalOpen(true)
    setIsReportLoading(true)
    setIsHeatmapLoaded(false)

    try {
      const { data } = await api.get(`/partidos/${match.id}/informe-scouting/`)
      setReportData(data)
      setClipsData(data.metricas_json?.video_scout_clips || [])
    } catch (error) {
      setIsReportModalOpen(false)
      setPageError(requestError(error, 'No se pudo cargar el informe de scouting.'))
      setIsReportLoading(false)
      return
    }

    try {
      const { data } = await api.get(`/partidos/${match.id}/video-scout-clips/`)
      setClipsData(data.clips || [])
    } catch {
      // No bloqueamos el informe si todavía no existen clips.
      setClipsData([])
    } finally {
      setIsReportLoading(false)
    }
  }

  const exportPDF = () => {
    window.print()
  }

  const shareWithParents = async () => {
    if (!reportData) return
    setIsSharing(true)
    setPageError('')
    setSuccess('')
    try {
      const { data } = await api.post(`/partidos/${reportData.partido_id}/compartir-informe-padres/`)
      setSuccess(data.mensaje || 'Informe compartido con los padres correctamente.')
      // No cerramos el modal, solo mostramos el success message en background o en el toast principal
    } catch (error) {
      setPageError(requestError(error, 'Error al compartir el informe con los padres.'))
    } finally {
      setIsSharing(false)
    }
  }

  const closeVideoModal = () => {
    if (isVideoUploading) return
    setIsVideoModalOpen(false)
    setVideoMatch(null)
    setVideoFile(null)
  }

  const submitVideoUpload = async (event) => {
    event.preventDefault()
    if (!videoFile) {
      setVideoUploadError('Selecciona un archivo de video (MP4 o MOV).')
      return
    }
    const fd = new FormData()
    fd.append('video', videoFile)
    
    setIsVideoUploading(true)
    setVideoUploadError('')
    try {
      const { data } = await api.post(`/partidos/${videoMatch.id}/subir-video/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setSuccess('Video subido correctamente. Análisis en proceso.')
      setVideoStatus(data)
    } catch (e) {
      setVideoUploadError(requestError(e, 'Error al subir el video. Asegúrate que no exceda 500MB.'))
    } finally {
      setIsVideoUploading(false)
    }
  }

  const teamName = (match) => teamById.get(relationId(match?.equipo))?.nombre || 'Equipo no disponible'
  const matchEvent = (match) => eventById.get(relationId(match?.evento))

  const reportPlayers = reportData?.metricas_json?.metricas_jugadores || []

  const addClipEvent = () => {
    setClipEvents((current) => [...current, { ...emptyClipEvent }])
  }

  const removeClipEvent = (index) => {
    setClipEvents((current) => (
      current.length === 1 ? current : current.filter((_, i) => i !== index)
    ))
  }

  const updateClipEvent = (index, field, value) => {
    setClipEvents((current) => current.map((item, i) => (
      i === index ? { ...item, [field]: value } : item
    )))
    setClipsError('')
  }

  const generateVideoScoutClips = async () => {
    if (!reportData) return

    const invalid = clipEvents.find((item) => !item.jugador_id || item.minuto === '')
    if (invalid) {
      setClipsError('Completa jugador y minuto en todos los eventos.')
      return
    }

    setIsGeneratingClips(true)
    setClipsError('')
    setPageError('')
    setSuccess('')

    try {
      const payload = {
        eventos: clipEvents.map((item) => {
          const player = reportPlayers.find(
            (p) => String(p.jugador_id) === String(item.jugador_id),
          )

          return {
            ...item,
            jugador_nombre: player?.nombre_completo || 'Jugador',
            minuto: Number(item.minuto),
          }
        }),
      }

      const { data } = await api.post(
        `/partidos/${reportData.partido_id}/video-scout-clips/`,
        payload,
      )

      setClipsData(data.clips || [])
      setSuccess(data.mensaje || 'Clips generados correctamente desde el video del partido.')
    } catch (error) {
      setClipsError(requestError(error, 'No se pudieron generar los clips.'))
    } finally {
      setIsGeneratingClips(false)
    }
  }

  const shareVideoScoutClipsWithParents = async () => {
    if (!reportData) return

    setIsSharingClips(true)
    setPageError('')
    setSuccess('')

    try {
      const { data } = await api.post(
        `/partidos/${reportData.partido_id}/video-scout-clips/compartir-padres/`,
      )

      setSuccess(data.mensaje || 'Clips compartidos con los padres.')
    } catch (error) {
      setPageError(requestError(error, 'No se pudieron compartir los clips con los padres.'))
    } finally {
      setIsSharingClips(false)
    }
  }

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
          return <article className="category-card match-card" key={match.id}><div className="category-card-top"><div><span className="category-card-kicker">{teamName(match)}</span><h3>vs. {match.rival}</h3></div><span className={`match-result result-${match.resultado?.toLowerCase()}`}>{resultLabel(match.resultado)}</span></div><div className="match-score"><strong>{match.goles_equipo}</strong><span>—</span><strong>{match.goles_rival}</strong></div><p>{match.notas_tecnicas || 'Sin notas técnicas registradas.'}</p><div className="category-card-meta"><span>Evento <strong>{matchEventData?.titulo || 'No disponible'}</strong></span><span>Fecha <strong>{formatDateTime(matchEventData?.fecha_inicio)}</strong></span></div><div className="category-actions match-actions"><button type="button" onClick={() => openDetail(match)} disabled={busy}>Ver detalle</button><button type="button" onClick={() => openEditForm(match)} disabled={busy}>Editar</button><button type="button" onClick={() => openVideoModal(match)} disabled={busy}>Video e IA</button><button type="button" className="is-danger" onClick={() => removeMatch(match)} disabled={busy}>{busy ? 'Procesando...' : 'Dar de baja'}</button></div></article>
        })}</div>}
      </section>

      {isFormOpen && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="clubs-modal match-modal" role="dialog" aria-modal="true" aria-labelledby="match-form-title"><div className="clubs-modal-header"><div><span className="eyebrow">{editingMatch ? 'Actualizar resultado' : 'Nuevo resultado'}</span><h2 id="match-form-title">{editingMatch ? 'Editar partido' : 'Registrar partido'}</h2><p>Completa el rival, marcador y notas técnicas.</p></div><button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button></div><form className="match-form" onSubmit={submitForm} noValidate><label className="clubs-form-group">Equipo <span>*</span><select value={form.equipo} onChange={changeFormTeam}><option value="">Selecciona un equipo</option>{clubTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label><label className="clubs-form-group">Evento tipo partido <span>*</span><select value={form.evento} onChange={updateField('evento')} disabled={!form.equipo}><option value="">Selecciona un evento</option>{formEvents.map((event) => <option key={event.id} value={event.id}>{event.titulo} · {formatDateTime(event.fecha_inicio)}</option>)}</select></label><label className="clubs-form-group match-field-full">Rival <span>*</span><input value={form.rival} onChange={updateField('rival')} placeholder="Ej. Tigres FC" /></label><label className="clubs-form-group">Goles del equipo <span>*</span><input type="number" min="0" step="1" value={form.goles_equipo} onChange={updateField('goles_equipo')} /></label><label className="clubs-form-group">Goles del rival <span>*</span><input type="number" min="0" step="1" value={form.goles_rival} onChange={updateField('goles_rival')} /></label><label className="clubs-form-group match-field-full">Notas técnicas <small>(opcional)</small><textarea rows="4" value={form.notas_tecnicas} onChange={updateField('notas_tecnicas')} placeholder="Buen desempeño colectivo" /></label>{formError && <div className="clubs-alert clubs-alert-error match-field-full" role="alert">{formError}</div>}<div className="clubs-form-actions match-field-full"><button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar partido'}</button></div></form></section></div>}

      {isDetailOpen && detailMatch && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}><section className="clubs-modal match-detail-modal" role="dialog" aria-modal="true" aria-labelledby="match-detail-title"><div className="clubs-modal-header"><div><span className="eyebrow">Resultado registrado</span><h2 id="match-detail-title">Detalle del partido</h2></div><button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button></div>{isDetailLoading ? <div className="categories-empty"><span className="clubs-loader" /></div> : <><div className="match-detail-hero"><div><span>{teamName(detailMatch)}</span><h3>vs. {detailMatch.rival}</h3><p>{formatDateTime(matchEvent(detailMatch)?.fecha_inicio)}</p></div><div className="match-detail-score"><strong>{detailMatch.goles_equipo}</strong><span>—</span><strong>{detailMatch.goles_rival}</strong></div></div><dl className="category-detail-grid match-detail-grid"><div><dt>Resultado</dt><dd>{resultLabel(detailMatch.resultado)}</dd></div><div><dt>Equipo</dt><dd>{teamName(detailMatch)}</dd></div><div><dt>Evento</dt><dd>{matchEvent(detailMatch)?.titulo || 'No disponible'}</dd></div><div><dt>Rival</dt><dd>{detailMatch.rival}</dd></div></dl><div className="match-detail-notes"><span>Notas técnicas</span><p>{detailMatch.notas_tecnicas || 'Sin notas técnicas registradas.'}</p></div><div className="clubs-form-actions category-detail-actions"><button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button><button type="button" className="button-primary" onClick={() => openEditForm(detailMatch)}>Editar partido</button></div></>}</section></div>}

      {isVideoModalOpen && videoMatch && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeVideoModal() }}><section className="clubs-modal match-modal" role="dialog" aria-modal="true" aria-labelledby="video-modal-title"><div className="clubs-modal-header"><div><span className="eyebrow">Inteligencia Artificial</span><h2 id="video-modal-title">Subir video del partido</h2><p>Sube la grabación vs {videoMatch.rival} para generar clips, métricas y evidencia audiovisual del partido.</p></div><button type="button" className="clubs-modal-close" onClick={closeVideoModal} aria-label="Cerrar modal">×</button></div><div className="match-form">
        {!videoStatus || videoStatus.analisis_estado === 'SIN_VIDEO' ? (
          <form onSubmit={submitVideoUpload}>
            <label className="clubs-form-group match-field-full">Archivo de video (MP4/MOV, Max 500MB) <span>*</span>
              <input type="file" accept=".mp4,.mov,video/mp4,video/quicktime" onChange={(e) => setVideoFile(e.target.files[0])} disabled={isVideoUploading} />
            </label>
            {videoUploadError && <div className="clubs-alert clubs-alert-error match-field-full" role="alert">{videoUploadError}</div>}
            <div className="clubs-form-actions match-field-full">
              <button type="button" className="button-ghost" onClick={closeVideoModal} disabled={isVideoUploading}>Cancelar</button>
              <button type="submit" className="button-primary" disabled={isVideoUploading}>{isVideoUploading ? 'Subiendo video...' : 'Subir e iniciar análisis'}</button>
            </div>
          </form>
        ) : (
          <div className="match-field-full" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ padding: '1.5rem', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Estado del análisis</h3>
              <p style={{ margin: 0, fontWeight: 500, color: videoStatus.analisis_estado === 'COMPLETADO' ? 'var(--color-success)' : videoStatus.analisis_estado === 'ERROR' ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                {videoStatus.mensaje}
              </p>
              {['PENDIENTE', 'PROCESANDO'].includes(videoStatus.analisis_estado) && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ width: '100%', height: '8px', background: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--color-primary)', width: `${videoStatus.analisis_progreso}%`, transition: 'width 0.3s ease' }} />
                  </div>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--color-text-secondary)', textAlign: 'right' }}>{videoStatus.analisis_progreso}% completado</p>
                </div>
              )}
              {videoStatus.analisis_estado === 'ERROR' && (
                <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--color-danger)' }}>{videoStatus.analisis_error}</p>
              )}
            </div>
            {videoStatus.informe_disponible && (
              <div className="clubs-alert clubs-alert-success">
                <strong>Análisis completado</strong>
                <p style={{ margin: 0 }}>El informe de scouting IA ha sido generado correctamente y está listo para revisión.</p>
              </div>
            )}
            <div className="clubs-form-actions">
              <button type="button" className="button-ghost" onClick={closeVideoModal}>Cerrar</button>
              {videoStatus.video_url && (
                <a href={getFullUrl(videoStatus.video_url)} target="_blank" rel="noreferrer" className="button-ghost" style={{ textDecoration: 'none' }}>Ver video</a>
              )}
              {videoStatus.analisis_estado === 'COMPLETADO' && videoStatus.informe_disponible && (
                <button type="button" className="button-primary" onClick={() => openReportModal(videoMatch)}>Ver informe IA</button>
              )}
            </div>
          </div>
        )}
      </div></section></div>}

      {isReportModalOpen && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsReportModalOpen(false) }}><section className="clubs-modal match-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title" style={{ maxWidth: '900px', width: '95%' }}><div className="clubs-modal-header" style={{ '@media print': { display: 'none' } }}><div><span className="eyebrow">Scouting IA</span><h2 id="report-modal-title">Informe de scouting IA</h2><p>Análisis generado automáticamente a partir del video del partido.</p></div><button type="button" className="clubs-modal-close" onClick={() => setIsReportModalOpen(false)} aria-label="Cerrar modal">×</button></div>
        {isReportLoading ? (
          <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando informe...</strong></div>
        ) : reportData ? (
          <div className="match-detail-grid" style={{ gap: '1.5rem', padding: '0 1.5rem 1.5rem', maxHeight: '75vh', overflowY: 'auto' }} id="print-area">
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-primary)' }}>{teamById.get(teamFilter)?.nombre || teamName(videoMatch) || 'Equipo Local'} vs. {videoMatch?.rival || 'Rival'}</h2>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--color-text-secondary)' }}>Scouting generado automáticamente a partir del video y estadísticas del partido.</p>
                </div>
                <span style={{ padding: '0.35rem 0.85rem', borderRadius: '2rem', fontSize: '0.85rem', fontWeight: 600, background: reportData.analisis_estado === 'COMPLETADO' ? 'var(--color-success)' : 'var(--color-bg-secondary)', color: reportData.analisis_estado === 'COMPLETADO' ? '#fff' : 'var(--color-text)' }}>
                  {reportData.analisis_estado === 'COMPLETADO' ? 'Completado' : reportData.analisis_estado}
                </span>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Fecha de generación: {formatDateTime(reportData.creado_en)}</span>
            </div>
            
            {/* B. Resumen táctico */}
            <div style={{ padding: '1.5rem', background: 'var(--color-bg-secondary)', borderRadius: '12px', border: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ background: 'var(--color-primary)', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lectura táctica IA</span>
              </div>
              <p style={{ margin: 0, lineHeight: 1.6, fontSize: '1rem', color: 'var(--color-text)' }}>{reportData.metricas_json?.resumen_tactico || reportData.resumen || 'Sin resumen táctico disponible.'}</p>
            </div>

            {/* C. Top rendimiento */}
            <div className="print-section" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text)' }}>Top Rendimiento</h3>
              {reportData.metricas_json?.top_rendimiento?.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                  {reportData.metricas_json.top_rendimiento.map((top, idx) => (
                    <div key={idx} className="print-card" style={{ padding: '1.25rem', background: '#fff', borderRadius: '12px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>{top.posicion}</span>
                        {top.valoracion && <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1.1rem' }}>{top.valoracion}</span>}
                      </div>
                      <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--color-text)' }}>{top.nombre}</h4>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-success)', background: 'rgba(16, 185, 129, 0.1)', padding: '0.4rem 0.6rem', borderRadius: '6px', lineHeight: 1.4 }}>{top.motivo}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No hay jugadores destacados registrados todavía.</p>
              )}
            </div>

            {/* F. Heatmap */}
            <div className="print-section" style={{ marginBottom: '1.5rem', pageBreakInside: 'avoid' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: 'var(--color-text)' }}>Zonas de mayor participación</h3>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', marginBottom: '0.25rem', lineHeight: 1.4 }}>Este gráfico muestra en qué partes de la cancha el equipo tuvo más actividad durante el partido.</p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', marginBottom: '0.25rem', lineHeight: 1.4 }}>Mientras más fuerte se ve el color, más participación hubo en esa zona.</p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', marginBottom: '1.5rem', fontStyle: 'italic' }}>Sirve para saber si el equipo jugó más en defensa, mediocampo o ataque.</p>
              
              {reportData.metricas_json?.heatmap_url ? (
                <div className="print-heatmap" style={{ background: '#fff', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                  <img 
                    src={`${getFullUrl(reportData.metricas_json.heatmap_url)}?t=${Date.now()}`} 
                    alt="Zonas de mayor participación" 
                    style={{ maxWidth: '100%', width: '100%', height: 'auto', borderRadius: '8px', display: 'block', margin: '0 auto 1.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} 
                    onLoad={() => setIsHeatmapLoaded(true)} 
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; setIsHeatmapLoaded(true); }} 
                  />
                  <p style={{ display: 'none', color: 'var(--color-text-secondary)', fontStyle: 'italic', margin: 0 }}>No se pudieron cargar las zonas de participación.</p>
                  
                  <div style={{ background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text)' }}><strong>Interpretación:</strong> revisa las zonas más marcadas para identificar dónde se concentró el juego.</p>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(0,0,255,0.4)' }}></div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>poca participación</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(0,255,0,0.6)' }}></div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>participación normal</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'rgba(255,0,0,0.8)' }}></div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>mucha participación</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--color-bg-secondary)', padding: '2rem', borderRadius: '12px', textAlign: 'center', border: '1px dashed var(--color-border)' }}>
                  <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: '1rem' }}>Todavía no hay zonas de participación generadas para este partido.</p>
                </div>
              )}
            </div>

            {/* D. Métricas por jugador */}
            <div className="print-section" style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-text)' }}>Métricas por Jugador</h3>
              {reportData.metricas_json?.metricas_jugadores?.length > 0 ? (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
                  <table className="print-metrics-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '2px solid var(--color-border)', textAlign: 'left' }}>
                        <th style={{ padding: '1rem', color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>Jugador</th>
                        <th style={{ padding: '1rem', color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>Posición</th>
                        <th style={{ padding: '1rem', color: 'var(--color-text)', fontWeight: 600 }}>Goles</th>
                        <th style={{ padding: '1rem', color: 'var(--color-text)', fontWeight: 600 }}>Asistencias</th>
                        <th style={{ padding: '1rem', color: 'var(--color-text)', fontWeight: 600 }}>Tarjetas</th>
                        <th style={{ padding: '1rem', color: 'var(--color-text)', fontWeight: 600 }}>Valoración</th>
                        <th style={{ padding: '1rem', color: 'var(--color-text)', fontWeight: 600, whiteSpace: 'nowrap' }}>Perfil sugerido</th>
                        <th style={{ padding: '1rem', color: 'var(--color-text)', fontWeight: 600, minWidth: '200px' }}>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.metricas_json.metricas_jugadores.map((j, idx) => (
                        <tr key={j.jugador_id || idx} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s' }}>
                          <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>{j.nombre_completo}</td>
                          <td style={{ padding: '1rem', color: 'var(--color-text-secondary)' }}>{j.posicion}</td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>{j.goles}</td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>{j.asistencias}</td>
                          <td style={{ padding: '1rem', textAlign: 'center' }}>{j.tarjetas}</td>
                          <td style={{ padding: '1rem', textAlign: 'center', fontWeight: 700, color: j.valoracion > 7 ? 'var(--color-success)' : 'inherit' }}>{j.valoracion || '-'}</td>
                          <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{j.perfil_sugerido}</td>
                          <td style={{ padding: '1rem', fontSize: '0.85rem', lineHeight: 1.4, color: 'var(--color-text-secondary)' }}>{j.observacion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No hay métricas individuales de jugadores.</p>
              )}
            </div>

            {/* E. Recomendaciones tácticas */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--color-primary)' }}>Recomendaciones Tácticas</h3>
              {reportData.metricas_json?.recomendaciones?.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.5rem', color: 'var(--color-text)' }}>
                  {reportData.metricas_json.recomendaciones.map((rec, idx) => (
                    <li key={idx} style={{ marginBottom: '0.5rem', lineHeight: 1.4 }}>{rec}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>No hay recomendaciones específicas.</p>
              )}
            </div>

            {/* G. IA Video Scout Clips */}
            <div style={{ marginTop: '2rem', pageBreakInside: 'avoid' }}>
              <div style={{ padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--color-primary)', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem 0', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  IA Video Scout Clips 
                  <span style={{ fontSize: '0.75rem', background: 'var(--color-primary)', color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Automatización audiovisual
                  </span>
                </h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
                  El sistema transforma el video completo en clips deportivos por jugador y jugada.
                </p>
              </div>
              
              {clipsError && <div className="clubs-alert clubs-alert-error" role="alert" style={{ marginBottom: '1rem' }}>{clipsError}</div>}
              
              <div className="no-print" style={{ background: 'var(--color-bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '1rem', marginTop: 0 }}>Nuevos eventos</h4>
                {clipEvents.map((clip, index) => (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.5rem', alignItems: 'end', marginBottom: '1rem', background: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--color-border)' }}>
                    <label className="clubs-form-group" style={{ margin: 0 }}>
                      Jugador
                      <select value={clip.jugador_id} onChange={(e) => updateClipEvent(index, 'jugador_id', e.target.value)}>
                        <option value="">Selecciona</option>
                        {reportData.metricas_json?.metricas_jugadores?.map((j) => (
                          <option key={j.jugador_id} value={j.jugador_id}>{j.nombre_completo}</option>
                        ))}
                      </select>
                    </label>
                    <label className="clubs-form-group" style={{ margin: 0 }}>
                      Acción
                      <select value={clip.tipo} onChange={(e) => updateClipEvent(index, 'tipo', e.target.value)}>
                        {clipTypeOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </label>
                    <label className="clubs-form-group" style={{ margin: 0 }}>
                      Minuto
                      <input type="number" min="0" value={clip.minuto} onChange={(e) => updateClipEvent(index, 'minuto', e.target.value)} placeholder="Ej. 12" />
                    </label>
                    <label className="clubs-form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
                      Descripción
                      <input type="text" value={clip.descripcion} onChange={(e) => updateClipEvent(index, 'descripcion', e.target.value)} placeholder="Ej. Tiro cruzado" />
                    </label>
                    <label className="clubs-form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, paddingBottom: '0.5rem' }}>
                      <input type="checkbox" checked={clip.enviar_padres} onChange={(e) => updateClipEvent(index, 'enviar_padres', e.target.checked)} />
                      Compartir con padres
                    </label>
                    <button type="button" className="button-ghost is-danger" onClick={() => removeClipEvent(index)} style={{ padding: '0.5rem', height: 'fit-content', marginBottom: '0.2rem' }}>X</button>
                  </div>
                ))}
                
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button type="button" className="button-ghost" onClick={addClipEvent}>+ Agregar evento</button>
                  {clipEvents.length > 0 && (
                    <button type="button" className="button-primary" onClick={generateVideoScoutClips} disabled={isGeneratingClips}>
                      {isGeneratingClips ? 'Generando...' : 'Generar clips IA'}
                    </button>
                  )}
                </div>
              </div>

              {/* Clips generados */}
              {clipsData.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h4 style={{ fontSize: '1rem', margin: 0 }}>Clips generados</h4>
                    <button type="button" className="button-primary" onClick={shareVideoScoutClipsWithParents} disabled={isSharingClips || clipsData.length === 0}>
                      {isSharingClips ? 'Compartiendo...' : 'Compartir clips con padres'}
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                    {clipsData.map((clip, idx) => (
                      <div key={idx} className="print-card" style={{ background: '#fff', borderRadius: '8px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        <video className="no-print" controls style={{ width: '100%', display: 'block', background: '#000' }} src={getFullUrl(clip.clip_url)} />
                        <div style={{ padding: '1rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)', background: 'var(--color-bg-secondary)', padding: '0.25rem 0.5rem', borderRadius: '1rem', display: 'inline-block', marginBottom: '0.5rem' }}>{clip.tipo_label} - Min {clip.minuto}</span>
                          <h5 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{clip.jugador_nombre}</h5>
                          <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>{clip.descripcion || 'Sin descripción'}</p>
                          {clip.enviar_padres && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span>✓</span> Se compartirá con padres</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="clubs-form-actions no-print" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="button-ghost" onClick={() => setIsReportModalOpen(false)}>Cerrar informe</button>
              {reportData.video_url && (
                <a href={getFullUrl(reportData.video_url)} target="_blank" rel="noreferrer" className="button-ghost" style={{ textDecoration: 'none' }}>Ver video subido</a>
              )}
              <button type="button" className="button-primary" onClick={exportPDF} disabled={reportData.metricas_json?.heatmap_url && !isHeatmapLoaded}>
                {reportData.metricas_json?.heatmap_url && !isHeatmapLoaded ? 'Cargando imagen...' : 'Exportar PDF'}
              </button>
              <button type="button" className="button-primary" onClick={shareWithParents} disabled={isSharing}>
                {isSharing ? 'Compartiendo...' : 'Compartir con padres'}
              </button>
            </div>
          </div>
        ) : (
          <div className="categories-empty"><span className="categories-empty-icon">!</span><strong>Informe no disponible</strong></div>
        )}
      </section></div>}
    </section>
  )
}

export default MatchesPage
