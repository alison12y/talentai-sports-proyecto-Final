import { useEffect, useState } from 'react'

import api from '../api/axios'

const emptyForm = {
  nombre: '',
  descripcion: '',
  edad_minima: '',
  edad_maxima: '',
}

const filterOptions = [
  ['todas', 'Todas'],
  ['activas', 'Activas'],
  ['inactivas', 'Inactivas'],
]

function CategoriesPage() {
  const [clubs, setClubs] = useState([])
  const [selectedClubId, setSelectedClubId] = useState('')
  const [categories, setCategories] = useState([])
  const [predefined, setPredefined] = useState([])
  const [filter, setFilter] = useState('todas')
  const [form, setForm] = useState(emptyForm)
  const [editingCategory, setEditingCategory] = useState(null)
  const [detailCategory, setDetailCategory] = useState(null)
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
    Promise.all([
      api.get('/clubes/'),
      api.get('/categorias/predefinidas/'),
    ])
      .then(async ([clubsResponse, predefinedResponse]) => {
        if (!isActive) return
        const loadedClubs = Array.isArray(clubsResponse.data) ? clubsResponse.data : clubsResponse.data.results || []
        const loadedPredefined = Array.isArray(predefinedResponse.data) ? predefinedResponse.data : []
        setClubs(loadedClubs)
        setPredefined(loadedPredefined)
        if (loadedClubs.length) {
          const firstClubId = String(loadedClubs[0].id)
          setSelectedClubId(firstClubId)
          const { data } = await api.get(`/clubes/${firstClubId}/categorias/?estado=todas`)
          if (isActive) setCategories(Array.isArray(data) ? data : data.results || [])
        }
      })
      .catch(() => { if (isActive) setPageError('No pudimos cargar la gestión de categorías. Intenta nuevamente.') })
      .finally(() => { if (isActive) setIsPageLoading(false) })
    return () => { isActive = false }
  }, [])

  const selectedClub = clubs.find((club) => String(club.id) === selectedClubId)
  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFormError('')
  }

  const loadCategories = async (clubId = selectedClubId, estado = filter) => {
    if (!clubId) return
    setIsCategoriesLoading(true)
    setPageError('')
    try {
      const { data } = await api.get(`/clubes/${clubId}/categorias/?estado=${estado}`)
      setCategories(Array.isArray(data) ? data : data.results || [])
    } catch {
      setPageError('No pudimos cargar las categorías del club.')
    } finally {
      setIsCategoriesLoading(false)
    }
  }

  const changeClub = (event) => {
    const clubId = event.target.value
    setSelectedClubId(clubId)
    setSuccess('')
    loadCategories(clubId, filter)
  }

  const changeFilter = (estado) => {
    setFilter(estado)
    loadCategories(selectedClubId, estado)
  }

  const openCreateForm = (name = '') => {
    if (!selectedClubId) return setPageError('Selecciona un club para crear categorías.')
    setEditingCategory(null)
    setForm({ ...emptyForm, nombre: name })
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
  }

  const openEditForm = (category) => {
    setEditingCategory(category)
    setForm({
      nombre: category.nombre || '',
      descripcion: category.descripcion || '',
      edad_minima: category.edad_minima ?? '',
      edad_maxima: category.edad_maxima ?? '',
    })
    setFormError('')
    setSuccess('')
    setIsDetailOpen(false)
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingCategory(null)
    setForm(emptyForm)
    setFormError('')
  }

  const validateForm = () => {
    if (!form.nombre.trim()) return 'El nombre de la categoría es obligatorio'
    const minAge = form.edad_minima === '' ? null : Number(form.edad_minima)
    const maxAge = form.edad_maxima === '' ? null : Number(form.edad_maxima)
    if (minAge !== null && minAge < 0) return 'La edad mínima no puede ser negativa'
    if (maxAge !== null && maxAge < 0) return 'La edad máxima no puede ser negativa'
    if (minAge !== null && maxAge !== null && minAge > maxAge) return 'La edad mínima no puede ser mayor que la edad máxima'
    return ''
  }

  const resolveFormError = (requestError) => {
    const nameError = requestError.response?.data?.nombre
    const message = Array.isArray(nameError) ? nameError[0] : nameError
    if (typeof message === 'string' && message.toLowerCase().includes('existe')) return 'Ya existe una categoría con ese nombre en este club'
    return message || 'No se pudo guardar la categoría. Revisa los datos e intenta nuevamente.'
  }

  const submitForm = async (event) => {
    event.preventDefault()
    setFormError('')
    const validationError = validateForm()
    if (validationError) return setFormError(validationError)

    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim(),
      edad_minima: form.edad_minima === '' ? null : Number(form.edad_minima),
      edad_maxima: form.edad_maxima === '' ? null : Number(form.edad_maxima),
    }
    setIsSaving(true)
    try {
      if (editingCategory) await api.patch(`/categorias/${editingCategory.id}/`, payload)
      else await api.post(`/clubes/${selectedClubId}/categorias/`, payload)
      setSuccess(editingCategory ? 'Categoría actualizada correctamente' : 'Categoría creada correctamente')
      setIsFormOpen(false)
      setEditingCategory(null)
      setForm(emptyForm)
      await loadCategories()
    } catch (requestError) {
      setFormError(resolveFormError(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  const openDetail = async (category) => {
    setDetailCategory(category)
    setIsDetailOpen(true)
    setIsDetailLoading(true)
    setPageError('')
    try {
      const { data } = await api.get(`/categorias/${category.id}/`)
      setDetailCategory(data)
    } catch {
      setPageError('No pudimos cargar el detalle de la categoría.')
      setIsDetailOpen(false)
    } finally {
      setIsDetailLoading(false)
    }
  }

  const changeStatus = async (category) => {
    if (category.activo && !window.confirm('¿Deseas desactivar esta categoría?')) return
    const action = category.activo ? 'desactivar' : 'activar'
    setPendingAction(`${action}:${category.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.patch(`/categorias/${category.id}/${action}/`)
      setSuccess(category.activo ? 'Categoría desactivada correctamente' : 'Categoría activada correctamente')
      await loadCategories()
    } catch {
      setPageError(`No se pudo ${action} la categoría. Intenta nuevamente.`)
    } finally {
      setPendingAction('')
    }
  }

  const deleteCategory = async (category) => {
    if (!window.confirm('¿Deseas eliminar esta categoría?')) return
    setPendingAction(`delete:${category.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/categorias/${category.id}/`)
      setSuccess('Categoría eliminada correctamente')
      await loadCategories()
    } catch (requestError) {
      const message = requestError.response?.data?.detail
      setPageError(message === 'No se puede eliminar: tiene equipos asociados' ? message : 'No se pudo eliminar la categoría. Intenta nuevamente.')
    } finally {
      setPendingAction('')
    }
  }

  const ageRange = (category) => {
    if (category.edad_minima == null && category.edad_maxima == null) return 'Sin rango definido'
    if (category.edad_minima == null) return `Hasta ${category.edad_maxima} años`
    if (category.edad_maxima == null) return `Desde ${category.edad_minima} años`
    return `${category.edad_minima} a ${category.edad_maxima} años`
  }

  return (
    <section className="page page-fluid categories-page">
      <div className="page-header categories-header">
        <div><p className="eyebrow">Organización deportiva</p><h1>Gestión de categorías</h1><p>Crea y administra las categorías deportivas del club.</p></div>
        <button type="button" className="button-primary" onClick={() => openCreateForm()} disabled={!selectedClubId}>+ Nueva categoría</button>
      </div>

      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="categories-toolbar">
        <label>Club
          <select value={selectedClubId} onChange={changeClub} disabled={isPageLoading || clubs.length <= 1}>
            {!clubs.length && <option value="">No hay clubes disponibles</option>}
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}
          </select>
        </label>
        <div className="categories-filter" aria-label="Filtrar categorías">
          {filterOptions.map(([value, label]) => <button key={value} type="button" className={filter === value ? 'is-active' : ''} onClick={() => changeFilter(value)} disabled={!selectedClubId}>{label}</button>)}
        </div>
      </div>

      <section className="categories-quick-card">
        <div><span className="eyebrow">Opciones rápidas</span><h2>Categorías predefinidas</h2><p>Selecciona una opción para completar el formulario.</p></div>
        <div className="categories-chips">{predefined.map((name) => <button key={name} type="button" onClick={() => openCreateForm(name)} disabled={!selectedClubId}>{name}</button>)}</div>
      </section>

      <section className="categories-list-card">
        <div className="categories-list-heading"><div><h2>{selectedClub ? `Categorías de ${selectedClub.nombre}` : 'Categorías del club'}</h2><p>{categories.length} {categories.length === 1 ? 'categoría encontrada' : 'categorías encontradas'}</p></div></div>
        {isPageLoading || isCategoriesLoading ? <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando categorías...</strong></div> : !selectedClubId ? <div className="categories-empty"><span className="categories-empty-icon">TS</span><strong>No hay clubes disponibles</strong><p>Crea un club antes de administrar categorías.</p></div> : categories.length === 0 ? <div className="categories-empty"><span className="categories-empty-icon">+</span><strong>No hay categorías en esta vista</strong><p>Crea una categoría o cambia el filtro seleccionado.</p><button type="button" className="button-primary" onClick={() => openCreateForm()}>Crear categoría</button></div> : (
          <div className="categories-grid">{categories.map((category) => {
            const busy = pendingAction.endsWith(`:${category.id}`)
            return <article className="category-card" key={category.id}>
              <div className="category-card-top"><div><span className="category-card-kicker">{ageRange(category)}</span><h3>{category.nombre}</h3></div><span className={category.activo ? 'club-status-active' : 'club-status-inactive'}>{category.activo ? 'Activa' : 'Inactiva'}</span></div>
              <p>{category.descripcion || 'Sin descripción registrada.'}</p>
              <div className="category-card-meta"><span>Edad mínima <strong>{category.edad_minima ?? '—'}</strong></span><span>Edad máxima <strong>{category.edad_maxima ?? '—'}</strong></span>{category.predefinida && <span className="category-predefined-badge">Predefinida</span>}</div>
              <div className="category-actions"><button type="button" onClick={() => openDetail(category)} disabled={busy}>Ver</button><button type="button" onClick={() => openEditForm(category)} disabled={busy}>Editar</button><button type="button" className={category.activo ? 'is-warning' : 'is-success'} onClick={() => changeStatus(category)} disabled={busy}>{pendingAction === `${category.activo ? 'desactivar' : 'activar'}:${category.id}` ? 'Procesando...' : category.activo ? 'Desactivar' : 'Activar'}</button><button type="button" className="is-danger" onClick={() => deleteCategory(category)} disabled={busy}>{pendingAction === `delete:${category.id}` ? 'Eliminando...' : 'Eliminar'}</button></div>
            </article>
          })}</div>
        )}
      </section>

      {isFormOpen && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><section className="clubs-modal category-modal" role="dialog" aria-modal="true" aria-labelledby="category-form-title"><div className="clubs-modal-header"><div><span className="eyebrow">{editingCategory ? 'Actualizar categoría' : 'Nueva categoría'}</span><h2 id="category-form-title">{editingCategory ? 'Editar categoría' : 'Crear categoría'}</h2><p>Define el nombre, descripción y rango de edad.</p></div><button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">×</button></div><form className="category-form" onSubmit={submitForm} noValidate><label className="clubs-form-group category-field-full">Nombre de categoría <span>*</span><input value={form.nombre} onChange={updateField('nombre')} placeholder="Ej. Sub-12" autoFocus /></label><label className="clubs-form-group category-field-full">Descripción<textarea value={form.descripcion} onChange={updateField('descripcion')} placeholder="Describe el nivel o grupo de edad" rows="3" /></label><label className="clubs-form-group">Edad mínima <small>(opcional)</small><input type="number" min="0" value={form.edad_minima} onChange={updateField('edad_minima')} placeholder="10" /></label><label className="clubs-form-group">Edad máxima <small>(opcional)</small><input type="number" min="0" value={form.edad_maxima} onChange={updateField('edad_maxima')} placeholder="12" /></label>{formError && <div className="clubs-alert clubs-alert-error category-field-full" role="alert">{formError}</div>}<div className="clubs-form-actions category-field-full"><button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button><button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar categoría'}</button></div></form></section></div>}

      {isDetailOpen && detailCategory && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsDetailOpen(false) }}><section className="clubs-modal category-detail-modal" role="dialog" aria-modal="true" aria-labelledby="category-detail-title"><div className="clubs-modal-header"><div><span className="eyebrow">Detalle deportivo</span><h2 id="category-detail-title">Información de la categoría</h2></div><button type="button" className="clubs-modal-close" onClick={() => setIsDetailOpen(false)} aria-label="Cerrar detalle">×</button></div>{isDetailLoading ? <div className="categories-empty"><span className="clubs-loader" /></div> : <><div className="category-detail-hero"><div><span>{ageRange(detailCategory)}</span><h3>{detailCategory.nombre}</h3></div><span className={detailCategory.activo ? 'club-status-active' : 'club-status-inactive'}>{detailCategory.activo ? 'Activa' : 'Inactiva'}</span></div><p className="category-detail-description">{detailCategory.descripcion || 'Sin descripción registrada.'}</p><dl className="category-detail-grid"><div><dt>Edad mínima</dt><dd>{detailCategory.edad_minima ?? 'No definida'}</dd></div><div><dt>Edad máxima</dt><dd>{detailCategory.edad_maxima ?? 'No definida'}</dd></div><div><dt>Tipo</dt><dd>{detailCategory.predefinida ? 'Predefinida' : 'Personalizada'}</dd></div><div><dt>Estado</dt><dd>{detailCategory.activo ? 'Activa' : 'Inactiva'}</dd></div></dl><div className="clubs-form-actions category-detail-actions"><button type="button" className="button-ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</button><button type="button" className="button-primary" onClick={() => openEditForm(detailCategory)}>Editar</button></div></>}</section></div>}
    </section>
  )
}

export default CategoriesPage
