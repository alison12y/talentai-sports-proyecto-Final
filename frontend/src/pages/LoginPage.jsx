import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import api from '../api/axios'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fallbackPlans = [
  { id: 'fallback-basico', isFallback: true, codigo: 'BASICO', nombre: 'Básico', descripcion: 'Para clubes pequeños.', precio_mensual: 49, limite_jugadores: 50, limite_equipos: 3, incluye_ia: false, incluye_reportes: true, soporte: 'Estándar', caracteristicas: ['Hasta 50 jugadores', 'Hasta 3 equipos', 'Reportes básicos'] },
  { id: 'fallback-pro', isFallback: true, codigo: 'PRO', nombre: 'Pro', descripcion: 'Para clubes en crecimiento.', precio_mensual: 99, limite_jugadores: 200, limite_equipos: 10, incluye_ia: true, incluye_reportes: true, soporte: 'Preferente', caracteristicas: ['IA básica y scouting', 'Reportes avanzados', 'Hasta 10 equipos'] },
  { id: 'fallback-elite', isFallback: true, codigo: 'ELITE', nombre: 'Elite', descripcion: 'Para academias competitivas.', precio_mensual: 199, limite_jugadores: 500, limite_equipos: 30, incluye_ia: true, incluye_reportes: true, soporte: 'Prioritario', caracteristicas: ['IA avanzada', 'Reportes completos', 'Soporte prioritario'] },
]

const formatPlanPrice = (value) => `$${Number(value || 0).toLocaleString('es-BO')} / mes`
const formatLimit = (value, singular, plural) => value == null ? `Sin límite de ${plural}` : `${value} ${Number(value) === 1 ? singular : plural}`

function BrandHeader({ viewMode, onLanding, onLogin }) {
  return (
    <header className="saas-header">
      <button type="button" className="saas-brand" onClick={onLanding} aria-label="Ir al inicio">
        <span className="saas-logo-mark">TS</span>
        <span className="saas-brand-name">TalentAI Sports</span>
      </button>
      <button type="button" className="saas-btn-header" onClick={viewMode === 'landing' ? onLogin : onLanding}>
        {viewMode === 'landing' ? 'Iniciar sesión' : 'Volver'}
      </button>
    </header>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 4.2A10.7 10.7 0 0112 4c7 0 10 8 10 8a16.8 16.8 0 01-2.1 3.3M6.6 6.6C3.6 8.6 2 12 2 12s3 8 10 8a10 10 0 005.4-1.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function LoginPage() {
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState('landing')
  const [currentStep, setCurrentStep] = useState(1)
  const [error, setError] = useState('')
  const [onboardingErrors, setOnboardingErrors] = useState({})
  const [availablePlans, setAvailablePlans] = useState(fallbackPlans)
  const [isPlansLoading, setIsPlansLoading] = useState(false)
  const [plansNotice, setPlansNotice] = useState('')
  const [isCompleting, setIsCompleting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isRecoverLoading, setIsRecoverLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [login, setLogin] = useState({ email: '', password: '' })
  const [recoverEmail, setRecoverEmail] = useState('')
  const [onboarding, setOnboarding] = useState({
    email: '', nombre: '', apellido: '', telefono: '', password: '', confirmPassword: '',
    clubNombre: '', clubDireccion: '', clubTelefono: '', clubEmail: '', clubCiudad: '',
    plan: '', planId: null, paymentMethod: 'TARJETA',
  })

  useEffect(() => {
    if (localStorage.getItem('user')) navigate('/dashboard')
  }, [navigate])

  const loadAvailablePlans = async () => {
    setIsPlansLoading(true)
    setPlansNotice('')
    try {
      const { data } = await api.get('/planes/')
      const loadedPlans = Array.isArray(data) ? data : data.results || []
      if (loadedPlans.length) setAvailablePlans(loadedPlans.map((plan) => ({ ...plan, isFallback: false })))
      else {
        setAvailablePlans(fallbackPlans)
        setPlansNotice('Mostrando planes de referencia mientras se actualiza el catálogo.')
      }
    } catch {
      setAvailablePlans(fallbackPlans)
      setPlansNotice('Mostrando planes de referencia porque el catálogo no está disponible.')
    } finally {
      setIsPlansLoading(false)
    }
  }

  const updateLogin = (field) => (event) => setLogin((value) => ({ ...value, [field]: event.target.value }))
  const updateOnboarding = (field) => (event) => {
    setOnboarding((value) => ({ ...value, [field]: event.target.value }))
    setOnboardingErrors((value) => ({ ...value, [field]: '' }))
    setError('')
  }
  const goLanding = () => { setViewMode('landing'); setError('') }
  const goLogin = () => { setViewMode('login'); setError('') }
  const goRecover = () => {
    setRecoverEmail(login.email)
    setViewMode('recover')
    setError('')
  }

  const handleLoginSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const cleanEmail = login.email.trim()
    if (!cleanEmail) return setError('El correo es obligatorio')
    if (!emailPattern.test(cleanEmail)) return setError('Ingrese un correo válido')
    if (!login.password) return setError('La contraseña es obligatoria')

    setIsLoading(true)
    try {
      const { data } = await api.post('/auth/login/', { email: cleanEmail, password: login.password })
      if (data.user) localStorage.setItem('user', JSON.stringify(data.user))
      const role = data.role || data.rol || data.user?.role || data.user?.rol
      const token = data.token || data.user?.token || data.token_id
      if (role) localStorage.setItem('role', role)
      if (token) localStorage.setItem('token', token)
      navigate('/dashboard')
    } catch {
      setError('Credenciales incorrectas o usuario no autorizado')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRecoverSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const cleanEmail = recoverEmail.trim()
    if (!cleanEmail) return setError('El correo es obligatorio')
    if (!emailPattern.test(cleanEmail)) return setError('Ingrese un correo válido')

    setIsRecoverLoading(true)
    try {
      await api.post('/auth/recover-password/', { email: cleanEmail })
      setRecoverEmail(cleanEmail)
      setViewMode('recover_success')
    } catch {
      setError('No pudimos procesar la solicitud. Intenta nuevamente.')
    } finally {
      setIsRecoverLoading(false)
    }
  }

  const startOnboarding = (event) => {
    event.preventDefault()
    setError('')
    const cleanEmail = onboarding.email.trim()
    if (!cleanEmail) return setError('El correo es obligatorio')
    if (!emailPattern.test(cleanEmail)) return setError('Ingrese un correo válido')
    setOnboarding((value) => ({ ...value, email: cleanEmail, clubEmail: cleanEmail, plan: '', planId: null }))
    setOnboardingErrors({})
    setCurrentStep(1)
    setViewMode('onboarding')
  }

  const validateAccount = () => {
    const errors = {}
    if (!onboarding.nombre.trim()) errors.nombre = 'El nombre es obligatorio'
    if (!onboarding.apellido.trim()) errors.apellido = 'El apellido es obligatorio'
    if (!onboarding.telefono.trim()) errors.telefono = 'El teléfono es obligatorio'
    if (!onboarding.password) errors.password = 'La contraseña es obligatoria'
    else if (onboarding.password.trim().toLowerCase() === 'admin') errors.password = 'La contraseña no puede ser “admin”'
    else if (onboarding.password.length < 6) errors.password = 'La contraseña debe tener al menos 6 caracteres'
    if (!onboarding.confirmPassword) errors.confirmPassword = 'Confirma tu contraseña'
    else if (onboarding.password !== onboarding.confirmPassword) errors.confirmPassword = 'Las contraseñas no coinciden'
    return errors
  }

  const validateClub = () => {
    const errors = {}
    if (!onboarding.clubNombre.trim()) errors.clubNombre = 'El nombre del club es obligatorio'
    if (!onboarding.clubCiudad.trim()) errors.clubCiudad = 'La ciudad es obligatoria'
    if (!onboarding.clubTelefono.trim()) errors.clubTelefono = 'El teléfono del club es obligatorio'
    if (!onboarding.clubEmail.trim()) errors.clubEmail = 'El correo del club es obligatorio'
    else if (!emailPattern.test(onboarding.clubEmail.trim())) errors.clubEmail = 'Ingrese un correo de club válido'
    return errors
  }

  const submitAccount = (event) => {
    event.preventDefault()
    setError('')
    const errors = validateAccount()
    setOnboardingErrors(errors)
    if (Object.keys(errors).length) return
    setCurrentStep(2)
  }

  const submitClub = (event) => {
    event.preventDefault()
    setError('')
    const errors = validateClub()
    setOnboardingErrors(errors)
    if (Object.keys(errors).length) return
    setCurrentStep(4)
    loadAvailablePlans()
  }

  const continueToActivation = () => {
    if (!onboarding.plan) {
      setOnboardingErrors((value) => ({ ...value, plan: 'Selecciona un plan para continuar' }))
      return
    }
    setOnboardingErrors((value) => ({ ...value, plan: '' }))
    setCurrentStep(5)
  }

  const submitPayment = async (event) => {
    event.preventDefault()
    setError('')
    const accountErrors = validateAccount()
    if (Object.keys(accountErrors).length) {
      setOnboardingErrors(accountErrors)
      setCurrentStep(1)
      return setError('Revisa los datos de la cuenta para continuar.')
    }
    const clubErrors = validateClub()
    if (Object.keys(clubErrors).length) {
      setOnboardingErrors(clubErrors)
      setCurrentStep(3)
      return setError('Revisa los datos del club para continuar.')
    }
    if (!onboarding.plan) {
      setOnboardingErrors({ plan: 'Selecciona un plan para continuar' })
      setCurrentStep(4)
      return setError('Selecciona un plan para continuar.')
    }
    if (!onboarding.planId) {
      return setError('El catálogo real de planes no está disponible. Vuelve a Planes e inténtalo nuevamente antes de guardar.')
    }

    setIsCompleting(true)
    try {
      await api.post('/auth/onboarding-complete/', {
        admin: {
          nombre: onboarding.nombre.trim(),
          apellido: onboarding.apellido.trim(),
          telefono: onboarding.telefono.trim(),
          correo: onboarding.email.trim().toLowerCase(),
          password: onboarding.password,
        },
        club: {
          nombre: onboarding.clubNombre.trim(),
          ciudad: onboarding.clubCiudad.trim(),
          telefono: onboarding.clubTelefono.trim(),
          correo: onboarding.clubEmail.trim().toLowerCase(),
          direccion: onboarding.clubDireccion.trim(),
        },
        plan_id: onboarding.planId,
      })
      setViewMode('onboarding_success')
    } catch (requestError) {
      const response = requestError.response?.data
      if (response?.admin?.correo) setError('Ya existe un usuario con ese correo')
      else if (response?.club?.nombre) setError('Ya existe un club registrado con ese nombre')
      else if (response?.plan_id) setError('El plan seleccionado no está disponible')
      else setError('No se pudo completar la configuración. Revisa los datos ingresados.')
    } finally {
      setIsCompleting(false)
    }
  }

  const selectedPlan = availablePlans.find((plan) => plan.codigo === onboarding.plan)
  const goToOnboardingStep = (step) => {
    setError('')
    setOnboardingErrors({})
    setCurrentStep(step)
    if (step === 4) loadAvailablePlans()
  }

  return (
    <div className="saas-page-container">
      <BrandHeader viewMode={viewMode} onLanding={goLanding} onLogin={goLogin} />

      {viewMode === 'landing' && (
        <main className="saas-landing">
          <section className="saas-hero-section" aria-labelledby="hero-title">
            <span className="saas-pill">IA y analítica deportiva</span>
            <h1 id="hero-title" className="saas-hero-title">Gestiona tu club deportivo con inteligencia artificial</h1>
            <p className="saas-hero-subtitle">Administra clubes, equipos, jugadores, pagos y análisis deportivos desde una sola plataforma.</p>
            <form className="saas-start-form" onSubmit={startOnboarding} noValidate>
              <input
                type="email"
                value={onboarding.email}
                onChange={updateOnboarding('email')}
                placeholder="Correo electrónico para comenzar"
                aria-label="Correo electrónico para comenzar"
              />
              <button type="submit" className="saas-btn-submit">Comenzar</button>
            </form>
            {error && <p className="saas-inline-error" role="alert">{error}</p>}
            <div className="saas-chips-container" aria-label="Funciones de la plataforma">
              {['Clubes', 'Equipos', 'Jugadores', 'IA Deportiva'].map((label) => <span className="chip" key={label}>{label}</span>)}
            </div>
          </section>

          <section className="saas-hero-visual" aria-label="Vista previa del panel">
            <div className="saas-mockup-dashboard">
              <div className="mockup-top"><span className="mockup-dots">● ● ●</span><span>Panel del club</span></div>
              <div className="mockup-highlight"><span>Rendimiento general</span><strong>+18.4%</strong></div>
              <div className="mockup-chart" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div>
              <div className="mockup-stats">
                <div><span>Jugadores activos</span><strong>148</strong></div>
                <div><span>Scouting IA</span><strong>94%</strong></div>
                <div><span>Pagos al día</span><strong>91%</strong></div>
              </div>
            </div>
          </section>
        </main>
      )}

      {viewMode === 'login' && (
        <main className="saas-centered-main">
          <section className="saas-login-card">
            <div className="card-header"><span className="saas-card-kicker">Bienvenido de nuevo</span><h2>Iniciar sesión</h2><p>Accede al panel de gestión de TalentAI Sports.</p></div>
            <form className="saas-form" onSubmit={handleLoginSubmit} noValidate>
              <label className="saas-form-group">Correo electrónico
                <input className="saas-login-input" type="email" value={login.email} onChange={updateLogin('email')} placeholder="nombre@correo.com" autoComplete="email" disabled={isLoading} />
              </label>
              <label className="saas-form-group">Contraseña
                <span className="saas-input-wrapper">
                  <input className="saas-login-input password-input" type={showPassword ? 'text' : 'password'} value={login.password} onChange={updateLogin('password')} placeholder="Tu contraseña" autoComplete="current-password" disabled={isLoading} />
                  <button type="button" className="saas-password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}><EyeIcon open={showPassword} /></button>
                </span>
              </label>
              <button className="forgot-link" type="button" onClick={goRecover}>¿Olvidaste tu contraseña?</button>
              {error && <div className="saas-alert-error" role="alert">{error}</div>}
              <button className="saas-btn-submit" type="submit" disabled={isLoading}>{isLoading && <span className="saas-spinner" />}{isLoading ? 'Ingresando...' : 'Iniciar sesión'}</button>
            </form>
          </section>
        </main>
      )}

      {viewMode === 'recover' && (
        <main className="saas-centered-main">
          <section className="saas-login-card">
            <div className="card-header"><span className="saas-card-kicker">Recupera el acceso</span><h2>Recuperar contraseña</h2><p>Ingresa tu correo registrado y te enviaremos instrucciones para recuperar el acceso.</p></div>
            <form className="saas-form" onSubmit={handleRecoverSubmit} noValidate>
              <label className="saas-form-group">Correo electrónico
                <input className="saas-login-input" type="email" value={recoverEmail} onChange={(event) => setRecoverEmail(event.target.value)} placeholder="nombre@correo.com" autoComplete="email" disabled={isRecoverLoading} autoFocus />
              </label>
              {error && <div className="saas-alert-error" role="alert">{error}</div>}
              <button className="saas-btn-submit" type="submit" disabled={isRecoverLoading}>{isRecoverLoading && <span className="saas-spinner" />}{isRecoverLoading ? 'Enviando...' : 'Enviar instrucciones'}</button>
              <button className="saas-back-link" type="button" onClick={goLogin}>Volver a iniciar sesión</button>
            </form>
          </section>
        </main>
      )}

      {viewMode === 'recover_success' && (
        <main className="saas-centered-main">
          <section className="saas-login-card saas-success-card">
            <span className="saas-step-icon">✓</span><span className="saas-card-kicker">Solicitud recibida</span><h2>Revisa tu correo</h2>
            <p>Si el correo ingresado está registrado, recibirás instrucciones para recuperar tu contraseña.</p>
            <p className="saas-confirmation-email"><strong>{recoverEmail}</strong></p>
            <button type="button" className="saas-btn-submit" onClick={goLogin}>Volver a iniciar sesión</button>
          </section>
        </main>
      )}

      {viewMode === 'onboarding' && (
        <main className="saas-centered-main saas-onboarding-main">
          <section className={`saas-login-card saas-onboarding-card ${currentStep === 4 ? 'is-plans-step' : ''}`}>
            <div className="saas-progress" aria-label={`Paso ${currentStep} de 5`}><span>Paso {currentStep} de 5</span><div><i style={{ width: `${currentStep * 20}%` }} /></div></div>

            {currentStep === 1 && <form className="saas-form" onSubmit={submitAccount} noValidate>
              <div className="card-header"><span className="saas-card-kicker">Tu cuenta</span><h2>Completa la configuración de tu cuenta</h2><p>Usaremos <strong>{onboarding.email}</strong> como correo administrador.</p></div>
              <div className="saas-field-grid">
                <label className="saas-form-group">Nombre<input className="saas-login-input" value={onboarding.nombre} onChange={updateOnboarding('nombre')} />{onboardingErrors.nombre && <span className="saas-field-error">{onboardingErrors.nombre}</span>}</label>
                <label className="saas-form-group">Apellido<input className="saas-login-input" value={onboarding.apellido} onChange={updateOnboarding('apellido')} />{onboardingErrors.apellido && <span className="saas-field-error">{onboardingErrors.apellido}</span>}</label>
              </div>
              <label className="saas-form-group">Teléfono<input className="saas-login-input" type="tel" value={onboarding.telefono} onChange={updateOnboarding('telefono')} />{onboardingErrors.telefono && <span className="saas-field-error">{onboardingErrors.telefono}</span>}</label>
              <label className="saas-form-group">Contraseña<span className="saas-input-wrapper"><input className="saas-login-input password-input" type={showAdminPassword ? 'text' : 'password'} value={onboarding.password} onChange={updateOnboarding('password')} /><button type="button" className="saas-password-toggle" onClick={() => setShowAdminPassword((value) => !value)} aria-label="Mostrar u ocultar contraseña"><EyeIcon open={showAdminPassword} /></button></span>{onboardingErrors.password && <span className="saas-field-error">{onboardingErrors.password}</span>}</label>
              <label className="saas-form-group">Confirmar contraseña<input className="saas-login-input" type="password" value={onboarding.confirmPassword} onChange={updateOnboarding('confirmPassword')} />{onboardingErrors.confirmPassword && <span className="saas-field-error">{onboardingErrors.confirmPassword}</span>}</label>
              {error && <div className="saas-alert-error" role="alert">{error}</div>}
              <button className="saas-btn-submit" type="submit">Continuar</button>
            </form>}

            {currentStep === 2 && <div className="saas-step-message"><span className="saas-step-icon">✉</span><span className="saas-card-kicker">Verifica tu correo</span><h2>Revisa tu bandeja de entrada</h2><p>Enviaremos el enlace de confirmación a <strong>{onboarding.email}</strong> cuando conectemos este flujo con el servicio de registro.</p><button className="saas-btn-submit" type="button" onClick={() => goToOnboardingStep(3)}>Continuar</button></div>}

            {currentStep === 3 && <form className="saas-form" onSubmit={submitClub} noValidate>
              <div className="card-header"><span className="saas-card-kicker">Tu organización</span><h2>Configura los datos de tu club</h2><p>Estos datos formarán la identidad inicial de tu espacio.</p></div>
              <label className="saas-form-group">Nombre del club<input className="saas-login-input" value={onboarding.clubNombre} onChange={updateOnboarding('clubNombre')} />{onboardingErrors.clubNombre && <span className="saas-field-error">{onboardingErrors.clubNombre}</span>}</label>
              <div className="saas-field-grid">
                <label className="saas-form-group">Ciudad<input className="saas-login-input" value={onboarding.clubCiudad} onChange={updateOnboarding('clubCiudad')} />{onboardingErrors.clubCiudad && <span className="saas-field-error">{onboardingErrors.clubCiudad}</span>}</label>
                <label className="saas-form-group">Teléfono<input className="saas-login-input" value={onboarding.clubTelefono} onChange={updateOnboarding('clubTelefono')} />{onboardingErrors.clubTelefono && <span className="saas-field-error">{onboardingErrors.clubTelefono}</span>}</label>
              </div>
              <label className="saas-form-group">Correo del club<input className="saas-login-input" type="email" value={onboarding.clubEmail} onChange={updateOnboarding('clubEmail')} />{onboardingErrors.clubEmail && <span className="saas-field-error">{onboardingErrors.clubEmail}</span>}</label>
              <label className="saas-form-group">Dirección <span className="optional">(opcional)</span><input className="saas-login-input" value={onboarding.clubDireccion} onChange={updateOnboarding('clubDireccion')} /></label>
              {error && <div className="saas-alert-error" role="alert">{error}</div>}<div className="saas-form-actions"><button type="button" className="saas-btn-secondary" onClick={() => goToOnboardingStep(2)}>Atrás</button><button className="saas-btn-submit" type="submit">Continuar</button></div>
            </form>}

            {currentStep === 4 && <div><div className="card-header"><span className="saas-card-kicker">Planes</span><h2>Elige un plan SaaS</h2><p>Selecciona el plan que mejor se adapta a las necesidades de tu club.</p></div>
              {plansNotice && <div className="saas-plans-notice" role="status">{plansNotice}</div>}
              {isPlansLoading ? <div className="saas-plans-loading"><span className="saas-spinner" /><strong>Cargando planes...</strong></div> : <div className="club-plans-grid saas-onboarding-plans">{availablePlans.map((plan) => {
                const isSelected = onboarding.plan === plan.codigo
                return <article key={plan.id} className={`club-plan-card ${isSelected ? 'is-current' : ''} ${plan.codigo === 'PRO' ? 'is-recommended' : ''}`}>
                  <div className="club-plan-card-top"><div>{plan.codigo === 'PRO' && <span className="club-plan-recommended">Recomendado</span>}<h3>{plan.nombre}</h3></div>{isSelected && <span className="club-plan-current-badge">Seleccionado</span>}</div>
                  <p className="club-plan-description">{plan.descripcion}</p>
                  <div className="club-plan-price">{formatPlanPrice(plan.precio_mensual)}</div>
                  <ul className="club-plan-summary"><li>{formatLimit(plan.limite_jugadores, 'jugador', 'jugadores')}</li><li>{formatLimit(plan.limite_equipos, 'equipo', 'equipos')}</li><li>{plan.incluye_ia ? 'Incluye IA' : 'Sin IA avanzada'}</li><li>{plan.incluye_reportes ? 'Incluye reportes' : 'Sin reportes'}</li><li>Soporte {plan.soporte || 'estándar'}</li></ul>
                  {Array.isArray(plan.caracteristicas) && plan.caracteristicas.length > 0 && <ul className="club-plan-features">{plan.caracteristicas.map((feature) => <li key={feature}>{feature}</li>)}</ul>}
                  <button type="button" className={isSelected ? 'saas-btn-secondary' : 'saas-btn-submit'} onClick={() => { setOnboarding((value) => ({ ...value, plan: plan.codigo, planId: plan.isFallback ? null : plan.id })); setOnboardingErrors((value) => ({ ...value, plan: '' })) }}>{isSelected ? 'Plan seleccionado' : 'Seleccionar plan'}</button>
                </article>
              })}</div>}
              {onboardingErrors.plan && <div className="saas-field-error saas-plan-error" role="alert">{onboardingErrors.plan}</div>}
              <div className="saas-form-actions"><button type="button" className="saas-btn-secondary" onClick={() => goToOnboardingStep(3)}>Atrás</button><button type="button" className="saas-btn-submit" onClick={continueToActivation} disabled={isPlansLoading}>Continuar</button></div>
            </div>}

            {currentStep === 5 && <form className="saas-form" onSubmit={submitPayment} noValidate>
              <div className="card-header"><span className="saas-card-kicker">Activación</span><h2>Activa tu plan SaaS</h2><p>Revisa la configuración antes de completar el alta.</p></div>
              <div className="saas-activation-summary"><div><span>Club</span><strong>{onboarding.clubNombre}</strong><small>{onboarding.clubCiudad} · {onboarding.clubEmail}</small></div><div><span>Plan seleccionado</span><strong>{selectedPlan?.nombre || onboarding.plan}</strong><small>{selectedPlan ? formatPlanPrice(selectedPlan.precio_mensual) : ''}</small></div></div>
              <div className="saas-payment-tabs">{[['TARJETA', 'Tarjeta'], ['QR', 'Código QR'], ['MANUAL', 'Registro manual']].map(([value, label]) => <button key={value} type="button" className={onboarding.paymentMethod === value ? 'is-selected' : ''} onClick={() => setOnboarding((state) => ({ ...state, paymentMethod: value }))}>{label}</button>)}</div>
              <div className="saas-payment-note">Opción seleccionada: <strong>{onboarding.paymentMethod === 'TARJETA' ? 'Tarjeta' : onboarding.paymentMethod === 'QR' ? 'Código QR' : 'Registro manual'}</strong>. Esta etapa es una simulación visual; no solicitamos ni almacenamos datos de pago.</div>
              {error && <div className="saas-alert-error" role="alert">{error}</div>}<div className="saas-form-actions"><button type="button" className="saas-btn-secondary" onClick={() => goToOnboardingStep(4)} disabled={isCompleting}>Atrás</button><button className="saas-btn-submit" type="submit" disabled={isCompleting}>{isCompleting ? 'Completando...' : 'Completar configuración'}</button></div>
            </form>}
          </section>
        </main>
      )}

      {viewMode === 'onboarding_success' && <main className="saas-centered-main"><section className="saas-login-card saas-success-card"><span className="saas-step-icon">✓</span><span className="saas-card-kicker">Todo listo</span><h2>Configuración completada correctamente</h2><p>El club <strong>{onboarding.clubNombre}</strong> quedó asociado al plan <strong>{selectedPlan?.nombre || onboarding.plan}</strong>. Ya puedes iniciar sesión con el correo y la contraseña usados en el onboarding.</p><button type="button" className="saas-btn-submit" onClick={() => navigate('/clubes')}>Ir a Gestión de clubes</button></section></main>}
    </div>
  )
}

export default LoginPage
