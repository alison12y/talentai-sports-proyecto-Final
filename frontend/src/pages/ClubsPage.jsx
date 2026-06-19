import { useEffect, useState } from 'react'

import api from '../api/axios'

const emptyForm = { nombre: '', direccion: '', telefono: '', email_contacto: '', colores: '', logo_url: '' }
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const imagePathPattern = /\.(jpe?g|png|gif|webp|svg|avif)$/i

const isValidLogoUrl = (value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) && imagePathPattern.test(url.pathname)
  } catch {
    return false
  }
}

function ClubLogo({ club, large = false }) {
  const [imageFailed, setImageFailed] = useState(false)
  const initials = club.nombre?.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'TS'

  if (club.logo_url && !imageFailed) {
    return <img className={`club-logo ${large ? 'club-logo-large' : ''}`} src={club.logo_url} alt={`Logo de ${club.nombre}`} onError={() => setImageFailed(true)} />
  }
  return <span className={`club-logo club-logo-fallback ${large ? 'club-logo-large' : ''}`}>{initials}</span>
}

function ClubsPage() {
  const [clubs, setClubs] = useState([])
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState(emptyForm)
  const [configForm, setConfigForm] = useState(emptyForm)
  const [editingClub, setEditingClub] = useState(null)
  const [configuringClub, setConfiguringClub] = useState(null)
  const [detailClub, setDetailClub] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isConfigSaving, setIsConfigSaving] = useState(false)
  const [configLogoFailed, setConfigLogoFailed] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [formError, setFormError] = useState('')
  const [configError, setConfigError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isActive = true
    api.get('/clubes/')
      .then(({ data }) => { if (isActive) setClubs(Array.isArray(data) ? data : data.results || []) })
      .catch(() => { if (isActive) setPageError('No pudimos cargar los clubes. Intenta nuevamente.') })
      .finally(() => { if (isActive) setIsLoading(false) })
    return () => { isActive = false }
  }, [])

  const activeCount = clubs.filter((club) => club.activo).length
  const inactiveCount = clubs.length - activeCount
  const filteredClubs = clubs.filter((club) => filter === 'all' || (filter === 'active' ? club.activo : !club.activo))
  const updateField = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const updateConfigField = (field) => (event) => {
    const value = event.target.value
    setConfigForm((current) => ({ ...current, [field]: value }))
    if (field === 'logo_url') setConfigLogoFailed(false)
  }

  const openCreateForm = () => {
    setEditingClub(null); setForm(emptyForm); setFormError(''); setSuccess(''); setIsFormOpen(true)
  }

  const openEditForm = (club) => {
    setEditingClub(club)
    setForm({
      nombre: club.nombre || '', direccion: club.direccion || '', telefono: club.telefono || '',
      email_contacto: club.email_contacto || '', colores: club.colores || '', logo_url: club.logo_url || '',
    })
    setIsDetailOpen(false); setFormError(''); setSuccess(''); setIsFormOpen(true)
  }

  const openConfigForm = (club) => {
    setConfiguringClub(club)
    setConfigForm({
      nombre: club.nombre || '', direccion: club.direccion || '', telefono: club.telefono || '',
      email_contacto: club.email_contacto || '', colores: club.colores || '', logo_url: club.logo_url || '',
    })
    setConfigLogoFailed(false); setConfigError(''); setSuccess(''); setIsDetailOpen(false); setIsConfigOpen(true)
  }

  const closeConfigForm = () => {
    if (isConfigSaving) return
    setIsConfigOpen(false); setConfiguringClub(null); setConfigForm(emptyForm); setConfigError(''); setConfigLogoFailed(false)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false); setEditingClub(null); setForm(emptyForm); setFormError('')
  }

  const openDetail = async (club) => {
    setDetailClub(club); setDetailError(''); setIsDetailOpen(true); setIsDetailLoading(true)
    try {
      const { data } = await api.get(`/clubes/${club.id}/`)
      setDetailClub(data)
    } catch {
      setDetailError('No pudimos cargar el detalle del club.')
    } finally {
      setIsDetailLoading(false)
    }
  }

  const validateForm = () => {
    if (!form.nombre.trim()) return 'El nombre del club es obligatorio'
    if (!form.email_contacto.trim()) return 'El correo de contacto es obligatorio'
    if (!emailPattern.test(form.email_contacto.trim())) return 'Ingrese un correo válido'
    return ''
  }

  const resolveApiError = (requestError) => {
    const nameError = requestError.response?.data?.nombre
    const message = Array.isArray(nameError) ? nameError[0] : nameError
    if (typeof message === 'string' && message.toLowerCase().includes('existe')) return 'Ya existe un club registrado con ese nombre'
    return editingClub ? 'No se pudo actualizar el club. Revisa los datos e intenta nuevamente.' : 'No se pudo registrar el club. Revisa los datos e intenta nuevamente.'
  }

  const handleSubmit = async (event) => {
    event.preventDefault(); setFormError('')
    const validationError = validateForm()
    if (validationError) return setFormError(validationError)
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim()]))
    payload.email_contacto = payload.email_contacto.toLowerCase()

    setIsSaving(true)
    try {
      const { data } = editingClub ? await api.patch(`/clubes/${editingClub.id}/`, payload) : await api.post('/clubes/', payload)
      setClubs((current) => editingClub ? current.map((club) => club.id === data.id ? data : club) : [data, ...current])
      setSuccess(editingClub ? 'Club actualizado correctamente' : 'Club registrado correctamente')
      setIsFormOpen(false); setEditingClub(null); setForm(emptyForm)
    } catch (requestError) {
      setFormError(resolveApiError(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  const validateConfigForm = () => {
    if (!configForm.nombre.trim()) return 'El nombre del club es obligatorio'
    if (!configForm.email_contacto.trim()) return 'El correo de contacto es obligatorio'
    if (!emailPattern.test(configForm.email_contacto.trim())) return 'Ingrese un correo válido'
    if (configForm.logo_url.trim() && !isValidLogoUrl(configForm.logo_url.trim())) return 'Ingrese una URL válida para el logotipo'
    if (configForm.logo_url.trim() && configLogoFailed) return 'No se pudo previsualizar el logotipo'
    return ''
  }

  const handleConfigSubmit = async (event) => {
    event.preventDefault(); setConfigError('')
    const validationError = validateConfigForm()
    if (validationError) return setConfigError(validationError)

    const payload = Object.fromEntries(Object.entries(configForm).map(([key, value]) => [key, value.trim()]))
    payload.email_contacto = payload.email_contacto.toLowerCase()
    setIsConfigSaving(true)
    try {
      const { data } = await api.patch(`/clubes/${configuringClub.id}/configurar/`, payload)
      setClubs((current) => current.map((club) => club.id === data.id ? data : club))
      setSuccess('Configuración del club actualizada correctamente')
      setIsConfigOpen(false); setConfiguringClub(null); setConfigForm(emptyForm); setConfigLogoFailed(false)
    } catch (requestError) {
      const response = requestError.response?.data
      const fieldError = response?.nombre || response?.email_contacto || response?.logo_url
      const message = Array.isArray(fieldError) ? fieldError[0] : fieldError
      setConfigError(message || 'No se pudo actualizar la configuración del club. Revisa los datos e intenta nuevamente.')
    } finally {
      setIsConfigSaving(false)
    }
  }

  const changeStatus = async (club) => {
    if (club.activo && !window.confirm('¿Deseas desactivar este club? El club no será eliminado, solo quedará inactivo.')) return
    const action = club.activo ? 'desactivar' : 'activar'
    setPendingAction(`${action}:${club.id}`); setPageError(''); setSuccess('')
    try {
      const { data } = await api.patch(`/clubes/${club.id}/${action}/`)
      setClubs((current) => current.map((item) => item.id === club.id ? data.club : item))
      setSuccess(club.activo ? 'Club desactivado correctamente' : 'Club activado correctamente')
    } catch {
      setPageError(`No se pudo ${action} el club. Intenta nuevamente.`)
    } finally {
      setPendingAction('')
    }
  }

  const deleteClub = async (club) => {
    if (!window.confirm('Esta acción eliminará el club. ¿Deseas continuar?')) return
    setPendingAction(`delete:${club.id}`); setPageError(''); setSuccess('')
    try {
      await api.delete(`/clubes/${club.id}/`)
      setClubs((current) => current.filter((item) => item.id !== club.id))
      setSuccess('Club eliminado correctamente')
    } catch (requestError) {
      setPageError(requestError.response?.data?.detail || 'No se pudo eliminar el club. Intenta nuevamente.')
    } finally {
      setPendingAction('')
    }
  }

  const formatDate = (value) => value ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' }).format(new Date(value)) : 'No disponible'

  return (
    <section className="page page-fluid clubs-page">
      <div className="page-header clubs-page-header"><div><p className="eyebrow">Administración</p><h1>Gestión de clubes</h1><p>Registra y administra los clubes deportivos dentro de TalentAI Sports.</p></div><button type="button" className="button-primary clubs-new-button" onClick={openCreateForm}>+ Nuevo club</button></div>
      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="clubs-stats"><div><span>Total</span><strong>{clubs.length}</strong></div><div><span>Activos</span><strong>{activeCount}</strong></div><div><span>Inactivos</span><strong>{inactiveCount}</strong></div></div>

      <div className="clubs-table-shell">
        <div className="clubs-table-heading"><div><h2>Clubes registrados</h2><p>Consulta y actualiza la información de cada organización.</p></div><div className="clubs-filters" aria-label="Filtrar clubes">{[['all', 'Todos'], ['active', 'Activos'], ['inactive', 'Inactivos']].map(([value, label]) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div></div>

        {isLoading ? <div className="clubs-empty"><span className="clubs-loader" /><strong>Cargando clubes...</strong></div> : filteredClubs.length === 0 ? <div className="clubs-empty"><span className="clubs-empty-mark">TS</span><strong>No hay clubes en esta vista</strong><p>{clubs.length ? 'Prueba con otro filtro.' : 'Crea el primero para comenzar a organizar tu plataforma.'}</p>{!clubs.length && <button type="button" className="button-primary" onClick={openCreateForm}>Registrar primer club</button>}</div> : (
          <div className="clubs-table-responsive"><table className="clubs-table"><thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Dirección</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filteredClubs.map((club) => {
            const statusBusy = pendingAction.endsWith(`:${club.id}`)
            return <tr key={club.id}><td data-label="Nombre"><div className="club-identity"><ClubLogo key={`${club.id}:${club.logo_url}`} club={club} /><strong>{club.nombre}</strong></div></td><td data-label="Correo">{club.email_contacto || '—'}</td><td data-label="Teléfono">{club.telefono || '—'}</td><td data-label="Dirección">{club.direccion || '—'}</td><td data-label="Estado"><span className={club.activo ? 'club-status-active' : 'club-status-inactive'}>{club.activo ? 'Activo' : 'Inactivo'}</span></td><td data-label="Acciones"><div className="clubs-actions"><button type="button" className="club-action-view" onClick={() => openDetail(club)} disabled={statusBusy}>Ver</button><button type="button" className="club-action-edit" onClick={() => openEditForm(club)} disabled={statusBusy}>Editar</button><button type="button" className={club.activo ? 'club-action-disable' : 'club-action-enable'} onClick={() => changeStatus(club)} disabled={statusBusy}>{pendingAction === `${club.activo ? 'desactivar' : 'activar'}:${club.id}` ? 'Procesando...' : club.activo ? 'Desactivar' : 'Activar'}</button><button type="button" className="club-action-delete" onClick={() => deleteClub(club)} disabled={statusBusy}>{pendingAction === `delete:${club.id}` ? 'Eliminando...' : 'Eliminar'}</button></div></td></tr>
          })}</tbody></table></div>
        )}
      </div>

      {isFormOpen && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="clubs-modal" role="dialog" aria-modal="true" aria-labelledby="club-form-title"><div className="clubs-modal-header"><div><span className="eyebrow">{editingClub ? 'Actualizar información' : 'Nueva organización'}</span><h2 id="club-form-title">{editingClub ? 'Editar club' : 'Registrar club'}</h2><p>Completa los datos institucionales y de contacto.</p></div><button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button></div><form className="clubs-form" onSubmit={handleSubmit} noValidate><label className="clubs-form-group clubs-field-full">Nombre del club <span>*</span><input value={form.nombre} onChange={updateField('nombre')} placeholder="Ej. Academia Oriente" autoFocus /></label><label className="clubs-form-group clubs-field-full">Dirección<input value={form.direccion} onChange={updateField('direccion')} placeholder="Av. Principal 123" /></label><label className="clubs-form-group">Teléfono<input type="tel" value={form.telefono} onChange={updateField('telefono')} placeholder="+591 70000000" /></label><label className="clubs-form-group">Correo de contacto <span>*</span><input type="email" value={form.email_contacto} onChange={updateField('email_contacto')} placeholder="contacto@club.com" /></label><label className="clubs-form-group">Colores institucionales <small>(opcional)</small><input value={form.colores} onChange={updateField('colores')} placeholder="Azul y blanco" /></label><label className="clubs-form-group">URL del logotipo <small>(opcional)</small><input type="url" value={form.logo_url} onChange={updateField('logo_url')} placeholder="https://..." /></label>{formError && <div className="clubs-alert clubs-alert-error clubs-field-full" role="alert">{formError}</div>}<div className="clubs-form-actions clubs-field-full"><button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? 'Guardando...' : editingClub ? 'Guardar cambios' : 'Guardar club'}</button></div></form></section></div>}

      {isConfigOpen && configuringClub && (
        <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfigForm() }}>
          <section className="clubs-modal club-config-modal" role="dialog" aria-modal="true" aria-labelledby="club-config-title">
            <div className="clubs-modal-header"><div><span className="eyebrow">Identidad institucional</span><h2 id="club-config-title">Configurar club</h2><p>Actualiza la identidad institucional y los datos principales del club.</p></div><button type="button" className="clubs-modal-close" onClick={closeConfigForm} aria-label="Cerrar configuración">×</button></div>
            <div className="club-config-preview">
              {configForm.logo_url && isValidLogoUrl(configForm.logo_url) && !configLogoFailed ? <img src={configForm.logo_url} alt={`Vista previa de ${configForm.nombre || configuringClub.nombre}`} onError={() => setConfigLogoFailed(true)} /> : <ClubLogo club={{ ...configuringClub, nombre: configForm.nombre || configuringClub.nombre, logo_url: '' }} large />}
              <div><span className="club-config-preview-label">Vista previa</span><h3>{configForm.nombre || 'Nombre del club'}</h3><div className="club-config-preview-meta"><span className={configuringClub.activo ? 'club-status-active' : 'club-status-inactive'}>{configuringClub.activo ? 'Activo' : 'Inactivo'}</span>{configForm.colores && <span className="club-config-colors">{configForm.colores}</span>}</div></div>
            </div>
            {configLogoFailed && <p className="club-logo-preview-warning">No se pudo previsualizar el logotipo</p>}
            <form className="clubs-form club-config-form" onSubmit={handleConfigSubmit} noValidate>
              <label className="clubs-form-group clubs-field-full">Nombre del club <span>*</span><input value={configForm.nombre} onChange={updateConfigField('nombre')} autoFocus /></label>
              <label className="clubs-form-group clubs-field-full">Dirección<input value={configForm.direccion} onChange={updateConfigField('direccion')} placeholder="Av. Principal 123" /></label>
              <label className="clubs-form-group">Teléfono<input type="tel" value={configForm.telefono} onChange={updateConfigField('telefono')} placeholder="+591 70000000" /></label>
              <label className="clubs-form-group">Correo de contacto <span>*</span><input type="email" value={configForm.email_contacto} onChange={updateConfigField('email_contacto')} placeholder="contacto@club.com" /></label>
              <label className="clubs-form-group">Colores institucionales <small>(opcional)</small><input value={configForm.colores} onChange={updateConfigField('colores')} placeholder="Azul y blanco" /></label>
              <label className="clubs-form-group">URL del logotipo <small>(opcional)</small><input type="url" value={configForm.logo_url} onChange={updateConfigField('logo_url')} placeholder="https://sitio.com/logo.png" /></label>
              {configError && <div className="clubs-alert clubs-alert-error clubs-field-full" role="alert">{configError}</div>}
              <div className="clubs-form-actions clubs-field-full"><button type="button" className="button-ghost" onClick={closeConfigForm} disabled={isConfigSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isConfigSaving}>{isConfigSaving ? 'Guardando...' : 'Guardar configuración'}</button></div>
            </form>
          </section>
        </div>
      )}

      {isDetailOpen && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}><section className="clubs-modal clubs-detail-modal" role="dialog" aria-modal="true" aria-labelledby="club-detail-title"><div className="clubs-modal-header"><div><span className="eyebrow">Detalle institucional</span><h2 id="club-detail-title">Información del club</h2></div><button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button></div>{isDetailLoading ? <div className="clubs-empty"><span className="clubs-loader" /><strong>Cargando detalle...</strong></div> : detailError ? <div className="clubs-alert clubs-alert-error">{detailError}</div> : detailClub && <><div className="club-detail-hero"><ClubLogo key={`${detailClub.id}:${detailClub.logo_url}`} club={detailClub} large /><div><h3>{detailClub.nombre}</h3><span className={detailClub.activo ? 'club-status-active' : 'club-status-inactive'}>{detailClub.activo ? 'Activo' : 'Inactivo'}</span></div></div><dl className="club-detail-grid"><div><dt>Correo</dt><dd>{detailClub.email_contacto || 'No registrado'}</dd></div><div><dt>Teléfono</dt><dd>{detailClub.telefono || 'No registrado'}</dd></div><div><dt>Dirección</dt><dd>{detailClub.direccion || 'No registrada'}</dd></div><div><dt>Colores institucionales</dt><dd>{detailClub.colores || 'No registrados'}</dd></div><div><dt>Slug</dt><dd>{detailClub.slug || '—'}</dd></div><div><dt>Fecha de creación</dt><dd>{formatDate(detailClub.creado_en)}</dd></div></dl><div className="clubs-form-actions club-detail-actions"><button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button><button type="button" className="button-secondary club-config-button" onClick={() => openConfigForm(detailClub)}>Configurar club</button><button type="button" className="button-primary" onClick={() => openEditForm(detailClub)}>Editar</button></div></>}</section></div>}
    </section>
  )
}

export default ClubsPage
