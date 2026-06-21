import { useCallback, useEffect, useState } from 'react'

import api from '../api/axios'

const ROLES = ['COORDINADOR', 'ENTRENADOR', 'PADRE', 'JUGADOR']
const ROLE_PERMISSIONS = {
  COORDINADOR: [
    'Ver dashboard', 'Crear club', 'Editar club', 'Configurar club',
    'Gestionar usuarios', 'Gestionar roles y permisos', 'Gestionar categorías',
    'Gestionar equipos', 'Gestionar jugadores', 'Gestionar eventos',
    'Gestionar convocatorias', 'Ver reportes', 'Gestionar pagos',
  ],
  ENTRENADOR: [
    'Ver dashboard', 'Ver jugadores', 'Ver equipos asignados',
    'Gestionar eventos', 'Gestionar convocatorias', 'Registrar asistencia',
    'Registrar partidos', 'Registrar estadísticas', 'Registrar evolución física',
  ],
  PADRE: [
    'Ver portal del padre', 'Ver hijos vinculados', 'Ver eventos del hijo',
    'Ver convocatorias del hijo', 'Confirmar o rechazar convocatoria',
    'Ver asistencia del hijo', 'Ver evolución física del hijo', 'Ver pagos',
    'Pagar cuotas',
  ],
  JUGADOR: [
    'Ver su perfil', 'Ver eventos', 'Ver convocatorias',
    'Ver estadísticas propias',
  ],
}
const emptyForm = { usuario: '', club: '', rol: '' }
const emptyFilters = { usuario: '', club: '', rol: '', estado: '' }

const roleLabel = (role) => ({
  COORDINADOR: 'Coordinador',
  ENTRENADOR: 'Entrenador',
  PADRE: 'Padre',
  JUGADOR: 'Jugador',
}[role] || role)

const responseList = (data) => Array.isArray(data) ? data : data.results || []

const errorMessage = (error, fallback) => {
  const data = error.response?.data
  if (!data) return fallback
  for (const field of ['usuario', 'club', 'rol', 'detail', 'non_field_errors']) {
    const value = data[field]
    const message = Array.isArray(value) ? value[0] : value
    if (typeof message === 'string') return message
  }
  return fallback
}

function MembershipsPage() {
  const [memberships, setMemberships] = useState([])
  const [users, setUsers] = useState([])
  const [clubs, setClubs] = useState([])
  const [filters, setFilters] = useState(emptyFilters)
  const [form, setForm] = useState(emptyForm)
  const [editingMembership, setEditingMembership] = useState(null)
  const [detailMembership, setDetailMembership] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  const loadMemberships = useCallback(async () => {
    setIsLoading(true)
    setPageError('')
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value),
      )
      const { data } = await api.get('/membresias/', { params })
      setMemberships(responseList(data))
    } catch {
      setPageError('No pudimos cargar las membresías. Intenta nuevamente.')
    } finally {
      setIsLoading(false)
    }
  }, [filters])

  useEffect(() => {
    const request = window.setTimeout(loadMemberships, 0)
    return () => window.clearTimeout(request)
  }, [loadMemberships])

  useEffect(() => {
    let active = true
    Promise.all([api.get('/usuarios/'), api.get('/clubes/')])
      .then(([usersResponse, clubsResponse]) => {
        if (!active) return
        setUsers(responseList(usersResponse.data))
        setClubs(responseList(clubsResponse.data))
      })
      .catch(() => {
        if (active) setPageError('No pudimos cargar los usuarios y clubes disponibles.')
      })
      .finally(() => {
        if (active) setIsCatalogLoading(false)
      })
    return () => { active = false }
  }, [])

  const updateFilter = (field) => (event) => {
    setFilters((current) => ({ ...current, [field]: event.target.value }))
  }

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFormError('')
  }

  const openCreateForm = () => {
    setEditingMembership(null)
    setForm(emptyForm)
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
  }

  const openEditForm = (membership) => {
    setEditingMembership(membership)
    setForm({
      usuario: membership.usuario?.id || '',
      club: membership.club?.id || '',
      rol: membership.rol || '',
    })
    setFormError('')
    setSuccess('')
    setIsDetailOpen(false)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingMembership(null)
    setForm(emptyForm)
    setFormError('')
  }

  const validateForm = () => {
    if (!editingMembership && !form.usuario) return 'El usuario es obligatorio.'
    if (!editingMembership && !form.club) return 'El club es obligatorio.'
    if (!form.rol) return 'El rol es obligatorio.'
    if (!ROLES.includes(form.rol)) return 'Selecciona un rol válido.'
    return ''
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const validationError = validateForm()
    setFormError(validationError)
    if (validationError) return

    const payload = editingMembership
      ? { rol: form.rol }
      : { usuario: form.usuario, club: form.club, rol: form.rol }

    setIsSaving(true)
    try {
      if (editingMembership) {
        await api.patch(`/membresias/${editingMembership.id}/`, payload)
        setSuccess('Rol de la membresía actualizado correctamente.')
      } else {
        await api.post('/membresias/', payload)
        setSuccess('Membresía creada correctamente.')
      }
      setIsFormOpen(false)
      setEditingMembership(null)
      setForm(emptyForm)
      await loadMemberships()
    } catch (error) {
      setFormError(errorMessage(error, 'No se pudo guardar la membresía. Revisa los datos.'))
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = async (membership) => {
    setDetailMembership(membership)
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    setPageError('')
    try {
      const { data } = await api.get(`/membresias/${membership.id}/`)
      setDetailMembership(data)
    } catch {
      setIsDetailOpen(false)
      setPageError('No pudimos cargar el detalle de la membresía.')
    } finally {
      setIsDetailLoading(false)
    }
  }

  const changeStatus = async (membership) => {
    const activate = membership.estado !== 'ACTIVO'
    const action = activate ? 'activar' : 'desactivar'
    if (!activate && !window.confirm('¿Deseas desactivar esta membresía?')) return
    setPendingAction(`status:${membership.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.patch(`/membresias/${membership.id}/${action}/`)
      setSuccess(`Membresía ${activate ? 'activada' : 'desactivada'} correctamente.`)
      await loadMemberships()
    } catch (error) {
      setPageError(errorMessage(error, `No se pudo ${action} la membresía.`))
    } finally {
      setPendingAction('')
    }
  }

  const removeMembership = async (membership) => {
    if (!window.confirm('¿Deseas dar de baja esta membresía? Quedará inactiva.')) return
    setPendingAction(`delete:${membership.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/membresias/${membership.id}/`)
      setSuccess('Membresía dada de baja correctamente.')
      await loadMemberships()
    } catch (error) {
      setPageError(errorMessage(error, 'No se pudo dar de baja la membresía.'))
    } finally {
      setPendingAction('')
    }
  }

  return (
    <section className="page page-fluid categories-page memberships-page">
      <div className="page-header categories-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Roles y permisos</h1>
          <p>Gestiona las membresías, roles y accesos de usuarios por club.</p>
        </div>
        <button type="button" className="button-primary" onClick={openCreateForm} disabled={isCatalogLoading}>
          + Nueva membresía
        </button>
      </div>

      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <section className="role-permissions-section" aria-labelledby="role-permissions-title">
        <div className="role-permissions-heading">
          <div>
            <p className="eyebrow">Matriz informativa</p>
            <h2 id="role-permissions-title">Permisos por rol</h2>
          </div>
          <p>Los roles son predefinidos para mantener seguridad y consistencia. Los permisos muestran qué acciones puede realizar cada rol dentro del sistema.</p>
        </div>
        <div className="role-permissions-grid">
          {ROLES.map((role) => (
            <article className={`role-permission-card permission-${role.toLowerCase()}`} key={role}>
              <div className="role-permission-card-header">
                <span className={`membership-role role-${role.toLowerCase()}`} translate="no">
                  {role === 'PADRE' ? 'PADRE' : roleLabel(role)}
                </span>
                <small>{ROLE_PERMISSIONS[role].length} permisos</small>
              </div>
              <ul>
                {ROLE_PERMISSIONS[role].map((permission) => (
                  <li key={permission}><span aria-hidden="true">✓</span>{permission}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <div className="memberships-section-heading">
        <div>
          <p className="eyebrow">Asignaciones por club</p>
          <h2>Membresías del club</h2>
          <p>Asigna qué rol tiene cada usuario dentro de un club.</p>
        </div>
      </div>

      <div className="memberships-toolbar">
        <label>Usuario<select value={filters.usuario} onChange={updateFilter('usuario')}><option value="">Todos los usuarios</option>{users.map((user) => <option key={user.id} value={user.id}>{user.nombre} {user.apellido} · {user.email}</option>)}</select></label>
        <label>Club<select value={filters.club} onChange={updateFilter('club')}><option value="">Todos los clubes</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label>
        <label>Rol<select value={filters.rol} onChange={updateFilter('rol')}><option value="">Todos los roles</option>{ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
        <label>Estado<select value={filters.estado} onChange={updateFilter('estado')}><option value="">Todos los estados</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></select></label>
        <button type="button" className="button-ghost" onClick={() => setFilters(emptyFilters)}>Limpiar</button>
      </div>

      <section className="categories-list-card">
        <div className="categories-list-heading"><div><h2>Membresías registradas</h2><p>{memberships.length} {memberships.length === 1 ? 'membresía encontrada' : 'membresías encontradas'}</p></div></div>
        {isLoading ? (
          <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando membresías...</strong></div>
        ) : memberships.length === 0 ? (
          <div className="categories-empty"><span className="categories-empty-icon">R</span><strong>No hay membresías en esta vista</strong><p>Crea una membresía o modifica los filtros.</p><button type="button" className="button-primary" onClick={openCreateForm}>Crear membresía</button></div>
        ) : (
          <div className="categories-grid memberships-grid">
            {memberships.map((membership) => {
              const busy = pendingAction.endsWith(`:${membership.id}`)
              const active = membership.estado === 'ACTIVO'
              return (
                <article className="category-card membership-card" key={membership.id}>
                  <div className="category-card-top"><div><span className="category-card-kicker">{membership.club?.nombre || 'Club no disponible'}</span><h3>{membership.usuario?.nombre} {membership.usuario?.apellido}</h3><p className="membership-email">{membership.usuario?.email}</p></div><span className={`membership-status ${active ? 'is-active' : 'is-inactive'}`}>{active ? 'Activo' : 'Inactivo'}</span></div>
                  <div className="membership-role-row"><span>Rol asignado</span><strong className={`membership-role role-${membership.rol?.toLowerCase()}`}>{roleLabel(membership.rol)}</strong></div>
                  <div className="category-actions membership-actions">
                    <button type="button" onClick={() => openDetail(membership)} disabled={busy}>Ver detalle</button>
                    <button type="button" onClick={() => openEditForm(membership)} disabled={busy}>Editar rol</button>
                    <button type="button" className={active ? 'is-warning' : 'is-success'} onClick={() => changeStatus(membership)} disabled={busy}>{pendingAction === `status:${membership.id}` ? 'Procesando...' : active ? 'Desactivar' : 'Activar'}</button>
                    <button type="button" className="is-danger" onClick={() => removeMembership(membership)} disabled={busy || !active}>{pendingAction === `delete:${membership.id}` ? 'Procesando...' : 'Dar de baja'}</button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {isFormOpen && (
        <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <section className="clubs-modal membership-modal" role="dialog" aria-modal="true" aria-labelledby="membership-form-title">
            <div className="clubs-modal-header"><div><span className="eyebrow">{editingMembership ? 'Actualizar acceso' : 'Nuevo acceso'}</span><h2 id="membership-form-title">{editingMembership ? 'Editar rol' : 'Crear membresía'}</h2><p>{editingMembership ? 'Selecciona el nuevo rol de esta membresía.' : 'Asigna un usuario y un rol dentro de un club.'}</p></div><button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button></div>
            <form className="membership-form" onSubmit={submitForm} noValidate>
              {!editingMembership && <label className="clubs-form-group">Usuario <span>*</span><select value={form.usuario} onChange={updateField('usuario')} autoFocus><option value="">Selecciona un usuario</option>{users.map((user) => <option key={user.id} value={user.id}>{user.nombre} {user.apellido} · {user.email}</option>)}</select></label>}
              {!editingMembership && <label className="clubs-form-group">Club <span>*</span><select value={form.club} onChange={updateField('club')}><option value="">Selecciona un club</option>{clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}</select></label>}
              <label className="clubs-form-group">Rol <span>*</span><select value={form.rol} onChange={updateField('rol')} autoFocus={!!editingMembership}><option value="">Selecciona un rol</option>{ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
              {formError && <div className="clubs-alert clubs-alert-error" role="alert">{formError}</div>}
              <div className="clubs-form-actions"><button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? 'Guardando...' : editingMembership ? 'Guardar rol' : 'Crear membresía'}</button></div>
            </form>
          </section>
        </div>
      )}

      {isDetailOpen && detailMembership && (
        <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}>
          <section className="clubs-modal membership-detail-modal" role="dialog" aria-modal="true" aria-labelledby="membership-detail-title">
            <div className="clubs-modal-header"><div><span className="eyebrow">Acceso al club</span><h2 id="membership-detail-title">Detalle de membresía</h2></div><button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button></div>
            {isDetailLoading ? <div className="categories-empty"><span className="clubs-loader" /></div> : <><div className="category-detail-hero membership-detail-hero"><div><span>{detailMembership.club?.nombre}</span><h3>{detailMembership.usuario?.nombre} {detailMembership.usuario?.apellido}</h3><p>{detailMembership.usuario?.email}</p></div><span className={`membership-status ${detailMembership.estado === 'ACTIVO' ? 'is-active' : 'is-inactive'}`}>{detailMembership.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}</span></div><dl className="category-detail-grid membership-detail-grid"><div><dt>Club</dt><dd>{detailMembership.club?.nombre || 'No disponible'}</dd></div><div><dt>Rol</dt><dd><span className={`membership-role role-${detailMembership.rol?.toLowerCase()}`}>{roleLabel(detailMembership.rol)}</span></dd></div><div><dt>Usuario</dt><dd>{detailMembership.usuario?.nombre} {detailMembership.usuario?.apellido}</dd></div><div><dt>Email</dt><dd>{detailMembership.usuario?.email}</dd></div></dl><div className="clubs-form-actions category-detail-actions"><button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button><button type="button" className="button-primary" onClick={() => openEditForm(detailMembership)}>Editar rol</button></div></>}
          </section>
        </div>
      )}
    </section>
  )
}

export default MembershipsPage
