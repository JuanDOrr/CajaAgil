// googleAuth.js
//
// Maneja el login OAuth con Google usando la librería oficial
// "Google Identity Services" (GIS), cargada directamente vía <script>
// en index.html (no necesita instalarse con npm).
//
// En tu index.html agrega, dentro de <head>:
// <script src="https://accounts.google.com/gsi/client" async defer></script>

const CLIENT_ID = '576318074421-ieojt9shn7q3vidjqicbrekncq383kkl.apps.googleusercontent.com';
// El scope 'drive.file' solo da acceso a archivos creados por esta app.
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient = null;
let accessToken = null;
let tokenExpiraEn = 0;

// Inicializa el cliente de token OAuth. Llamar una vez al arrancar la app.
export function inicializarGoogleAuth() {
  return new Promise((resolve, reject) => {
    if (!window.google) {
      reject(new Error('Google Identity Services no cargó. Revisa el <script> en index.html.'));
      return;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '', // se asigna dinámicamente en cada solicitud, ver abajo
    });

    resolve();
  });
}

// Pide (o renueva) el access token. Si ya hay uno vigente, lo reutiliza
// sin volver a mostrar el popup de Google al usuario.
export function obtenerAccessToken() {
  return new Promise((resolve, reject) => {
    const ahora = Date.now();

    if (accessToken && ahora < tokenExpiraEn) {
      resolve(accessToken);
      return;
    }

    if (!tokenClient) {
      reject(new Error('Google Auth no inicializado. Llama primero a inicializarGoogleAuth().'));
      return;
    }

    tokenClient.callback = (respuesta) => {
      if (respuesta.error) {
        reject(new Error(`Error de autenticación con Google: ${respuesta.error}`));
        return;
      }

      accessToken = respuesta.access_token;
      // expires_in viene en segundos; restamos un margen de 60s de seguridad.
      tokenExpiraEn = Date.now() + (respuesta.expires_in - 60) * 1000;
      resolve(accessToken);
    };

    // prompt: '' intenta renovar en silencio si ya autorizó antes;
    // si nunca ha autorizado, igual mostrará el popup de consentimiento.
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function estaAutenticado() {
  return accessToken !== null && Date.now() < tokenExpiraEn;
}

export function cerrarSesionGoogle() {
  if (accessToken) {
    window.google?.accounts.oauth2.revoke(accessToken);
  }
  accessToken = null;
  tokenExpiraEn = 0;
}
