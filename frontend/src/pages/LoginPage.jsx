import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import api from '../api/axios'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const plans = [
  { code: 'BASICO', name: 'Básico', description: 'Organiza la operación esencial de tu club.' },
  { code: 'PRO', name: 'Pro', description: 'Gestión completa para clubes en crecimiento.', recommended: true },
  { code: 'ELITE', name: 'Élite', description: 'Analítica e IA para estructuras avanzadas.' },
]

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
  const [isLoading, setIsLoading] = useState(false)
  const [isRecoverLoading, setIsRecoverLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [login, setLogin] = useState({ email: '', password: '' })
  const [recoverEmail, setRecoverEmail] = useState('')
  const [onboarding, setOnboarding] = useState({
    email: '', nombre: '', apellido: '', telefono: '', password: '', confirmPassword: '',
    clubNombre: '', clubDireccion: '', clubTelefono: '', clubEmail: '', clubCiudad: '',
    plan: 'PRO', paymentMethod: 'TARJETA', cardNumber: '', cardExpiry: '', cardCvv: '',
  })

  useEffect(() => {
    if (localStorage.getItem('user')) navigate('/dashboard')
  }, [navigate])

  const updateLogin = (field) => (event) => setLogin((value) => ({ ...value, [field]: event.target.value }))
  const updateOnboarding = (field) => (event) => setOnboarding((value) => ({ ...value, [field]: event.target.value }))
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
    setOnboarding((value) => ({ ...value, email: cleanEmail, clubEmail: cleanEmail }))
    setCurrentStep(1)
    setViewMode('onboarding')
  }

  const submitAccount = (event) => {
    event.preventDefault()
    setError('')
    if (!onboarding.nombre.trim() || !onboarding.apellido.trim()) return setError('Nombre y apellido son obligatorios')
    if (!onboarding.telefono.trim()) return setError('El teléfono es obligatorio')
    if (onboarding.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres')
    if (onboarding.password !== onboarding.confirmPassword) return setError('Las contraseñas no coinciden')
    setCurrentStep(2)
  }

  const submitClub = (event) => {
    event.preventDefault()
    setError('')
    if (!onboarding.clubNombre.trim()) return setError('El nombre del club es obligatorio')
    if (!onboarding.clubTelefono.trim()) return setError('El teléfono del club es obligatorio')
    if (!emailPattern.test(onboarding.clubEmail.trim())) return setError('Ingrese un correo de club válido')
    if (!onboarding.clubCiudad.trim()) return setError('La ciudad es obligatoria')
    setCurrentStep(4)
  }

  const submitPayment = (event) => {
    event.preventDefault()
    setError('')
    if (onboarding.paymentMethod === 'TARJETA' && (!onboarding.cardNumber.trim() || !onboarding.cardExpiry.trim() || !onboarding.cardCvv.trim())) {
      return setError('Complete los datos de la tarjeta')
    }
    setViewMode('onboarding_success')
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
          <section className="saas-login-card saas-onboarding-card">
            <div className="saas-progress" aria-label={`Paso ${currentStep} de 5`}><span>Paso {currentStep} de 5</span><div><i style={{ width: `${currentStep * 20}%` }} /></div></div>

            {currentStep === 1 && <form className="saas-form" onSubmit={submitAccount} noValidate>
              <div className="card-header"><span className="saas-card-kicker">Tu cuenta</span><h2>Completa la configuración de tu cuenta</h2><p>Usaremos <strong>{onboarding.email}</strong> como correo administrador.</p></div>
              <div className="saas-field-grid"><label className="saas-form-group">Nombre<input className="saas-login-input" value={onboarding.nombre} onChange={updateOnboarding('nombre')} /></label><label className="saas-form-group">Apellido<input className="saas-login-input" value={onboarding.apellido} onChange={updateOnboarding('apellido')} /></label></div>
              <label className="saas-form-group">Teléfono<input className="saas-login-input" type="tel" value={onboarding.telefono} onChange={updateOnboarding('telefono')} /></label>
              <label className="saas-form-group">Contraseña<span className="saas-input-wrapper"><input className="saas-login-input password-input" type={showAdminPassword ? 'text' : 'password'} value={onboarding.password} onChange={updateOnboarding('password')} /><button type="button" className="saas-password-toggle" onClick={() => setShowAdminPassword((value) => !value)} aria-label="Mostrar u ocultar contraseña"><EyeIcon open={showAdminPassword} /></button></span></label>
              <label className="saas-form-group">Confirmar contraseña<input className="saas-login-input" type="password" value={onboarding.confirmPassword} onChange={updateOnboarding('confirmPassword')} /></label>
              {error && <div className="saas-alert-error" role="alert">{error}</div>}<button className="saas-btn-submit" type="submit">Continuar</button>
            </form>}

            {currentStep === 2 && <div className="saas-step-message"><span className="saas-step-icon">✉</span><span className="saas-card-kicker">Verifica tu correo</span><h2>Revisa tu bandeja de entrada</h2><p>Enviaremos el enlace de confirmación a <strong>{onboarding.email}</strong> cuando conectemos este flujo con el servicio de registro.</p><button className="saas-btn-submit" type="button" onClick={() => setCurrentStep(3)}>Continuar</button></div>}

            {currentStep === 3 && <form className="saas-form" onSubmit={submitClub} noValidate>
              <div className="card-header"><span className="saas-card-kicker">Tu organización</span><h2>Configura los datos de tu club</h2><p>Estos datos formarán la identidad inicial de tu espacio.</p></div>
              <label className="saas-form-group">Nombre del club<input className="saas-login-input" value={onboarding.clubNombre} onChange={updateOnboarding('clubNombre')} /></label>
              <div className="saas-field-grid"><label className="saas-form-group">Ciudad<input className="saas-login-input" value={onboarding.clubCiudad} onChange={updateOnboarding('clubCiudad')} /></label><label className="saas-form-group">Teléfono<input className="saas-login-input" value={onboarding.clubTelefono} onChange={updateOnboarding('clubTelefono')} /></label></div>
              <label className="saas-form-group">Correo del club<input className="saas-login-input" type="email" value={onboarding.clubEmail} onChange={updateOnboarding('clubEmail')} /></label>
              <label className="saas-form-group">Dirección <span className="optional">(opcional)</span><input className="saas-login-input" value={onboarding.clubDireccion} onChange={updateOnboarding('clubDireccion')} /></label>
              {error && <div className="saas-alert-error" role="alert">{error}</div>}<div className="saas-form-actions"><button type="button" className="saas-btn-secondary" onClick={() => setCurrentStep(2)}>Atrás</button><button className="saas-btn-submit" type="submit">Continuar</button></div>
            </form>}

            {currentStep === 4 && <div><div className="card-header"><span className="saas-card-kicker">Planes</span><h2>Elige un plan SaaS</h2><p>Podrás cambiarlo más adelante según crezca tu club.</p></div><div className="saas-plans-grid">{plans.map((plan) => <button key={plan.code} type="button" className={`saas-plan-card ${onboarding.plan === plan.code ? 'is-selected' : ''}`} onClick={() => setOnboarding((value) => ({ ...value, plan: plan.code }))}>{plan.recommended && <small>Recomendado</small>}<strong>{plan.name}</strong><span>{plan.description}</span></button>)}</div><div className="saas-form-actions"><button type="button" className="saas-btn-secondary" onClick={() => setCurrentStep(3)}>Atrás</button><button type="button" className="saas-btn-submit" onClick={() => setCurrentStep(5)}>Continuar</button></div></div>}

            {currentStep === 5 && <form className="saas-form" onSubmit={submitPayment} noValidate>
              <div className="card-header"><span className="saas-card-kicker">Activación</span><h2>Activa tu plan SaaS</h2><p>Seleccionaste el plan <strong>{onboarding.plan}</strong>.</p></div>
              <div className="saas-payment-tabs">{[['TARJETA', 'Tarjeta'], ['QR', 'Código QR'], ['MANUAL', 'Registro manual']].map(([value, label]) => <button key={value} type="button" className={onboarding.paymentMethod === value ? 'is-selected' : ''} onClick={() => setOnboarding((state) => ({ ...state, paymentMethod: value }))}>{label}</button>)}</div>
              {onboarding.paymentMethod === 'TARJETA' && <><label className="saas-form-group">Número de tarjeta<input className="saas-login-input" inputMode="numeric" value={onboarding.cardNumber} onChange={updateOnboarding('cardNumber')} placeholder="0000 0000 0000 0000" /></label><div className="saas-field-grid"><label className="saas-form-group">Vencimiento<input className="saas-login-input" value={onboarding.cardExpiry} onChange={updateOnboarding('cardExpiry')} placeholder="MM/AA" /></label><label className="saas-form-group">CVV<input className="saas-login-input" inputMode="numeric" value={onboarding.cardCvv} onChange={updateOnboarding('cardCvv')} placeholder="123" /></label></div></>}
              {onboarding.paymentMethod !== 'TARJETA' && <div className="saas-payment-note">La integración de {onboarding.paymentMethod === 'QR' ? 'pago por QR' : 'activación manual'} quedará disponible al conectar el servicio de pagos.</div>}
              {error && <div className="saas-alert-error" role="alert">{error}</div>}<div className="saas-form-actions"><button type="button" className="saas-btn-secondary" onClick={() => setCurrentStep(4)}>Atrás</button><button className="saas-btn-submit" type="submit">Completar configuración</button></div>
            </form>}
          </section>
        </main>
      )}

      {viewMode === 'onboarding_success' && <main className="saas-centered-main"><section className="saas-login-card saas-success-card"><span className="saas-step-icon">✓</span><span className="saas-card-kicker">Todo listo</span><h2>Configuración completada</h2><p>Tu espacio de <strong>{onboarding.clubNombre}</strong> está preparado para conectarse al servicio de registro.</p><button type="button" className="saas-btn-submit" onClick={goLogin}>Ir a iniciar sesión</button></section></main>}
    </div>
  )
}

export default LoginPage
