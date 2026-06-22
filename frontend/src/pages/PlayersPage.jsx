import { useEffect, useMemo, useState } from 'react'

import api from '../api/axios'

const emptyForm = {
  nombre: '', apellido: '', fecha_nacimiento: '', dni: '', club_id: '',
  categoria: '', equipo_id: '', posicion_principal: '', tutor_usuario_id: '',
  tutor_nombre: '', tutor_telefono: '', tutor_correo: '', parentesco: '',
}
const asList = (data) => (Array.isArray(data) ? data : data?.results || [])
const playerClubId = (player) => String(player.club?.id || player.club || '')
const teamClubId = (team) => String(team.club?.id || team.club || '')
const localToday = () => {
  const today = new Date()
  return new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function PlayersPage() {
  const [players, setPlayers] = useState([])
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedClubId, setSelectedClubId] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [form, setForm] = useState(emptyForm)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [detailPlayer, setDetailPlayer] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isOptionsLoading, setIsOptionsLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isActive = true
    Promise.all([
      api.get('/jugadores/'),
      api.get('/clubes/'),
      api.get('/equipos/'),
      api.get('/usuarios/'),
    ])
      .then(async ([playersResponse, clubsResponse, teamsResponse, usersResponse]) => {
        if (!isActive) return
        const loadedClubs = asList(clubsResponse.data)
        setPlayers(asList(playersResponse.data))
        setClubs(loadedClubs)
        setTeams(asList(teamsResponse.data))
        setUsers(asList(usersResponse.data).filter((user) => user.activo !== false))
        if (loadedClubs.length) {
          const clubId = String(loadedClubs[0].id)
          setSelectedClubId(clubId)
          const { data } = await api.get(`/clubes/${clubId}/categorias/?estado=todas`)
          if (isActive) setCategories(asList(data))
        }
      })
      .catch(() => { if (isActive) setPageError('No pudimos cargar la gestión de jugadores. Intenta nuevamente.') })
      .finally(() => { if (isActive) setIsLoading(false) })
    return () => { isActive = false }
  }, [])

  const selectedClub = clubs.find((club) => String(club.id) === selectedClubId)
  const clubTeams = useMemo(() => teams.filter((team) => teamClubId(team) === selectedClubId), [selectedClubId, teams])
  const formTeams = useMemo(() => teams.filter((team) => {
    if (teamClubId(team) !== form.club_id) return false
    return !form.categoria || String(team.categoria || '').toLowerCase() === form.categoria.toLowerCase()
  }), [form.categoria, form.club_id, teams])
  const visiblePlayers = useMemo(() => players.filter((player) => {
    if (playerClubId(player) !== selectedClubId) return false
    if (categoryFilter && player.categoria !== categoryFilter) return false
    if (teamFilter && String(player.equipo_actual?.id || '') !== teamFilter) return false
    if (statusFilter === 'activos' && player.estado !== 'ACTIVO') return false
    if (statusFilter === 'inactivos' && player.estado === 'ACTIVO') return false
    return true
  }), [categoryFilter, players, selectedClubId, statusFilter, teamFilter])

  const loadPlayers = async () => {
    const { data } = await api.get('/jugadores/')
    setPlayers(asList(data))
  }

  const loadCategories = async (clubId) => {
    if (!clubId) return setCategories([])
    setIsOptionsLoading(true)
    try {
      const { data } = await api.get(`/clubes/${clubId}/categorias/?estado=todas`)
      setCategories(asList(data))
    } catch {
      setCategories([])
      setFormError('No se pudieron cargar las categorías del club.')
    } finally {
      setIsOptionsLoading(false)
    }
  }

  const changeListClub = (event) => {
    const clubId = event.target.value
    setSelectedClubId(clubId)
    setCategoryFilter('')
    setTeamFilter('')
    setSuccess('')
    loadCategories(clubId)
  }

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFormError('')
  }

  const changeFormClub = (event) => {
    const clubId = event.target.value
    setForm((current) => ({ ...current, club_id: clubId, categoria: '', equipo_id: '' }))
    setFormError('')
    loadCategories(clubId)
  }

  const changeCategory = (event) => {
    const categoria = event.target.value
    setForm((current) => ({ ...current, categoria, equipo_id: '' }))
    setFormError('')
  }

  const changeTutor = (event) => {
    const tutorId = event.target.value
    const tutor = users.find((user) => String(user.id) === tutorId)
    setForm((current) => ({
      ...current,
      tutor_usuario_id: tutorId,
      tutor_nombre: tutor ? `${tutor.nombre || ''} ${tutor.apellido || ''}`.trim() : '',
      tutor_telefono: tutor?.telefono || '',
      tutor_correo: tutor?.email || '',
    }))
    setFormError('')
  }

  const openCreateForm = () => {
    if (!selectedClubId) return setPageError('Crea o selecciona un club antes de registrar jugadores.')
    setEditingPlayer(null)
    setForm({ ...emptyForm, club_id: selectedClubId })
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
    loadCategories(selectedClubId)
  }

  const openEditForm = (player) => {
    const tutor = player.tutor_contacto
    const clubId = playerClubId(player)
    setEditingPlayer(player)
    setForm({
      nombre: player.nombre || '',
      apellido: player.apellido || '',
      fecha_nacimiento: player.fecha_nacimiento || '',
      dni: player.dni || '',
      club_id: clubId,
      categoria: player.categoria || '',
      equipo_id: String(player.equipo_actual?.id || ''),
      posicion_principal: player.posicion_principal || '',
      tutor_usuario_id: String(tutor?.usuario_id || ''),
      tutor_nombre: tutor ? `${tutor.nombre || ''} ${tutor.apellido || ''}`.trim() : '',
      tutor_telefono: tutor?.telefono || '',
      tutor_correo: tutor?.correo || '',
      parentesco: tutor?.parentesco || '',
    })
    setFormError('')
    setSuccess('')
    setIsDetailOpen(false)
    setIsFormOpen(true)
    loadCategories(clubId)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingPlayer(null)
    setForm(emptyForm)
    setFormError('')
    loadCategories(selectedClubId)
  }

  const validateForm = () => {
    if (!form.nombre.trim()) return 'Los nombres son obligatorios.'
    if (!form.apellido.trim()) return 'Los apellidos son obligatorios.'
    if (!form.fecha_nacimiento) return 'La fecha de nacimiento es obligatoria.'
    if (form.fecha_nacimiento > localToday()) return 'La fecha de nacimiento no puede ser futura.'
    if (!form.club_id) return 'El club es obligatorio.'
    if (!form.categoria) return 'La categoría es obligatoria.'
    if (!form.tutor_usuario_id || !form.tutor_nombre.trim()) return 'Selecciona un tutor o contacto responsable.'
    if (!form.tutor_telefono.trim() && !form.tutor_correo.trim()) return 'El tutor debe tener teléfono o correo.'
    if (!form.parentesco.trim()) return 'El parentesco es obligatorio.'
    return ''
  }

  const requestErrorMessage = (error) => {
    const data = error.response?.data
    if (!data) return 'No se pudo guardar el jugador. Intenta nuevamente.'
    for (const field of ['non_field_errors', 'nombre', 'apellido', 'fecha_nacimiento', 'club_id', 'categoria', 'equipo_id', 'tutor_usuario_id', 'parentesco', 'dni', 'detail']) {
      const value = data[field]
      const message = Array.isArray(value) ? value[0] : value
      if (typeof message === 'string') return message
    }
    return 'No se pudo guardar el jugador. Revisa los datos e intenta nuevamente.'
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setFormError('')
    const validationError = validateForm()
    if (validationError) return setFormError(validationError)
    const payload = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      fecha_nacimiento: form.fecha_nacimiento,
      dni: form.dni.trim() || null,
      club_id: String(form.club_id),
      categoria: form.categoria,
      posicion_principal: form.posicion_principal.trim() || null,
      tutor_usuario_id: String(form.tutor_usuario_id),
      parentesco: form.parentesco.trim(),
    }
    if (form.equipo_id) payload.equipo_id = String(form.equipo_id)

    setIsSaving(true)
    try {
      if (editingPlayer) await api.patch(`/jugadores/${editingPlayer.id}/`, payload)
      else await api.post('/jugadores/', payload)
      setSelectedClubId(form.club_id)
      setSuccess(editingPlayer ? 'Jugador actualizado correctamente.' : 'Jugador registrado correctamente.')
      setIsFormOpen(false)
      setEditingPlayer(null)
      setForm(emptyForm)
      await loadPlayers()
      await loadCategories(form.club_id)
    } catch (error) {
      setFormError(requestErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = async (player) => {
    setDetailPlayer(player)
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    setPageError('')
    try {
      const { data } = await api.get(`/jugadores/${player.id}/`)
      setDetailPlayer(data)
    } catch {
      setPageError('No pudimos cargar el detalle del jugador.')
      setIsDetailOpen(false)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const changeStatus = async (player) => {
    const isActive = player.estado === 'ACTIVO'
    const action = isActive ? 'desactivar' : 'activar'
    if (isActive && !window.confirm('¿Deseas desactivar este jugador?')) return
    setPendingAction(`${action}:${player.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.patch(`/jugadores/${player.id}/${action}/`)
      setSuccess(isActive ? 'Jugador desactivado correctamente.' : 'Jugador activado correctamente.')
      await loadPlayers()
    } catch {
      setPageError(`No se pudo ${action} el jugador. Intenta nuevamente.`)
    } finally {
      setPendingAction('')
    }
  }

  const deletePlayer = async (player) => {
    if (!window.confirm('¿Deseas dar de baja este jugador? El registro se conservará como inactivo.')) return
    setPendingAction(`delete:${player.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/jugadores/${player.id}/`)
      setSuccess('Jugador dado de baja correctamente.')
      await loadPlayers()
    } catch (error) {
      setPageError(error.response?.data?.detail || 'No se pudo dar de baja el jugador.')
    } finally {
      setPendingAction('')
    }
  }

  const clubName = (player) => clubs.find((club) => String(club.id) === playerClubId(player))?.nombre || 'Club no disponible'

  return (
    <section className="page page-fluid categories-page players-page">
      <div className="page-header categories-header"><div><p className="eyebrow">Planteles</p><h1>Gestión de jugadores</h1><p>Registra perfiles deportivos, equipo y contacto responsable.</p></div><button type="button" className="button-primary" onClick={openCreateForm} disabled={!selectedClubId}>+ Nuevo jugador</button></div>
      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="players-toolbar">
        <label>Club<select value={selectedClubId} onChange={changeListClub} disabled={isLoading || clubs.length <= 1}>{!clubs.length && <option value="">No hay clubes</option>}{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label>
        <label>Categoría<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="">Todas</option>{categories.map((category) => <option key={category.id} value={category.nombre}>{category.nombre}</option>)}</select></label>
        <label>Equipo<select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}><option value="">Todos</option>{clubTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label>
        <label>Estado<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="todos">Todos</option><option value="activos">Activos</option><option value="inactivos">Inactivos</option></select></label>
      </div>

      <section className="categories-list-card">
        <div className="categories-list-heading"><div><h2>{selectedClub ? `Jugadores de ${selectedClub.nombre}` : 'Jugadores del club'}</h2><p>{visiblePlayers.length} {visiblePlayers.length === 1 ? 'jugador encontrado' : 'jugadores encontrados'}</p></div></div>
        {isLoading ? <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando jugadores...</strong></div> : !selectedClubId ? <div className="categories-empty"><span className="categories-empty-icon">TS</span><strong>No hay clubes disponibles</strong></div> : visiblePlayers.length === 0 ? <div className="categories-empty"><span className="categories-empty-icon">+</span><strong>No hay jugadores en esta vista</strong><p>Registra un jugador o cambia los filtros.</p><button type="button" className="button-primary" onClick={openCreateForm}>Registrar jugador</button></div> : (
          <div className="categories-grid players-grid">{visiblePlayers.map((player) => {
            const active = player.estado === 'ACTIVO'
            const busy = pendingAction.endsWith(`:${player.id}`)
            return <article className="category-card player-card" key={player.id}><div className="category-card-top"><div><span className="category-card-kicker">{player.categoria || 'Sin categoría'}</span><h3>{player.nombre} {player.apellido}</h3></div><span className={active ? 'club-status-active' : 'club-status-inactive'}>{active ? 'Activo' : 'Inactivo'}</span></div><p>{player.posicion_principal || 'Sin posición registrada.'}</p><div className="category-card-meta player-card-meta"><span>Equipo <strong>{player.equipo_actual?.nombre || 'Sin equipo'}</strong></span><span>Nacimiento <strong>{player.fecha_nacimiento}</strong></span></div><div className="category-actions"><button type="button" onClick={() => openDetail(player)} disabled={busy}>Ver</button><button type="button" onClick={() => openEditForm(player)} disabled={busy}>Editar</button><button type="button" className={active ? 'is-warning' : 'is-success'} onClick={() => changeStatus(player)} disabled={busy}>{pendingAction === `${active ? 'desactivar' : 'activar'}:${player.id}` ? 'Procesando...' : active ? 'Desactivar' : 'Activar'}</button><button type="button" className="is-danger" onClick={() => deletePlayer(player)} disabled={busy}>{pendingAction === `delete:${player.id}` ? 'Procesando...' : 'Dar de baja'}</button></div></article>
          })}</div>
        )}
      </section>

      {isFormOpen && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="clubs-modal player-modal" role="dialog" aria-modal="true" aria-labelledby="player-form-title"><div className="clubs-modal-header"><div><span className="eyebrow">{editingPlayer ? 'Actualizar jugador' : 'Nuevo jugador'}</span><h2 id="player-form-title">{editingPlayer ? 'Editar jugador' : 'Registrar jugador'}</h2><p>Completa las tres secciones del perfil.</p></div><button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button></div><form className="player-form" onSubmit={submitForm} noValidate>
        <fieldset><legend>Datos personales</legend><label className="clubs-form-group">Nombres <span>*</span><input value={form.nombre} onChange={updateField('nombre')} autoFocus /></label><label className="clubs-form-group">Apellidos <span>*</span><input value={form.apellido} onChange={updateField('apellido')} /></label><label className="clubs-form-group">Fecha de nacimiento <span>*</span><input type="date" max={localToday()} value={form.fecha_nacimiento} onChange={updateField('fecha_nacimiento')} /></label><label className="clubs-form-group">DNI <small>(opcional)</small><input value={form.dni} onChange={updateField('dni')} /></label></fieldset>
        <fieldset><legend>Datos deportivos</legend><label className="clubs-form-group">Club <span>*</span><select value={form.club_id} onChange={changeFormClub}><option value="">Selecciona un club</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><label className="clubs-form-group">Categoría <span>*</span><select value={form.categoria} onChange={changeCategory} disabled={!form.club_id || isOptionsLoading}><option value="">Selecciona una categoría</option>{categories.map((category) => <option key={category.id} value={category.nombre}>{category.nombre}</option>)}</select></label><label className="clubs-form-group">Equipo <small>(opcional)</small><select value={form.equipo_id} onChange={updateField('equipo_id')} disabled={!form.club_id}><option value="">Sin equipo</option>{formTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}</select></label><label className="clubs-form-group">Posición <small>(opcional)</small><input value={form.posicion_principal} onChange={updateField('posicion_principal')} placeholder="Ej. Delantero" /></label><label className="clubs-form-group"><span>Altura</span><input disabled placeholder="Disponible en evolución física" /></label><label className="clubs-form-group"><span>Peso</span><input disabled placeholder="Disponible en evolución física" /></label></fieldset>
        <fieldset><legend>Tutor / contacto responsable</legend><label className="clubs-form-group player-field-full">Nombre <span>*</span><select value={form.tutor_usuario_id} onChange={changeTutor}><option value="">Selecciona un usuario existente</option>{users.map((user) => <option key={user.id} value={user.id}>{user.nombre} {user.apellido}</option>)}</select></label><label className="clubs-form-group">Teléfono<input value={form.tutor_telefono} readOnly placeholder="Sin teléfono" /></label><label className="clubs-form-group">Correo<input value={form.tutor_correo} readOnly placeholder="Sin correo" /></label><label className="clubs-form-group player-field-full">Parentesco <span>*</span><input value={form.parentesco} onChange={updateField('parentesco')} placeholder="Ej. Madre, padre o tutor" /></label></fieldset>
        {formError && <div className="clubs-alert clubs-alert-error" role="alert">{formError}</div>}<div className="clubs-form-actions"><button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isSaving || isOptionsLoading}>{isSaving ? 'Guardando...' : 'Guardar jugador'}</button></div>
      </form></section></div>}

      {isDetailOpen && detailPlayer && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}><section className="clubs-modal player-detail-modal" role="dialog" aria-modal="true" aria-labelledby="player-detail-title"><div className="clubs-modal-header"><div><span className="eyebrow">Perfil deportivo</span><h2 id="player-detail-title">Detalle del jugador</h2></div><button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button></div>{isDetailLoading ? <div className="categories-empty"><span className="clubs-loader" /></div> : <><div className="player-detail-hero"><div><span>{detailPlayer.categoria}</span><h3>{detailPlayer.nombre} {detailPlayer.apellido}</h3><p>{detailPlayer.posicion_principal || 'Sin posición registrada'}</p></div><span className={detailPlayer.estado === 'ACTIVO' ? 'club-status-active' : 'club-status-inactive'}>{detailPlayer.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</span></div><dl className="category-detail-grid player-detail-grid"><div><dt>Club</dt><dd>{clubName(detailPlayer)}</dd></div><div><dt>Equipo actual</dt><dd>{detailPlayer.equipo_actual?.nombre || 'Sin equipo'}</dd></div><div><dt>Nacimiento</dt><dd>{detailPlayer.fecha_nacimiento}</dd></div><div><dt>DNI</dt><dd>{detailPlayer.dni || 'No registrado'}</dd></div><div><dt>Tutor</dt><dd>{detailPlayer.tutor_contacto ? `${detailPlayer.tutor_contacto.nombre} ${detailPlayer.tutor_contacto.apellido}` : 'No disponible'}</dd></div><div><dt>Contacto</dt><dd>{detailPlayer.tutor_contacto?.telefono || detailPlayer.tutor_contacto?.correo || 'No disponible'}</dd></div><div><dt>Parentesco</dt><dd>{detailPlayer.tutor_contacto?.parentesco || 'No disponible'}</dd></div><div><dt>Categoría</dt><dd>{detailPlayer.categoria}</dd></div></dl><div className="clubs-form-actions category-detail-actions"><button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button><button type="button" className="button-primary" onClick={() => openEditForm(detailPlayer)}>Editar</button></div></>}</section></div>}
    </section>
  )
}

export default PlayersPage
