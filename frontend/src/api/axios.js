import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
})

// Interceptor para agregar token si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Si es GET y es exitoso, guardar en cache localStorage
    if (response.config.method === 'get') {
      try {
        const cacheKey = `cache_${response.config.url}`;
        localStorage.setItem(cacheKey, JSON.stringify(response.data));
      } catch (e) {
        console.warn('No se pudo cachear la respuesta');
      }
    }
    
    // Si la red volvió y hay pending actions, intentar sincronizar
    // Esto es muy básico y en un escenario real se usaría un sistema más robusto
    if (navigator.onLine) {
      try {
        const pending = JSON.parse(localStorage.getItem('pendingActions') || '[]');
        if (pending.length > 0) {
          // Solo logueamos por ahora para no bloquear el hilo o hacer llamadas infinitas
          console.log('Tienes acciones pendientes. Intenta refrescar o realizar la acción de nuevo.');
        }
      } catch (e) {}
    }
    
    return response;
  },
  (error) => {
    // Si no hay internet o error de red (no 4xx/5xx del servidor)
    if (!navigator.onLine || error.message === 'Network Error') {
      const { config } = error;
      
      if (config.method === 'get') {
        const cacheKey = `cache_${config.url}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
          return Promise.resolve({
            data: JSON.parse(cachedData),
            status: 200,
            statusText: 'OK (Cached)',
            headers: {},
            config
          });
        }
      } else {
        // Es un POST, PUT, DELETE. Guardar en pendingActions
        try {
          const pending = JSON.parse(localStorage.getItem('pendingActions') || '[]');
          pending.push({
            method: config.method,
            url: config.url,
            data: config.data
          });
          localStorage.setItem('pendingActions', JSON.stringify(pending));
          
          // Falsificar una respuesta exitosa básica para que la UI no se rompa
          return Promise.resolve({
            data: { mensaje: 'Acción guardada offline', offline: true },
            status: 200,
            statusText: 'OK (Offline Pending)',
            headers: {},
            config
          });
        } catch (e) {
          console.error('Error guardando acción offline', e);
        }
      }
    }
    return Promise.reject(error);
  }
)

export default api
