import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import api from '../api/axios'

const CACHE_KEY = 'talentai.parentPortal.cache.v1'
const PENDING_ACTIONS_KEY = 'talentai.parentPortal.pendingActions.v1'

const emptyCache = {
  players: [],
  events: [],
  teams: [],
  callUpsByPlayer: {},
  selectedPlayerId: '',
}

const asList = (data) => (Array.isArray(data) ? data : data?.results || [])
const relationId = (value) => String(value?.id || value || '')

const readStoredJson = (key, fallback) => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

const writeStoredJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // El portal sigue funcionando durante la sesión si el almacenamiento está lleno.
  }
}

const readCache = () => ({
  ...emptyCache,
  ...readStoredJson(CACHE_KEY, emptyCache),
})

const updateCache = (updates) => {
  const nextCache = { ...readCache(), ...updates }
  writeStoredJson(CACHE_KEY, nextCache)
  return nextCache
}

const cacheCallUps = (playerId, callUps) => {
  const cache = readCache()
  updateCache({
    callUpsByPlayer: {
      ...cache.callUpsByPlayer,
      [playerId]: callUps,
    },
    selectedPlayerId: playerId,
  })
}

const readPendingActions = () => {
  const actions = readStoredJson(PENDING_ACTIONS_KEY, [])
  return Array.isArray(actions) ? actions : []
}

const savePendingActions = (actions) => writeStoredJson(PENDING_ACTIONS_KEY, actions)

const isNetworkError = (error) => !error.response

const statusLabels = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  RECHAZADO: 'Rechazado',
  NO_CONVOCADO: 'No convocado',
}

const eventTypeLabels = {
  ENTRENAMIENTO: 'Entrenamiento',
  PARTIDO: 'Partido',
  TORNEO: 'Torneo',
  OTRO: 'Otro',
}

const paymentStatusLabels = {
  PENDIENTE: 'Pendiente',
  VENCIDO: 'Vencido',
  PAGADO: 'Pagado',
  CANCELADO: 'Cancelado',
  ANULADO: 'Anulado',
}

const formatDateOnly = (value, fallback = 'Sin fecha') => {
  if (!value) return fallback
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    const date = new Date(year, month - 1, day)
    return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(date)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(date)
}

const formatDateTime = (value, fallback = 'Sin fecha disponible') => {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const firstMessage = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(firstMessage).find(Boolean)
  if (value && typeof value === 'object') {
    return Object.values(value).map(firstMessage).find(Boolean)
  }
  return ''
}

const requestErrorMessage = (error, fallback) => (
  firstMessage(error.response?.data) || fallback
)

function ParentPortalPage() {
  const [initialCache] = useState(() => readCache())
  const initialPlayerId = initialCache.selectedPlayerId
    || String(initialCache.players[0]?.id || '')
  const [players, setPlayers] = useState(initialCache.players)
  const [events, setEvents] = useState(initialCache.events)
  const [teams, setTeams] = useState(initialCache.teams)
  const [playerId, setPlayerId] = useState(initialPlayerId)
  const [callUps, setCallUps] = useState(
    initialCache.callUpsByPlayer[initialPlayerId] || [],
  )
  const [payments, setPayments] = useState([])
  const [isLoadingPayments, setIsLoadingPayments] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(null)
  const [confirmingPayment, setConfirmingPayment] = useState(null)
  const [paymentError, setPaymentError] = useState('')
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const [isLoading, setIsLoading] = useState(() => navigator.onLine && !initialCache.players.length)
  const [isLoadingCallUps, setIsLoadingCallUps] = useState(
    () => navigator.onLine && !initialCache.callUpsByPlayer[initialPlayerId],
  )
  const [pendingActions, setPendingActions] = useState(readPendingActions)
  const [isSynchronizing, setIsSynchronizing] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [rejectingCallUp, setRejectingCallUp] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const synchronizingRef = useRef(false)

  const loadCallUps = useCallback(async (selectedPlayerId) => {
    const { data } = await api.get(`/jugadores/${selectedPlayerId}/convocatorias/`)
    const loadedCallUps = asList(data)
    cacheCallUps(selectedPlayerId, loadedCallUps)
    setCallUps(loadedCallUps)
    return loadedCallUps
  }, [])

  const loadPayments = useCallback(async (selectedPlayerId) => {
    // Use the global pagos endpoint filtered by jugador to retrieve all states
    const { data } = await api.get(`/pagos/?jugador=${selectedPlayerId}`)
    const loadedPayments = asList(data)
    setPayments(loadedPayments)
    return loadedPayments
  }, [])

  const queueOfflineAction = (callUp, type, reason = null) => {
    const action = {
      convocatoriaId: String(callUp.id),
      playerId,
      type,
      motivo_rechazo: type === 'RECHAZAR' ? reason : null,
      savedAt: new Date().toISOString(),
    }
    const nextActions = [
      ...readPendingActions().filter(
        (item) => String(item.convocatoriaId) !== String(callUp.id),
      ),
      action,
    ]
    savePendingActions(nextActions)
    setPendingActions(nextActions)

    const nextCallUps = callUps.map((item) => (
      String(item.id) === String(callUp.id)
        ? {
          ...item,
          motivo_rechazo: type === 'RECHAZAR' ? reason : null,
          respuesta_local: type,
        }
        : item
    ))
    setCallUps(nextCallUps)
    cacheCallUps(playerId, nextCallUps)
    setSuccess('Respuesta guardada. Se sincronizará cuando vuelva internet.')
  }

  const clearOfflineAction = (callUpId) => {
    const nextActions = readPendingActions().filter(
      (item) => String(item.convocatoriaId) !== String(callUpId),
    )
    savePendingActions(nextActions)
    setPendingActions(nextActions)
  }

  const synchronizePendingActions = useCallback(async () => {
    if (synchronizingRef.current || !navigator.onLine) return
    const storedActions = readPendingActions()
    if (!storedActions.length) return

    synchronizingRef.current = true
    setIsSynchronizing(true)
    setPageError('')
    let remainingActions = [...storedActions]
    let synchronizedCount = 0

    for (const action of storedActions) {
      try {
        if (action.type === 'CONFIRMAR') {
          await api.patch(`/convocatorias/${action.convocatoriaId}/confirmar/`, {})
        } else {
          await api.patch(`/convocatorias/${action.convocatoriaId}/rechazar/`, {
            motivo_rechazo: action.motivo_rechazo,
          })
        }
        remainingActions = remainingActions.filter(
          (item) => String(item.convocatoriaId) !== String(action.convocatoriaId),
        )
        savePendingActions(remainingActions)
        setPendingActions(remainingActions)
        synchronizedCount += 1
      } catch (error) {
        if (error.response?.status === 400) {
          setPageError(requestErrorMessage(
            error,
            'El servidor rechazó una respuesta pendiente. Revísala e intenta nuevamente.',
          ))
        } else if (isNetworkError(error)) {
          setIsOnline(false)
        } else {
          setPageError(requestErrorMessage(
            error,
            'No se pudieron sincronizar todas las respuestas pendientes.',
          ))
        }
        break
      }
    }

    if (synchronizedCount && playerId && navigator.onLine) {
      try {
        await loadCallUps(playerId)
        setSuccess(synchronizedCount === 1
          ? 'Respuesta pendiente sincronizada correctamente.'
          : `${synchronizedCount} respuestas pendientes sincronizadas correctamente.`)
      } catch (error) {
        if (isNetworkError(error)) setIsOnline(false)
      }
    }

    synchronizingRef.current = false
    setIsSynchronizing(false)
  }, [loadCallUps, playerId])

  useEffect(() => {
    const handleOffline = () => setIsOnline(false)
    const handleOnline = () => {
      setIsOnline(true)
      setSuccess('Conexión restablecida. Sincronizando respuestas pendientes...')
      synchronizePendingActions()
    }
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    const initialSync = window.setTimeout(() => {
      if (navigator.onLine && readPendingActions().length) synchronizePendingActions()
    }, 0)
    return () => {
      window.clearTimeout(initialSync)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [synchronizePendingActions])

  useEffect(() => {
    if (!navigator.onLine) return undefined
    let isActive = true
    Promise.all([
      api.get('/jugadores/'),
      api.get('/eventos/'),
      api.get('/equipos/'),
    ])
      .then(([playersResponse, eventsResponse, teamsResponse]) => {
        if (!isActive) return
        const loadedPlayers = asList(playersResponse.data)
        const loadedEvents = asList(eventsResponse.data)
        const loadedTeams = asList(teamsResponse.data)
        const cachedSelectedId = readCache().selectedPlayerId
        const selectedId = loadedPlayers.some(
          (player) => String(player.id) === cachedSelectedId,
        ) ? cachedSelectedId : String(loadedPlayers[0]?.id || '')
        setPlayers(loadedPlayers)
        setEvents(loadedEvents)
        setTeams(loadedTeams)
        setPlayerId(selectedId)
        updateCache({
          players: loadedPlayers,
          events: loadedEvents,
          teams: loadedTeams,
          selectedPlayerId: selectedId,
        })
        if (!loadedPlayers.length) setIsLoadingCallUps(false)
      })
      .catch((error) => {
        if (!isActive) return
        if (isNetworkError(error)) setIsOnline(false)
        if (!initialCache.players.length) {
          setPageError(requestErrorMessage(
            error,
            'No pudimos cargar los jugadores y aún no hay datos guardados.',
          ))
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false)
      })
    return () => { isActive = false }
  }, [initialCache.players.length])

  useEffect(() => {
    if (!playerId) return undefined
    if (!isOnline) {
      const cachedCallUps = readCache().callUpsByPlayer[playerId] || []
      const offlineLoad = window.setTimeout(() => {
        setCallUps(cachedCallUps)
        setIsLoadingCallUps(false)
      }, 0)
      return () => window.clearTimeout(offlineLoad)
    }

    let isActive = true
    const onlineLoad = window.setTimeout(() => {
      loadCallUps(playerId)
        .catch((error) => {
          if (!isActive) return
          const cachedCallUps = readCache().callUpsByPlayer[playerId] || []
          setCallUps(cachedCallUps)
          if (isNetworkError(error)) {
            setIsOnline(false)
          } else {
            setPageError(requestErrorMessage(
              error,
              'No pudimos actualizar las convocatorias guardadas.',
            ))
          }
        })
        .finally(() => {
          if (isActive) setIsLoadingCallUps(false)
        })
    }, 0)
    return () => {
      isActive = false
      window.clearTimeout(onlineLoad)
    }
  }, [isOnline, loadCallUps, playerId])

  useEffect(() => {
    if (!playerId) return undefined
    if (!isOnline) {
      const offlinePaymentLoad = window.setTimeout(() => {
        setPayments([])
        setIsLoadingPayments(false)
      }, 0)
      return () => window.clearTimeout(offlinePaymentLoad)
    }

    let isActive = true
    const onlineLoad = window.setTimeout(() => {
      setIsLoadingPayments(true)
      loadPayments(playerId)
        .catch((error) => {
          if (!isActive) return
          if (isNetworkError(error)) {
            setIsOnline(false)
          } else {
            setPageError(requestErrorMessage(
              error,
              'No pudimos cargar los pagos de las cuotas.',
            ))
          }
        })
        .finally(() => {
          if (isActive) setIsLoadingPayments(false)
        })
    }, 0)
    return () => {
      isActive = false
      window.clearTimeout(onlineLoad)
    }
  }, [isOnline, loadPayments, playerId])

  const eventById = useMemo(() => new Map(
    events.map((event) => [String(event.id), event]),
  ), [events])

  const teamById = useMemo(() => new Map(
    teams.map((team) => [String(team.id), team]),
  ), [teams])

  const pendingByCallUpId = useMemo(() => new Map(
    pendingActions.map((action) => [String(action.convocatoriaId), action]),
  ), [pendingActions])

  const selectedPlayer = players.find((player) => String(player.id) === playerId)

  const replaceCallUp = (updatedCallUp) => {
    const nextCallUps = callUps.map(
      (callUp) => String(callUp.id) === String(updatedCallUp.id)
        ? updatedCallUp
        : callUp,
    )
    setCallUps(nextCallUps)
    cacheCallUps(playerId, nextCallUps)
  }

  const confirmCallUp = async (callUp) => {
    setPendingAction(`confirm:${callUp.id}`)
    setPageError('')
    setSuccess('')
    if (!isOnline || !navigator.onLine) {
      queueOfflineAction(callUp, 'CONFIRMAR')
      setPendingAction('')
      return
    }
    try {
      const { data } = await api.patch(`/convocatorias/${callUp.id}/confirmar/`, {})
      clearOfflineAction(callUp.id)
      replaceCallUp(data)
      setSuccess('Convocatoria confirmada correctamente.')
    } catch (error) {
      if (isNetworkError(error)) {
        setIsOnline(false)
        queueOfflineAction(callUp, 'CONFIRMAR')
      } else {
        setPageError(requestErrorMessage(error, 'No se pudo confirmar la convocatoria.'))
      }
    } finally {
      setPendingAction('')
    }
  }

  const openRejectModal = (callUp) => {
    const queuedAction = pendingByCallUpId.get(String(callUp.id))
    setRejectingCallUp(callUp)
    setRejectionReason(queuedAction?.motivo_rechazo || callUp.motivo_rechazo || '')
    setFormError('')
    setPageError('')
    setSuccess('')
  }

  const closeRejectModal = () => {
    if (pendingAction) return
    setRejectingCallUp(null)
    setRejectionReason('')
    setFormError('')
  }

  const rejectCallUp = async (event) => {
    event.preventDefault()
    if (!rejectingCallUp) return
    const reason = rejectionReason.trim()
    if (!reason) {
      setFormError('Escribe el motivo del rechazo.')
      return
    }

    setPendingAction(`reject:${rejectingCallUp.id}`)
    setFormError('')
    if (!isOnline || !navigator.onLine) {
      queueOfflineAction(rejectingCallUp, 'RECHAZAR', reason)
      setRejectingCallUp(null)
      setRejectionReason('')
      setPendingAction('')
      return
    }
    try {
      const { data } = await api.patch(
        `/convocatorias/${rejectingCallUp.id}/rechazar/`,
        { motivo_rechazo: reason },
      )
      clearOfflineAction(rejectingCallUp.id)
      replaceCallUp(data)
      setRejectingCallUp(null)
      setRejectionReason('')
      setSuccess('Convocatoria rechazada correctamente.')
    } catch (error) {
      if (isNetworkError(error)) {
        setIsOnline(false)
        queueOfflineAction(rejectingCallUp, 'RECHAZAR', reason)
        setRejectingCallUp(null)
        setRejectionReason('')
      } else {
        setFormError(requestErrorMessage(error, 'No se pudo rechazar la convocatoria.'))
      }
    } finally {
      setPendingAction('')
    }
  }

  const initiatePayment = async (payment) => {
    setProcessingPayment(payment.id)
    setPageError('')
    setPaymentError('')
    setSuccess('')
    try {
      await api.post(`/pagos/${payment.id}/iniciar-pago-stripe/`, {})
      setConfirmingPayment(payment)
    } catch (error) {
      if (isNetworkError(error)) {
        setIsOnline(false)
      } else {
        setPaymentError(requestErrorMessage(error, 'No se pudo iniciar el pago.'))
      }
    } finally {
      setProcessingPayment(null)
    }
  }
    const confirmStripePayment = async () => {
    if (!confirmingPayment) return

    setProcessingPayment(confirmingPayment.id)
    setPaymentError('')

    try {
      const payload = {
        referencia: `STRIPE-${Date.now()}`,
      }

      const { data } = await api.post(
        `/pagos/${confirmingPayment.id}/confirmar-pago-stripe/`,
        payload,
      )

      setPayments((prev) =>
        prev.map((p) => (String(p.id) === String(data.id) ? { ...p, ...data } : p)),
      )

      setConfirmingPayment(null)

      try {
        await loadPayments(playerId)
      } catch {
        // Si falla la recarga, se mantiene el pago actualizado localmente.
      }

      setSuccess('Pago realizado correctamente.')
    } catch (error) {
      if (isNetworkError(error)) {
        setIsOnline(false)
      } else {
        setPaymentError(requestErrorMessage(error, 'No se pudo confirmar el pago.'))
      }
    } finally {
      setProcessingPayment(null)
    }
  }

  return (
    <section className="page page-fluid parent-portal-page">
      <div className="page-header parent-portal-header">
        <div><p className="eyebrow">Familias</p><h1>Portal Padre</h1><p>Consulta y responde las convocatorias deportivas de tus hijos.</p></div>
      </div>

      {!isOnline && <div className="clubs-alert parent-offline-alert" role="status">Modo offline: tus cambios se sincronizarán cuando vuelva internet.</div>}
      {pendingActions.length > 0 && <div className="clubs-alert parent-pending-alert" role="status">Tienes respuestas pendientes de sincronizar.{isSynchronizing ? ' Sincronizando...' : ''}</div>}
      {success && <div className="clubs-alert clubs-alert-success" role="status">{success}</div>}
      {pageError && <div className="clubs-alert clubs-alert-error" role="alert">{pageError}</div>}

      <section className="parent-player-card" aria-label="Seleccionar jugador">
        <div><span className="eyebrow">Jugador</span><strong>{selectedPlayer ? `${selectedPlayer.nombre} ${selectedPlayer.apellido}` : 'Sin jugador seleccionado'}</strong><small>{selectedPlayer?.categoria || 'Selecciona un hijo para ver sus convocatorias'}</small></div>
        <label>Seleccionar hijo<select value={playerId} onChange={(event) => { const nextPlayerId = event.target.value; setIsLoadingCallUps(isOnline); setIsLoadingPayments(isOnline); setPageError(''); setPaymentError(''); setPlayerId(nextPlayerId); setSuccess(''); setConfirmingPayment(null); updateCache({ selectedPlayerId: nextPlayerId }); if (!isOnline) { setCallUps(readCache().callUpsByPlayer[nextPlayerId] || []); setPayments([]) } }} disabled={isLoading || !players.length}>{!players.length && <option value="">No hay jugadores disponibles</option>}{players.map((player) => <option key={player.id} value={player.id}>{player.nombre} {player.apellido}</option>)}</select></label>
      </section>

      <section className="parent-callups-section">
        <div className="categories-list-heading"><div><h2>Convocatorias</h2><p>{callUps.length} {callUps.length === 1 ? 'convocatoria encontrada' : 'convocatorias encontradas'}</p></div></div>
        {isLoading || isLoadingCallUps ? <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando convocatorias...</strong></div> : !players.length ? <div className="categories-empty"><span className="categories-empty-icon">TS</span><strong>No hay jugadores vinculados</strong><p>Cuando exista un jugador asociado podrás consultar aquí sus convocatorias.</p></div> : !callUps.length ? <div className="categories-empty"><span className="categories-empty-icon">0</span><strong>No hay convocatorias guardadas</strong><p>Conéctate a internet una vez para guardar las convocatorias de este jugador.</p></div> : (
          <div className="parent-callups-grid">
            {callUps.map((callUp) => {
              const event = eventById.get(relationId(callUp.evento))
              const team = teamById.get(relationId(event?.equipo))
              const queuedAction = pendingByCallUpId.get(String(callUp.id))
              const isPending = callUp.estado === 'PENDIENTE' || Boolean(queuedAction)
              const isBusy = pendingAction.endsWith(`:${callUp.id}`)
              return <article className="parent-callup-card" key={callUp.id}>
                <div className="parent-callup-card-top"><div><span className="category-card-kicker">{eventTypeLabels[event?.tipo] || event?.tipo || 'Evento'}</span><h3>{event?.titulo || 'Evento no disponible'}</h3></div><span className={`callup-status ${queuedAction ? 'parent-status-sync' : `callup-status-${callUp.estado.toLowerCase().replace('_', '-')}`}`}>{queuedAction ? 'Pendiente de sincronizar' : statusLabels[callUp.estado] || callUp.estado}</span></div>
                <dl className="parent-callup-details"><div><dt>Fecha y hora</dt><dd>{formatDateTime(event?.fecha_inicio)}</dd></div><div><dt>Equipo</dt><dd>{team?.nombre || 'Sin equipo'}</dd></div>{callUp.respondido_en && <div><dt>Respondido</dt><dd>{formatDateTime(callUp.respondido_en)}</dd></div>}{queuedAction && <div><dt>Respuesta local</dt><dd>{queuedAction.type === 'CONFIRMAR' ? 'Confirmar' : 'Rechazar'}</dd></div>}</dl>
                {(queuedAction?.motivo_rechazo || callUp.motivo_rechazo) && <div className="parent-rejection-reason"><span>Motivo del rechazo</span><p>{queuedAction?.motivo_rechazo || callUp.motivo_rechazo}</p></div>}
                <div className="parent-callup-actions"><button type="button" className="button-primary" onClick={() => confirmCallUp(callUp)} disabled={!isPending || isBusy}>{pendingAction === `confirm:${callUp.id}` ? 'Confirmando...' : queuedAction?.type === 'CONFIRMAR' ? 'Confirmación guardada' : 'Confirmar'}</button><button type="button" className="button-secondary" onClick={() => openRejectModal(callUp)} disabled={!isPending || isBusy}>{queuedAction?.type === 'RECHAZAR' ? 'Editar rechazo' : 'Rechazar'}</button></div>
              </article>
            })}
          </div>
        )}
      </section>

      <section className="parent-payments-section">
        <div className="categories-list-heading"><div><h2>Historial de pagos</h2><p>{payments.length} {payments.length === 1 ? 'pago encontrado' : 'pagos encontrados'}</p></div></div>
        {isLoading || isLoadingPayments ? <div className="categories-empty"><span className="clubs-loader" /><strong>Cargando pagos...</strong></div> : !players.length ? <div className="categories-empty"><span className="categories-empty-icon">TS</span><strong>No hay jugadores vinculados</strong><p>Cuando exista un jugador asociado podrás consultar aquí sus pagos.</p></div> : !payments.length ? <div className="categories-empty"><span className="categories-empty-icon">✓</span><strong>No existen pagos registrados para este jugador.</strong></div> : (
          <div className="parent-payments-grid">
            {payments.map((payment) => {
              const isBusy = processingPayment === payment.id
              const canPay = ['PENDIENTE', 'VENCIDO'].includes(String(payment.estado || '').toUpperCase())
              return <article className="parent-payment-card" key={payment.id}>
                <div className="parent-payment-card-top"><div><span className="category-card-kicker">Cuota Social</span><h3>{payment.concepto || 'Cuota'}</h3></div><span className={`payment-status payment-status-${payment.estado.toLowerCase()}`}>{paymentStatusLabels[payment.estado] || payment.estado}</span></div>
                <dl className="parent-payment-details"><div><dt>Monto</dt><dd>{payment.monto} {payment.moneda}</dd></div><div><dt>Vencimiento</dt><dd>{formatDateOnly(payment.fecha_vencimiento, 'Sin fecha')}</dd></div>{payment.fecha_pago && <div><dt>Pagado</dt><dd>{formatDateOnly(payment.fecha_pago)}</dd></div>}{payment.metodo_pago && <div><dt>Método</dt><dd>{payment.metodo_pago}</dd></div>}{payment.referencia && <div><dt>Referencia</dt><dd>{payment.referencia}</dd></div>}</dl>
                {canPay && <div className="parent-payment-actions"><button type="button" className="button-primary" onClick={() => initiatePayment(payment)} disabled={isBusy}>{isBusy ? 'Procesando...' : 'Pagar'}</button></div>}
              </article>
            })}
          </div>
        )}
      </section>

      {rejectingCallUp && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRejectModal() }}><section className="clubs-modal parent-reject-modal" role="dialog" aria-modal="true" aria-labelledby="reject-callup-title"><div className="clubs-modal-header"><div><span className="eyebrow">Responder convocatoria</span><h2 id="reject-callup-title">Rechazar convocatoria</h2><p>Indica brevemente por qué el jugador no podrá asistir.</p></div><button type="button" className="clubs-modal-close" onClick={closeRejectModal} aria-label="Cerrar formulario">×</button></div><form className="parent-reject-form" onSubmit={rejectCallUp}><label className="clubs-form-group">Motivo del rechazo <span>*</span><textarea value={rejectionReason} onChange={(event) => { setRejectionReason(event.target.value); setFormError('') }} rows="4" placeholder="Ej.: cita médica o compromiso familiar" autoFocus /></label>{formError && <div className="clubs-alert clubs-alert-error" role="alert">{formError}</div>}<div className="clubs-form-actions"><button type="button" className="button-ghost" onClick={closeRejectModal} disabled={Boolean(pendingAction)}>Cancelar</button><button type="submit" className="button-primary" disabled={Boolean(pendingAction)}>{pendingAction ? 'Guardando...' : 'Confirmar rechazo'}</button></div></form></section></div>}

      {confirmingPayment && <div className="clubs-modal-backdrop" role="presentation" onMouseDown={() => { setConfirmingPayment(null); setPaymentError('') }}><section className="clubs-modal parent-payment-modal" role="dialog" aria-modal="true" aria-labelledby="payment-confirm-title"><div className="clubs-modal-header"><div><span className="eyebrow">Confirmar pago</span><h2 id="payment-confirm-title">Checkout de pago</h2><p>Confirma el pago de la cuota.</p></div><button type="button" className="clubs-modal-close" onClick={() => { setConfirmingPayment(null); setPaymentError('') }} aria-label="Cerrar" disabled={processingPayment}>×</button></div>{paymentError && <div className="clubs-alert clubs-alert-error" role="alert" style={{ margin: '12px' }}>{paymentError}</div>}<div className="clubs-modal-content"><p style={{ margin: '0 12px', fontSize: '14px', lineHeight: '1.5' }}><strong>Cuota:</strong> {confirmingPayment.concepto || 'Cuota'}<br/><strong>Monto:</strong> {confirmingPayment.monto} {confirmingPayment.moneda}</p></div><div className="clubs-form-actions" style={{ padding: '12px' }}><button type="button" className="button-ghost" onClick={() => { setConfirmingPayment(null); setPaymentError('') }} disabled={processingPayment}>Cancelar</button><button type="button" className="button-primary" onClick={confirmStripePayment} disabled={processingPayment}>{processingPayment ? 'Procesando...' : 'Confirmar pago'}</button></div></section></div>}
    </section>
  )
}

export default ParentPortalPage
