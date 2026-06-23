import { BrowserRouter } from 'react-router-dom'
import { useState, useEffect } from 'react'

import AppRoutes from './routes/AppRoutes'

function App() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <BrowserRouter>
      {isOffline && (
        <div style={{ backgroundColor: '#ef4444', color: 'white', textAlign: 'center', padding: '4px', fontSize: '14px', zIndex: 9999, position: 'relative' }}>
          Modo offline. Mostrando datos guardados.
        </div>
      )}
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
