import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import api from '../api/axios'

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (!email.trim() || !password.trim()) {
      setError('Ingresa email y password.')
      return
    }

    setIsLoading(true)

    try {
      const response = await api.post('/auth/login/', {
        email: email.trim(),
        password,
      })

      localStorage.setItem('user', JSON.stringify(response.data.user))
      navigate('/dashboard')
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'No se pudo iniciar sesion. Revisa tus datos.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login-screen">
      <section className="login-hero" aria-label="TalentAI Sports">
        <div className="login-brand">
          <span className="brand-mark brand-mark-large">TS</span>
          <div>
            <p className="eyebrow eyebrow-light">Plataforma SaaS</p>
            <h1>TalentAI Sports</h1>
          </div>
        </div>
        <p className="login-copy">Gestion inteligente de clubes deportivos.</p>
        <div className="login-highlights">
          <span>Clubes</span>
          <span>Equipos</span>
          <span>Jugadores</span>
          <span>Analitica</span>
        </div>
      </section>

      <section className="login-card">
        <p className="eyebrow">Acceso seguro</p>
        <h2>Iniciar sesion</h2>
        <p>Ingresa con tu usuario para continuar al panel de gestion.</p>

        <form className="form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="coordinador@talentai.com"
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="admin123"
              autoComplete="current-password"
            />
          </label>

          {error && <p className="alert-error">{error}</p>}

          <button type="submit" className="button-primary button-wide" disabled={isLoading}>
            {isLoading ? 'Ingresando...' : 'Iniciar sesion'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
