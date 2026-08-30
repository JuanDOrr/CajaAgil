import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './tokens.css'
import App from './App.jsx'
import { inicializarGoogleAuth } from './googleAuth.js';
import { activarSincronizacionAutomatica } from './sincronizacion.js';

inicializarGoogleAuth()
  .then(() => console.log('Google Auth listo'))
  .catch((error) => console.error('Error al inicializar Google Auth:', error));

activarSincronizacionAutomatica();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
