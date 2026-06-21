import { useCallback, useEffect, useMemo, useState } from 'react'

import api from '../api/axios'

const emptyForm = {
  club: '',
  equipo: '',
  concepto: '',
  descripcion: '',
  monto: '',
  moneda: 'BOB',
  periodo: '',
  fecha_vencimiento: '',
}

const paymentStates = ['PENDIENTE', 'PAGADO', 'VENCIDO', 'ANULADO']
const asList = (data) => (Array.isArray(data) ? data : data?.results || [])
const itemId = (value) => String(value?.id || value || '')

const readApiError = (error, fallback) => {
  const data = error.response?.data
  if (!data) return fallback
  if (typeof data === 'string') return data
  for (const field of [
    'club',
    'equipo',
    'concepto',
    'descripcion',
    'monto',
    'moneda',
    'periodo',
    'fecha_vencimiento',
    'estado',
    'jugadores',
    'detail',
    'non_field_errors',
  ]) {
    const value = data[field]
    const message = Array.isArray(value) ? value[0] : value
    if (typeof message === 'string') return message
  }
  return fallback
}

const money = (amount, currency = 'BOB') => {
  const value = Number(amount || 0)
  return `${currency || 'BOB'} ${Number.isFinite(value) ? value.toFixed(2) : amount}`
}

function CuotasPage() {
  const [cuotas, setCuotas] = useState([])
  const [clubs, setClubs] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [filters, setFilters] = useState({ club: '', equipo: '' })
  const [form, setForm] = useState(emptyForm)
  const [editingCuota, setEditingCuota] = useState(null)
  const [paymentsCuota, setPaymentsCuota] = useState(null)
  const [payments, setPayments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false)
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  const clubById = useMemo(
    () => new Map(clubs.map((club) => [String(club.id), club])),
    [clubs],
  )
  const teamById = useMemo(
    () => new Map(teams.map((team) => [String(team.id), team])),
    [teams],
  )
  const playerById = useMemo(
    () => new Map(players.map((player) => [String(player.id), player])),
    [players],
  )

  const loadCuotas = useCallback(async () => {
    setIsLoading(true)
    setPageError('')
    try {
      const { data } = await api.get('/cuotas/')
      setCuotas(asList(data))
    } catch {
      setPageError('No pudimos cargar las cuotas. Intenta nuevamente.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const request = window.setTimeout(loadCuotas, 0)
    return () => window.clearTimeout(request)
  }, [loadCuotas])

  useEffect(() => {
    let active = true
    Promise.all([api.get('/clubes/'), api.get('/equipos/'), api.get('/jugadores/')])
      .then(([clubsResponse, teamsResponse, playersResponse]) => {
        if (!active) return
        const loadedClubs = asList(clubsResponse.data)
        setClubs(loadedClubs)
        setTeams(asList(teamsResponse.data))
        setPlayers(asList(playersResponse.data))
        if (loadedClubs.length) {
          setFilters((current) => ({ ...current, club: current.club || String(loadedClubs[0].id) }))
        }
      })
      .catch(() => {
        if (active) setPageError('No pudimos cargar clubes, equipos y jugadores disponibles.')
      })
      .finally(() => {
        if (active) setIsCatalogLoading(false)
      })
    return () => { active = false }
  }, [])

  const filteredTeams = useMemo(() => {
    if (!filters.club) return teams
    return teams.filter((team) => itemId(team.club) === filters.club)
  }, [filters.club, teams])

  const formTeams = useMemo(() => {
    if (!form.club) return []
    return teams.filter((team) => itemId(team.club) === form.club)
  }, [form.club, teams])

  const visibleCuotas = useMemo(() => cuotas.filter((cuota) => {
    if (filters.club && itemId(cuota.club) !== filters.club) return false
    if (filters.equipo && itemId(cuota.equipo) !== filters.equipo) return false
    return true
  }), [cuotas, filters])

  const updateFilter = (field) => (event) => {
    const value = event.target.value
    setFilters((current) => ({
      ...current,
      [field]: value,
      ...(field === 'club' ? { equipo: '' } : {}),
    }))
  }

  const updateField = (field) => (event) => {
    const value = event.target.value
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'club' ? { equipo: '' } : {}),
    }))
    setFormError('')
  }

  const clubName = (cuota) => clubById.get(itemId(cuota.club))?.nombre || 'Club no disponible'
  const teamName = (cuota) => {
    const teamId = itemId(cuota.equipo)
    return teamId ? teamById.get(teamId)?.nombre || 'Equipo no disponible' : 'Todo el club'
  }
  const playerName = (payment) => {
    const player = playerById.get(itemId(payment.jugador))
    if (!player) return 'Jugador no disponible'
    return `${player.nombre || ''} ${player.apellido || ''}`.trim() || 'Jugador sin nombre'
  }

  const openCreateForm = () => {
    setEditingCuota(null)
    setForm({ ...emptyForm, club: filters.club || (clubs[0] ? String(clubs[0].id) : '') })
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
  }

  const openEditForm = (cuota) => {
    setEditingCuota(cuota)
    setForm({
      club: itemId(cuota.club),
      equipo: itemId(cuota.equipo),
      concepto: cuota.concepto || '',
      descripcion: cuota.descripcion || '',
      monto: cuota.monto || '',
      moneda: cuota.moneda || 'BOB',
      periodo: cuota.periodo || '',
      fecha_vencimiento: cuota.fecha_vencimiento || '',
    })
    setFormError('')
    setSuccess('')
    setIsFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsFormOpen(false)
    setEditingCuota(null)
    setForm(emptyForm)
    setFormError('')
  }

  const validateForm = () => {
    if (!form.club) return 'El club es obligatorio.'
    if (!form.concepto.trim()) return 'El concepto es obligatorio.'
    if (!Number(form.monto) || Number(form.monto) <= 0) return 'El monto debe ser mayor a 0.'
    if (!form.fecha_vencimiento) return 'La fecha de vencimiento es obligatoria.'
    return ''
  }

  const submitForm = async (event) => {
    event.preventDefault()
    const validationError = validateForm()
    setFormError(validationError)
    if (validationError) return

    const payload = {
      club: form.club,
      equipo: form.equipo || null,
      concepto: form.concepto.trim(),
      descripcion: form.descripcion.trim(),
      monto: Number(form.monto),
      moneda: form.moneda.trim() || 'BOB',
      periodo: form.periodo.trim(),
      fecha_vencimiento: form.fecha_vencimiento,
    }

    setIsSaving(true)
    try {
      if (editingCuota) {
        await api.patch(`/cuotas/${editingCuota.id}/`, payload)
        setSuccess('Cuota actualizada correctamente.')
      } else {
        await api.post('/cuotas/', payload)
        setSuccess('Cuota creada correctamente.')
      }
      setFilters((current) => ({ ...current, club: form.club, equipo: form.equipo || '' }))
      setIsFormOpen(false)
      setEditingCuota(null)
      setForm(emptyForm)
      await loadCuotas()
    } catch (error) {
      setFormError(readApiError(error, 'No se pudo guardar la cuota. Revisa los datos.'))
    } finally {
      setIsSaving(false)
    }
  }

  const deactivateCuota = async (cuota) => {
    if (!window.confirm('Deseas desactivar esta cuota?')) return
    setPendingAction(`delete:${cuota.id}`)
    setPageError('')
    setSuccess('')
    try {
      await api.delete(`/cuotas/${cuota.id}/`)
      setSuccess('Cuota desactivada correctamente.')
      await loadCuotas()
    } catch (error) {
      setPageError(readApiError(error, 'No se pudo desactivar la cuota.'))
    } finally {
      setPendingAction('')
    }
  }

  const generatePayments = async (cuota) => {
    setPendingAction(`generate:${cuota.id}`)
    setPageError('')
    setSuccess('')
    try {
      const { data } = await api.post(`/cuotas/${cuota.id}/generar-pagos/`)
      setSuccess(`Pagos generados: ${data.pagos_creados || 0} nuevos de ${data.total || 0} jugadores.`)
      if (paymentsCuota?.id === cuota.id) await openPayments(cuota)
    } catch (error) {
      setPageError(readApiError(error, 'No se pudieron generar los pagos de la cuota.'))
    } finally {
      setPendingAction('')
    }
  }

  const openPayments = async (cuota) => {
    setPaymentsCuota(cuota)
    setPayments([])
    setIsPaymentsOpen(true)
    setIsPaymentsLoading(true)
    setPageError('')
    try {
      const { data } = await api.get(`/cuotas/${cuota.id}/pagos/`)
      setPayments(asList(data))
    } catch (error) {
      setIsPaymentsOpen(false)
      setPageError(readApiError(error, 'No pudimos cargar los pagos de la cuota.'))
    } finally {
      setIsPaymentsLoading(false)
    }
  }

  return (
    <section className="page page-fluid categories-page cuotas-page">
      <div className="page-header categories-header">
        <div>
          <p className="eyebrow">Administracion</p>
          <h1>Cuotas sociales</h1>
          <p>Gestiona cuotas por club o equipo y genera pagos para jugadores activos.</p>
        </div>
        <button type="button" className="button-primary" onClick={openCreateForm} disabled={isCatalogLoading || !clubs.length}>
          + Nueva cuota
        </button>
      </div>

      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <div className="cuotas-toolbar">
        <label>
          Club
          <select value={filters.club} onChange={updateFilter('club')} disabled={isCatalogLoading}>
            <option value="">Todos los clubes</option>
            {clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}
          </select>
        </label>
        <label>
          Equipo
          <select value={filters.equipo} onChange={updateFilter('equipo')} disabled={!filters.club}>
            <option value="">Todos los equipos</option>
            {filteredTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}
          </select>
        </label>
        <button type="button" className="button-ghost" onClick={() => setFilters({ club: '', equipo: '' })}>
          Limpiar
        </button>
      </div>

      <section className="categories-list-card">
        <div className="categories-list-heading">
          <div>
            <h2>Cuotas registradas</h2>
            <p>{visibleCuotas.length} {visibleCuotas.length === 1 ? 'cuota encontrada' : 'cuotas encontradas'}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando cuotas...</strong></div>
        ) : visibleCuotas.length === 0 ? (
          <div className="categories-empty">
            <span className="categories-empty-icon">+</span>
            <strong>No hay cuotas en esta vista</strong>
            <p>Crea una cuota o ajusta los filtros seleccionados.</p>
            <button type="button" className="button-primary" onClick={openCreateForm} disabled={!clubs.length}>Crear cuota</button>
          </div>
        ) : (
          <div className="categories-grid cuotas-grid">
            {visibleCuotas.map((cuota) => {
              const busy = pendingAction.endsWith(`:${cuota.id}`)
              const active = cuota.estado === 'ACTIVA'
              return (
                <article className="category-card cuota-card" key={cuota.id}>
                  <div className="category-card-top">
                    <div>
                      <span className="category-card-kicker">{clubName(cuota)}</span>
                      <h3>{cuota.concepto}</h3>
                    </div>
                    <span className={active ? 'club-status-active' : 'club-status-inactive'}>
                      {active ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p>{cuota.descripcion || 'Sin descripcion registrada.'}</p>
                  <div className="category-card-meta cuota-card-meta">
                    <span>Monto <strong>{money(cuota.monto, cuota.moneda)}</strong></span>
                    <span>Periodo <strong>{cuota.periodo || 'Sin periodo'}</strong></span>
                    <span>Vence <strong>{cuota.fecha_vencimiento}</strong></span>
                    <span>Equipo <strong>{teamName(cuota)}</strong></span>
                  </div>
                  <div className="category-actions cuota-actions">
                    <button type="button" onClick={() => openEditForm(cuota)} disabled={busy}>Editar</button>
                    <button type="button" onClick={() => openPayments(cuota)} disabled={busy}>Ver pagos</button>
                    <button type="button" className="is-success" onClick={() => generatePayments(cuota)} disabled={busy || !active}>
                      {pendingAction === `generate:${cuota.id}` ? 'Generando...' : 'Generar pagos'}
                    </button>
                    <button type="button" className="is-danger" onClick={() => deactivateCuota(cuota)} disabled={busy || !active}>
                      {pendingAction === `delete:${cuota.id}` ? 'Procesando...' : 'Desactivar'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {isFormOpen && (
        <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <section className="clubs-modal cuota-modal" role="dialog" aria-modal="true" aria-labelledby="cuota-form-title">
            <div className="clubs-modal-header">
              <div>
                <span className="eyebrow">{editingCuota ? 'Actualizar cuota' : 'Nueva cuota'}</span>
                <h2 id="cuota-form-title">{editingCuota ? 'Editar cuota' : 'Crear cuota'}</h2>
                <p>Completa los datos de cobro para el club o un equipo especifico.</p>
              </div>
              <button type="button" className="clubs-modal-close" onClick={closeForm} aria-label="Cerrar formulario">x</button>
            </div>
            <form className="category-form cuota-form" onSubmit={submitForm} noValidate>
              <label className="clubs-form-group">
                Club <span>*</span>
                <select value={form.club} onChange={updateField('club')} autoFocus>
                  <option value="">Selecciona un club</option>
                  {clubs.map((club) => <option key={club.id} value={club.id}>{club.nombre}</option>)}
                </select>
              </label>
              <label className="clubs-form-group">
                Equipo <small>(opcional)</small>
                <select value={form.equipo} onChange={updateField('equipo')} disabled={!form.club}>
                  <option value="">Todo el club</option>
                  {formTeams.map((team) => <option key={team.id} value={team.id}>{team.nombre}</option>)}
                </select>
              </label>
              <label className="clubs-form-group category-field-full">
                Concepto <span>*</span>
                <input value={form.concepto} onChange={updateField('concepto')} placeholder="Cuota mensual junio" />
              </label>
              <label className="clubs-form-group category-field-full">
                Descripcion
                <textarea rows="3" value={form.descripcion} onChange={updateField('descripcion')} placeholder="Pago mensual del club" />
              </label>
              <label className="clubs-form-group">
                Monto <span>*</span>
                <input type="number" min="0.01" step="0.01" value={form.monto} onChange={updateField('monto')} placeholder="80" />
              </label>
              <label className="clubs-form-group">
                Moneda
                <input value={form.moneda} onChange={updateField('moneda')} placeholder="BOB" />
              </label>
              <label className="clubs-form-group">
                Periodo
                <input type="month" value={form.periodo} onChange={updateField('periodo')} />
              </label>
              <label className="clubs-form-group">
                Fecha vencimiento <span>*</span>
                <input type="date" value={form.fecha_vencimiento} onChange={updateField('fecha_vencimiento')} />
              </label>
              {formError && <div className="clubs-alert clubs-alert-error category-field-full" role="alert">{formError}</div>}
              <div className="clubs-form-actions category-field-full">
                <button type="button" className="button-ghost" onClick={closeForm} disabled={isSaving}>Cancelar</button>
                <button type="submit" className="button-primary" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar cuota'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isPaymentsOpen && paymentsCuota && (
        <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsPaymentsOpen(false) }}>
          <section className="clubs-modal cuota-payments-modal" role="dialog" aria-modal="true" aria-labelledby="cuota-payments-title">
            <div className="clubs-modal-header">
              <div>
                <span className="eyebrow">Pagos generados</span>
                <h2 id="cuota-payments-title">{paymentsCuota.concepto}</h2>
                <p>{clubName(paymentsCuota)} - {teamName(paymentsCuota)}</p>
              </div>
              <button type="button" className="clubs-modal-close" onClick={() => setIsPaymentsOpen(false)} aria-label="Cerrar pagos">x</button>
            </div>
            {isPaymentsLoading ? (
              <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando pagos...</strong></div>
            ) : payments.length === 0 ? (
              <div className="categories-empty"><strong>No hay pagos generados</strong><p>Usa el boton Generar pagos para crear cobros.</p></div>
            ) : (
              <>
                <div className="cuota-payment-states">
                  {paymentStates.map((state) => (
                    <span key={state} className={`payment-state payment-state-${state.toLowerCase()}`}>
                      {state}: {payments.filter((payment) => payment.estado === state).length}
                    </span>
                  ))}
                </div>
                <div className="cuota-payments-list">
                  {payments.map((payment) => (
                    <article key={payment.id} className="cuota-payment-row">
                      <div>
                        <strong>{playerName(payment)}</strong>
                        <small>Vence {payment.fecha_vencimiento}</small>
                      </div>
                      <span className={`payment-state payment-state-${String(payment.estado || '').toLowerCase()}`}>
                        {payment.estado}
                      </span>
                      <strong>{money(payment.monto, payment.moneda)}</strong>
                    </article>
                  ))}
                </div>
              </>
            )}
            <div className="clubs-form-actions category-detail-actions">
              <button type="button" className="button-ghost" onClick={() => setIsPaymentsOpen(false)}>Cerrar</button>
              <button type="button" className="button-primary" onClick={() => generatePayments(paymentsCuota)} disabled={pendingAction === `generate:${paymentsCuota.id}` || paymentsCuota.estado !== 'ACTIVA'}>
                {pendingAction === `generate:${paymentsCuota.id}` ? 'Generando...' : 'Generar pagos'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

export default CuotasPage
