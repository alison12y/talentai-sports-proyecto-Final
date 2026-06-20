import { useEffect, useMemo, useState } from 'react'

import api from '../api/axios'

const emptyForm = { nombre: '', club_id: '', temporada: '', categoria: '', descripcion: '' }
const filterOptions = [['todos', 'Todos'], ['activos', 'Activos'], ['inactivos', 'Inactivos']]
const asList = (data) => (Array.isArray(data) ? data : data?.results || [])
const teamClubId = (team) => String(team.club?.id || team.club || '')

function TeamsPage() {
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedClubId, setSelectedClubId] = useState('')
  const [filter, setFilter] = useState('todos')
  const [form, setForm] = useState(emptyForm)
  const [editingTeam, setEditingTeam] = useState(null)
  const [detailTeam, setDetailTeam] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isActive = true
    Promise.all([api.get('/clubes/'), api.get('/equipos/')])
      .then(async ([clubsResponse, teamsResponse]) => {
        if (!isActive) return
        const loadedClubs = asList(clubsResponse.data)
        setClubs(loadedClubs)
        setTeams(asList(teamsResponse.data))
        if (loadedClubs.length) {
          const clubId = String(loadedClubs[0].id)
          setSelectedClubId(clubId)
          const { data } = await api.get(`/clubes/${clubId}/categorias/?estado=todas`)
          if (isActive) setCategories(asList(data))
        }
      })
      .catch(() => { if (isActive) setPageError('No pudimos cargar la gestión de equipos. Intenta nuevamente.') })
      .finally(() => { if (isActive) setIsPageLoading(false) })
    return () => { isActive = false }
  }, [])

  const selectedClub = clubs.find((club) => String(club.id) === selectedClubId)
  const visibleTeams = useMemo(() => teams.filter((team) => {
    if (teamClubId(team) !== selectedClubId) return false
    if (filter === 'activos') return team.activo
    if (filter === 'inactivos') return !team.activo
    return true
  }), [filter, selectedClubId, teams])

  const loadTeams = async () => {
    const { data } = await api.get('/equipos/')
    setTeams(asList(data))
  }

  const loadCategories = async (clubId) => {
    if (!clubId) return setCategories([])
    setIsCategoriesLoading(true)
    try {
      const { data } = await api.get(`/clubes/${clubId}/categorias/?estado=todas`)
      setCategories(asList(data))
    } catch {
      setCategories([])
      setFormError('No se pudieron cargar las categorías del club.')
    } finally {
      setIsCategoriesLoading(false)
    }
  }

  const changeClub = (event) => {
    const clubId = event.target.value
    setSelectedClubId(clubId)
    setSuccess('')
    setPageError('')
    loadCategories(clubId)
  }

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFormError('')
  }

  const changeFormClub = (event) => {
    const clubId = event.target.value
    setForm((current) => ({ ...current, club_id: clubId, categoria: '' }))
    setFormError('')
    loadCategories(clubId)
  }

  const openCreateForm = () => {
    if (!selectedClubId) return setPageError('Crea o selecciona un club antes de registrar equipos.')
    setEditingTeam(null)
    setForm({ ...emptyForm, club_id: selectedClubId })
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
    loadCategories(selectedClubId)
  }

  const openEditForm = (team) => {
    const clubId = teamClubId(team)
    setEditingTeam(team)
    setForm({ nombre: team.nombre || '', club_id: clubId, temporada: team.temporada || '', categoria: team.categoria || '', descripcion: team.descripcion || '' })
    setFormError('')
    setSuccess('')
    setIsDetailOpen(false)
    setIsFormOpen(true)
    loadCategories(clubId)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingTeam(null)
    setForm(emptyForm)
    setFormError('')
    loadCategories(selectedClubId)
  }

  const validateForm = () => {
    if (!form.nombre.trim()) return 'El nombre del equipo es obligatorio.'
    if (!form.club_id) return 'El club es obligatorio.'
    if (!form.temporada.trim()) return 'La temporada es obligatoria.'
    if (!form.categoria) return 'La categoría es obligatoria.'
    return ''
  }

  const requestErrorMessage = (error) => {
    const data = error.response?.data
    if (!data) return 'No se pudo guardar el equipo. Intenta nuevamente.'
    for (const candidate of [data.non_field_errors, data.nombre, data.club_id, data.temporada, data.categoria, data.detail]) {
      const message = Array.isArray(candidate) ? candidate[0] : candidate
      if (typeof message === 'string') return message
    }
    return 'No se pudo guardar el equipo. Revisa los datos e intenta nuevamente.'
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setFormError('')
    const validationError = validateForm()
    if (validationError) return setFormError(validationError)
    const payload = {
      nombre: form.nombre.trim(),
      club_id: String(form.club_id),
      temporada: form.temporada.trim(),
      categoria: form.categoria.trim(),
      descripcion: form.descripcion.trim(),
    }
    setIsSaving(true)
    try {
      if (editingTeam) await api.patch(`/equipos/${editingTeam.id}/`, payload)
      else await api.post('/equipos/', payload)
      setSelectedClubId(form.club_id)
      setSuccess(editingTeam ? 'Equipo actualizado correctamente.' : 'Equipo creado correctamente.')
      setIsFormOpen(false)
      setEditingTeam(null)
      setForm(emptyForm)
      await loadTeams()
      await loadCategories(form.club_id)
    } catch (error) {
      setFormError(requestErrorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = async (team) => {
    setDetailTeam(team)
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    setPageError('')
    try {
      const { data } = await api.get(`/equipos/${team.id}/`)
      setDetailTeam(data)
    } catch {
      setPageError('No pudimos cargar el detalle del equipo.')
      setIsDetailOpen(false)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const changeStatus = async (team) => {
    const action = team.activo ? 'desactivar' : 'activar'
    if (team.activo && !window.confirm('¿Deseas desactivar este equipo?')) return
    setPendingAction(`${action}:${team.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.patch(`/equipos/${team.id}/${action}/`)
      setSuccess(team.activo ? 'Equipo desactivado correctamente.' : 'Equipo activado correctamente.')
      await loadTeams()
    } catch {
      setPageError(`No se pudo ${action} el equipo. Intenta nuevamente.`)
    } finally {
      setPendingAction('')
    }
  }

  const deleteTeam = async (team) => {
    if (!window.confirm('¿Deseas dar de baja este equipo? El registro se conservará como inactivo.')) return
    setPendingAction(`delete:${team.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/equipos/${team.id}/`)
      setSuccess('Equipo dado de baja correctamente.')
      await loadTeams()
    } catch (error) {
      setPageError(error.response?.data?.detail || 'No se pudo dar de baja el equipo. Intenta nuevamente.')
    } finally {
      setPendingAction('')
    }
  }

  const clubName = (team) => clubs.find((club) => String(club.id) === teamClubId(team))?.nombre || 'Club no disponible'

  return (
    <section className="page page-fluid categories-page teams-page">
      <div className="page-header categories-header">
        <div><p className="eyebrow">Planteles</p><h1>Gestión de equipos</h1><p>Organiza los equipos por club, categoría deportiva y temporada.</p></div>
        <button type="button" className="button-primary" onClick={openCreateForm} disabled={!selectedClubId}>+ Nuevo equipo</button>
      </div>
      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="categories-toolbar">
        <label>Club<select value={selectedClubId} onChange={changeClub} disabled={isPageLoading || clubs.length <= 1}>{!clubs.length && <option value="">No hay clubes disponibles</option>}{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label>
        <div className="categories-filter" aria-label="Filtrar equipos">{filterOptions.map(([value, label]) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)} disabled={!selectedClubId}>{label}</button>)}</div>
      </div>

      <section className="categories-list-card">
        <div className="categories-list-heading"><div><h2>{selectedClub ? `Equipos de ${selectedClub.nombre}` : 'Equipos del club'}</h2><p>{visibleTeams.length} {visibleTeams.length === 1 ? 'equipo encontrado' : 'equipos encontrados'}</p></div></div>
        {isPageLoading ? <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando equipos...</strong></div> : !selectedClubId ? <div className="categories-empty"><span className="categories-empty-icon">TS</span><strong>No hay clubes disponibles</strong><p>Crea un club antes de administrar equipos.</p></div> : visibleTeams.length === 0 ? <div className="categories-empty"><span className="categories-empty-icon">+</span><strong>No hay equipos en esta vista</strong><p>Crea un equipo o cambia el filtro seleccionado.</p><button type="button" className="button-primary" onClick={openCreateForm}>Crear equipo</button></div> : (
          <div className="categories-grid teams-grid">{visibleTeams.map((team) => {
            const busy = pendingAction.endsWith(`:${team.id}`)
            return <article className="category-card team-card" key={team.id}><div className="category-card-top"><div><span className="category-card-kicker">Temporada {team.temporada}</span><h3>{team.nombre}</h3></div><span className={team.activo ? 'club-status-active' : 'club-status-inactive'}>{team.activo ? 'Activo' : 'Inactivo'}</span></div><p>{team.descripcion || 'Sin descripción registrada.'}</p><div className="category-card-meta team-card-meta"><span>Categoría <strong>{team.categoria}</strong></span><span>Club <strong>{clubName(team)}</strong></span></div><div className="category-actions"><button type="button" onClick={() => openDetail(team)} disabled={busy}>Ver</button><button type="button" onClick={() => openEditForm(team)} disabled={busy}>Editar</button><button type="button" className={team.activo ? 'is-warning' : 'is-success'} onClick={() => changeStatus(team)} disabled={busy}>{pendingAction === `${team.activo ? 'desactivar' : 'activar'}:${team.id}` ? 'Procesando...' : team.activo ? 'Desactivar' : 'Activar'}</button><button type="button" className="is-danger" onClick={() => deleteTeam(team)} disabled={busy}>{pendingAction === `delete:${team.id}` ? 'Procesando...' : 'Dar de baja'}</button></div></article>
          })}</div>
        )}
      </section>

      {isFormOpen && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="clubs-modal category-modal" role="dialog" aria-modal="true" aria-labelledby="team-form-title"><div className="clubs-modal-header"><div><span className="eyebrow">{editingTeam ? 'Actualizar equipo' : 'Nuevo equipo'}</span><h2 id="team-form-title">{editingTeam ? 'Editar equipo' : 'Crear equipo'}</h2><p>Completa los datos deportivos obligatorios.</p></div><button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button></div><form className="category-form" onSubmit={submitForm} noValidate><label className="clubs-form-group category-field-full">Nombre del equipo <span>*</span><input value={form.nombre} onChange={updateField('nombre')} placeholder="Ej. Sub-12 A" autoFocus /></label><label className="clubs-form-group">Club <span>*</span><select value={form.club_id} onChange={changeFormClub}><option value="">Selecciona un club</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label><label className="clubs-form-group">Temporada <span>*</span><input value={form.temporada} onChange={updateField('temporada')} placeholder="Ej. 2026" /></label><label className="clubs-form-group category-field-full">Categoría <span>*</span><select value={form.categoria} onChange={updateField('categoria')} disabled={!form.club_id || isCategoriesLoading}><option value="">{isCategoriesLoading ? 'Cargando categorías...' : 'Selecciona una categoría'}</option>{categories.map((category) => <option key={category.id} value={category.nombre}>{category.nombre}{category.activo ? '' : ' (inactiva)'}</option>)}</select></label><label className="clubs-form-group category-field-full">Descripción <small>(opcional)</small><textarea value={form.descripcion} onChange={updateField('descripcion')} placeholder="Describe el propósito o nivel del equipo" rows="3" /></label>{form.club_id && !isCategoriesLoading && categories.length === 0 && <div className="teams-form-note category-field-full">Este club no tiene categorías. Crea una categoría antes de guardar el equipo.</div>}{formError && <div className="clubs-alert clubs-alert-error category-field-full" role="alert">{formError}</div>}<div className="clubs-form-actions category-field-full"><button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isSaving || isCategoriesLoading}>{isSaving ? 'Guardando...' : 'Guardar equipo'}</button></div></form></section></div>}

      {isDetailOpen && detailTeam && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}><section className="clubs-modal category-detail-modal" role="dialog" aria-modal="true" aria-labelledby="team-detail-title"><div className="clubs-modal-header"><div><span className="eyebrow">Detalle deportivo</span><h2 id="team-detail-title">Información del equipo</h2></div><button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button></div>{isDetailLoading ? <div className="categories-empty"><span className="clubs-loader" /></div> : <><div className="category-detail-hero"><div><span>Temporada {detailTeam.temporada}</span><h3>{detailTeam.nombre}</h3></div><span className={detailTeam.activo ? 'club-status-active' : 'club-status-inactive'}>{detailTeam.activo ? 'Activo' : 'Inactivo'}</span></div><p className="category-detail-description">{detailTeam.descripcion || 'Sin descripción registrada.'}</p><dl className="category-detail-grid"><div><dt>Club</dt><dd>{clubName(detailTeam)}</dd></div><div><dt>Categoría</dt><dd>{detailTeam.categoria}</dd></div><div><dt>Temporada</dt><dd>{detailTeam.temporada}</dd></div><div><dt>Estado</dt><dd>{detailTeam.activo ? 'Activo' : 'Inactivo'}</dd></div></dl><div className="clubs-form-actions category-detail-actions"><button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button><button type="button" className="button-primary" onClick={() => openEditForm(detailTeam)}>Editar</button></div></>}</section></div>}
    </section>
  )
}

export default TeamsPage
