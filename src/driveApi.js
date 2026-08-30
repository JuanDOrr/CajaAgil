// driveApi.js
//
// Operaciones de bajo nivel contra la Google Drive API (REST v3),
// usando fetch directamente (no requiere instalar el SDK de Google).

import { obtenerAccessToken } from './googleAuth.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// Busca la carpeta "eventos" que crea esta app (por su nombre).
// Como usamos el scope drive.file, esta app solo ve archivos/carpetas
// que ella misma creó — no busca en todo el Drive del usuario.
export async function obtenerOCrearCarpetaEventos() {
  const token = await obtenerAccessToken();

  const busqueda = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(
      "name='eventos_sistema_gestion' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then((r) => r.json());

  if (busqueda.files?.length > 0) {
    return busqueda.files[0].id;
  }

  // No existe todavía: crearla
  const nuevaCarpeta = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'eventos_sistema_gestion',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  }).then((r) => r.json());

  return nuevaCarpeta.id;
}

// Sube un lote de eventos como un archivo JSON nuevo dentro de la
// carpeta de eventos. Cada sincronización crea un archivo distinto —
// nunca sobrescribimos, así nunca hay riesgo de corromper el historial.
export async function subirLoteEventos(carpetaId, nombreArchivo, eventos) {
  const token = await obtenerAccessToken();

  const metadata = {
    name: nombreArchivo,
    parents: [carpetaId],
    mimeType: 'application/json',
  };

  const boundary = '-------sistema_gestion_boundary';
  const cuerpoMultipart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: application/json\r\n\r\n' +
    JSON.stringify(eventos) +
    `\r\n--${boundary}--`;

  const respuesta = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: cuerpoMultipart,
    }
  ).then((r) => r.json());

  return respuesta.id;
}

// Lista todos los archivos de eventos en la carpeta, ordenados por
// fecha de creación (para poder aplicar los nuevos en orden).
export async function listarLotesEventos(carpetaId) {
  const token = await obtenerAccessToken();

  const respuesta = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(
      `'${carpetaId}' in parents and trashed=false`
    )}&fields=files(id,name,createdTime)&orderBy=createdTime`,
    { headers: { Authorization: `Bearer ${token}` } }
  ).then((r) => r.json());

  return respuesta.files ?? [];
}

// Descarga el contenido de un archivo de eventos por su id.
export async function descargarLoteEventos(fileId) {
  const token = await obtenerAccessToken();

  const respuesta = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return respuesta.json();
}
