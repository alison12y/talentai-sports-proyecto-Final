import { useEffect, useState } from 'react'

import api from '../api/axios'

const emptyForm = {
  email: '',
  password: '',
  nombre: '',
  apellido: '',
  telefono: '',
  fecha_nacimiento: '',
}

const filterOptions = [
  ['todos', 'Todos'],
  ['activos', 'Activos'],
  ['inactivos', 'Inactivos'],
]

const VALID_ROLES = ['COORDINADOR', 'ENTRENADOR', 'PADRE', 'JUGADOR']

const formatRole = (role) => {
  if (!role) return ''
  const upper = String(role).toUpperCase()
  if (upper === 'PADRE') return 'Padre'
  if (upper === 'COORDINADOR') return 'Coordinador'
  if (upper === 'ENTRENADOR') return 'Entrenador'
  if (upper === 'JUGADOR') return 'Jugador'
  return role.charAt(0) + role.slice(1).toLowerCase()
}

function UsersPage() {
  const [users, setUsers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('todos')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const [form, setForm] = useState(emptyForm)
  const [passwordForm, setPasswordForm] = useState({ password: '' })

  const [selectedUser, setSelectedUser] = useState(null)
  const [userMemberships, setUserMemberships] = useState([])
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  const [isUsersLoading, setIsUsersLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [passwordFormError, setPasswordFormError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isActive = true
    const delayDebounceFn = setTimeout(async () => {
      setIsUsersLoading(true)
      setPageError('')
      try {
        let url = '/usuarios/'
        const params = []
        if (searchTerm.trim()) {
          params.push(`search=${encodeURIComponent(searchTerm.trim())}`)
        }
        if (filter === 'activos') {
          params.push('activo=true')
        } else if (filter === 'inactivos') {
          params.push('activo=false')
        }
        if (params.length > 0) {
          url += `?${params.join('&')}`
        }

        const { data } = await api.get(url)
        if (isActive) {
          setUsers(Array.isArray(data) ? data : data.results || [])
        }
      } catch {
        if (isActive) setPageError('No pudimos cargar los usuarios. Intenta nuevamente.')
      } finally {
        if (isActive) setIsUsersLoading(false)
      }
    }, 300)

    return () => {
      isActive = false
      clearTimeout(delayDebounceFn)
    }
  }, [searchTerm, filter, refreshTrigger])

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFormError('')
  }

  const updatePasswordForm = (event) => {
    setPasswordForm({ password: event.target.value })
    setPasswordFormError('')
  }

  const openCreateForm = () => {
    setSelectedUser(null)
    setForm(emptyForm)
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
  }

  const openEditForm = (user) => {
    setSelectedUser(user)
    setForm({
      email: user.email || '',
      nombre: user.nombre || '',
      apellido: user.apellido || '',
      telefono: user.telefono || '',
      fecha_nacimiento: user.fecha_nacimiento || '',
      password: '', // do not display password
    })
    setFormError('')
    setSuccess('')
    setIsDetailOpen(false)
    setIsFormOpen(true)
  }

  const openPasswordModal = (user) => {
    setSelectedUser(user)
    setPasswordForm({ password: '' })
    setPasswordFormError('')
    setSuccess('')
    setIsDetailOpen(false)
    setIsPasswordModalOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setSelectedUser(null)
    setForm(emptyForm)
    setFormError('')
  }

  const closePasswordModal = () => {
    if (isSavingPassword) return
    setIsPasswordModalOpen(false)
    setSelectedUser(null)
    setPasswordForm({ password: '' })
    setPasswordFormError('')
  }

  const validateForm = () => {
    const cleanEmail = form.email.trim()
    if (!cleanEmail) return 'El correo electrónico es obligatorio.'
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailPattern.test(cleanEmail)) return 'Ingresa un correo electrónico con formato válido.'
    if (!form.nombre.trim()) return 'El nombre es obligatorio.'
    if (!form.apellido.trim()) return 'El apellido es obligatorio.'

    if (!selectedUser) {
      if (!form.password) return 'La contraseña es obligatoria al crear un usuario.'
      if (form.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    }
    return ''
  }

  const validatePasswordForm = () => {
    if (!passwordForm.password) return 'La contraseña es obligatoria.'
    if (passwordForm.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
    return ''
  }

  const resolveFormError = (requestError) => {
    const data = requestError.response?.data
    if (!data) return 'No se pudo guardar. Revisa la conexión e intenta nuevamente.'
    for (const field of ['email', 'password', 'nombre', 'apellido', 'telefono', 'fecha_nacimiento', 'detail', 'non_field_errors']) {
      const value = data[field]
      const message = Array.isArray(value) ? value[0] : value
      if (typeof message === 'string') return message
    }
    return 'No se pudo procesar la solicitud. Revisa los datos ingresados.'
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setFormError('')
    const validationError = validateForm()
    if (validationError) return setFormError(validationError)

    const payload = {
      email: form.email.trim(),
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      telefono: form.telefono.trim() || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
    }

    if (!selectedUser) {
      payload.password = form.password
    }

    setIsSaving(true)
    try {
      if (selectedUser) {
        await api.patch(`/usuarios/${selectedUser.id}/`, payload)
        setSuccess('Usuario actualizado correctamente')
      } else {
        await api.post('/usuarios/', payload)
        setSuccess('Usuario creado correctamente')
      }
      setIsFormOpen(false)
      setSelectedUser(null)
      setForm(emptyForm)
      triggerRefresh()
    } catch (requestError) {
      setFormError(resolveFormError(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  const submitPasswordForm = async (event) => {
    event.preventDefault()
    setPasswordFormError('')
    const validationError = validatePasswordForm()
    if (validationError) return setPasswordFormError(validationError)

    const payload = {
      password: passwordForm.password,
    }

    setIsSavingPassword(true)
    try {
      await api.patch(`/usuarios/${selectedUser.id}/cambiar-password/`, payload)
      setSuccess('Contraseña actualizada correctamente')
      setIsPasswordModalOpen(false)
      setSelectedUser(null)
      setPasswordForm({ password: '' })
    } catch (requestError) {
      setPasswordFormError(resolveFormError(requestError))
    } finally {
      setIsSavingPassword(false)
    }
  }

  const openDetail = async (user) => {
    setSelectedUser(user)
    setUserMemberships([])
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    setPageError('')
    try {
      const [userResponse, membershipsResponse] = await Promise.all([
        api.get(`/usuarios/${user.id}/`),
        api.get('/membresias/', { params: { usuario: user.id } }),
      ])
      // Ensure sensitve data is never shown
      const cleanData = { ...userResponse.data }
      delete cleanData.password_hash
      delete cleanData.firebase_token
      setSelectedUser(cleanData)
      const memberships = Array.isArray(membershipsResponse.data)
        ? membershipsResponse.data
        : membershipsResponse.data.results || []
      setUserMemberships(memberships.filter((membership) => (
        VALID_ROLES.includes(membership.rol)
        && ['ACTIVO', 'INACTIVO'].includes(membership.estado)
      )))
    } catch {
      setPageError('No pudimos cargar el detalle del usuario.')
      setIsDetailOpen(false)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const changeStatus = async (user) => {
    const action = user.activo ? 'desactivar' : 'activar'
    if (user.activo && !window.confirm('¿Deseas desactivar este usuario?')) return
    setPendingAction(`status:${user.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.patch(`/usuarios/${user.id}/${action}/`)
      setSuccess(`Usuario ${user.activo ? 'desactivado' : 'activado'} correctamente`)
      triggerRefresh()
    } catch {
      setPageError(`No se pudo ${action} al usuario. Intenta nuevamente.`)
    } finally {
      setPendingAction('')
    }
  }

  const deleteUser = async (user) => {
    if (!window.confirm('¿Deseas eliminar este usuario de forma permanente?')) return
    setPendingAction(`delete:${user.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/usuarios/${user.id}/`)
      setSuccess('Usuario eliminado correctamente')
      triggerRefresh()
    } catch (requestError) {
      const message = requestError.response?.data?.detail
      setPageError(message || 'No se pudo eliminar al usuario. Intenta nuevamente.')
    } finally {
      setPendingAction('')
    }
  }

  return (
    <section className="page page-fluid users-page">
      <div className="page-header users-header">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Gestión de usuarios</h1>
          <p>Administra los accesos y datos personales de los usuarios del sistema.</p>
        </div>
        <button type="button" className="button-primary" onClick={openCreateForm}>
          + Nuevo usuario
        </button>
      </div>

      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="users-toolbar">
        <label className="users-search-label">
          Buscar
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="users-search-input"
          />
        </label>
        <div className="users-filter" aria-label="Filtrar usuarios">
          {filterOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={filter === value ? 'is-active' : ''}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="users-list-card">
        <div className="users-list-heading">
          <div>
            <h2>Usuarios registrados</h2>
            <p>{users.length} {users.length === 1 ? 'usuario encontrado' : 'usuarios encontrados'}</p>
          </div>
        </div>

        {isUsersLoading ? (
          <div className="users-empty">
            <span className="clubs-loader" />
            <strong>Cargando usuarios...</strong>
          </div>
        ) : users.length === 0 ? (
          <div className="users-empty">
            <span className="users-empty-icon">U</span>
            <strong>No hay usuarios en esta vista</strong>
            <p>Registra un nuevo usuario o modifica los filtros de búsqueda.</p>
            <button type="button" className="button-primary" onClick={openCreateForm}>
              Crear usuario
            </button>
          </div>
        ) : (
          <div className="users-grid">
            {users.map((user) => {
              const busy = pendingAction.endsWith(`:${user.id}`)
              return (
                <article className="user-card" key={user.id}>
                  <div className="user-card-top">
                    <div>
                      <span className="user-card-kicker">{user.email}</span>
                      <h3>{user.nombre} {user.apellido}</h3>
                    </div>
                    <span className={user.activo ? 'club-status-active' : 'club-status-inactive'}>
                      {user.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="user-card-meta">
                    <span>Teléfono: <strong>{user.telefono || '—'}</strong></span>
                    <span>Nacimiento: <strong>{user.fecha_nacimiento || '—'}</strong></span>
                  </div>
                  <div className="user-actions">
                    <button type="button" onClick={() => openDetail(user)} disabled={busy}>
                      Ver
                    </button>
                    <button type="button" onClick={() => openEditForm(user)} disabled={busy}>
                      Editar
                    </button>
                    <button type="button" onClick={() => openPasswordModal(user)} disabled={busy}>
                      Contraseña
                    </button>
                    <button
                      type="button"
                      className={user.activo ? 'is-warning' : 'is-success'}
                      onClick={() => changeStatus(user)}
                      disabled={busy}
                    >
                      {pendingAction === `status:${user.id}`
                        ? 'Procesando...'
                        : user.activo
                          ? 'Desactivar'
                          : 'Activar'}
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => deleteUser(user)}
                      disabled={busy}
                    >
                      {pendingAction === `delete:${user.id}` ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* Modal Creación / Edición */}
      {isFormOpen && (
        <div
          className="clubs-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeForm()
          }}
        >
          <section
            className="clubs-modal user-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-form-title"
          >
            <div className="clubs-modal-header">
              <div>
                <span className="eyebrow">{selectedUser ? 'Actualizar usuario' : 'Nuevo registro'}</span>
                <h2 id="user-form-title">{selectedUser ? 'Editar usuario' : 'Crear usuario'}</h2>
                <p>Completa los datos de la cuenta de usuario.</p>
              </div>
              <button
                type="button"
                className="clubs-modal-close"
                onClick={closeForm}
                aria-label="Cerrar formulario"
              >
                ×
              </button>
            </div>

            <form className="user-form" onSubmit={submitForm} noValidate>
              <label className="clubs-form-group">
                Nombres <span>*</span>
                <input
                  value={form.nombre}
                  onChange={updateField('nombre')}
                  placeholder="Ej. Juan"
                  autoFocus
                />
              </label>

              <label className="clubs-form-group">
                Apellidos <span>*</span>
                <input
                  value={form.apellido}
                  onChange={updateField('apellido')}
                  placeholder="Ej. Pérez"
                />
              </label>

              <label className="clubs-form-group">
                Correo electrónico <span>*</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={updateField('email')}
                  placeholder="ejemplo@correo.com"
                />
              </label>

              {!selectedUser && (
                <label className="clubs-form-group">
                  Contraseña <span>*</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={updateField('password')}
                    placeholder="Mínimo 6 caracteres"
                  />
                </label>
              )}

              <label className="clubs-form-group">
                Teléfono <small>(opcional)</small>
                <input
                  value={form.telefono}
                  onChange={updateField('telefono')}
                  placeholder="Ej. 70000000"
                />
              </label>

              <label className="clubs-form-group">
                Fecha de nacimiento <small>(opcional)</small>
                <input
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={updateField('fecha_nacimiento')}
                />
              </label>

              {formError && (
                <div className="clubs-alert clubs-alert-error user-field-full" role="alert">
                  {formError}
                </div>
              )}

              <div className="clubs-form-actions user-field-full">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={closeForm}
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button type="submit" className="button-primary" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : 'Guardar usuario'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Cambio de Contraseña */}
      {isPasswordModalOpen && selectedUser && (
        <div
          className="clubs-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePasswordModal()
          }}
        >
          <section
            className="clubs-modal user-password-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-password-title"
          >
            <div className="clubs-modal-header">
              <div>
                <span className="eyebrow">Seguridad de la cuenta</span>
                <h2 id="user-password-title">Cambiar contraseña</h2>
                <p>Establece una nueva contraseña para {selectedUser.nombre} {selectedUser.apellido}.</p>
              </div>
              <button
                type="button"
                className="clubs-modal-close"
                onClick={closePasswordModal}
                aria-label="Cerrar modal"
              >
                ×
              </button>
            </div>

            <form className="user-form" onSubmit={submitPasswordForm} noValidate>
              <label className="clubs-form-group user-field-full">
                Nueva contraseña <span>*</span>
                <input
                  type="password"
                  value={passwordForm.password}
                  onChange={updatePasswordForm}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                />
              </label>

              {passwordFormError && (
                <div className="clubs-alert clubs-alert-error user-field-full" role="alert">
                  {passwordFormError}
                </div>
              )}

              <div className="clubs-form-actions user-field-full">
                <button
                  type="button"
                  className="button-ghost"
                  onClick={closePasswordModal}
                  disabled={isSavingPassword}
                >
                  Cancelar
                </button>
                <button type="submit" className="button-primary" disabled={isSavingPassword}>
                  {isSavingPassword ? 'Cambiando...' : 'Actualizar contraseña'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal Detalle */}
      {isDetailOpen && selectedUser && (
        <div
          className="clubs-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsDetailOpen(false)
          }}
        >
          <section
            className="clubs-modal user-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-detail-title"
          >
            <div className="clubs-modal-header">
              <div>
                <span className="eyebrow">Ficha de usuario</span>
                <h2 id="user-detail-title">Información del usuario</h2>
              </div>
              <button
                type="button"
                className="clubs-modal-close"
                onClick={() => setIsDetailOpen(false)}
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </div>

            {isDetailLoading ? (
              <div className="users-empty">
                <span className="clubs-loader" />
              </div>
            ) : (
              <>
                <div className="user-detail-hero">
                  <div>
                    <span>{selectedUser.email}</span>
                    <h3>{selectedUser.nombre} {selectedUser.apellido}</h3>
                  </div>
                  <span className={selectedUser.activo ? 'club-status-active' : 'club-status-inactive'}>
                    {selectedUser.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <dl className="user-detail-grid">
                  <div>
                    <dt>Nombres</dt>
                    <dd>{selectedUser.nombre}</dd>
                  </div>
                  <div>
                    <dt>Apellidos</dt>
                    <dd>{selectedUser.apellido}</dd>
                  </div>
                  <div>
                    <dt>Correo electrónico</dt>
                    <dd>{selectedUser.email}</dd>
                  </div>
                  <div>
                    <dt>Teléfono</dt>
                    <dd>{selectedUser.telefono || 'No registrado'}</dd>
                  </div>
                  <div>
                    <dt>Fecha de nacimiento</dt>
                    <dd>{selectedUser.fecha_nacimiento || 'No registrada'}</dd>
                  </div>
                  <div>
                    <dt>Estado</dt>
                    <dd>{selectedUser.activo ? 'Activo' : 'Inactivo'}</dd>
                  </div>
                </dl>

                <div className="user-detail-roles-section">
                  <h4>Roles y permisos</h4>
                  {userMemberships.length === 0 ? (
                    <div className="user-detail-no-roles">
                      <strong>Sin membresías asignadas</strong>
                    </div>
                  ) : (
                    <div className="user-detail-roles-grid">
                      {userMemberships.map((membership) => (
                        <div key={membership.id} className="user-membership-card">
                          <strong>{membership.club?.nombre || 'Club no disponible'}</strong>
                          <span>Rol: {formatRole(membership.rol)}</span>
                          <span className={membership.estado === 'ACTIVO' ? 'club-status-active' : 'club-status-inactive'}>
                            {membership.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="clubs-form-actions user-detail-actions">
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => setIsDetailOpen(false)}
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => openEditForm(selectedUser)}
                  >
                    Editar
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </section>
  )
}

export default UsersPage
