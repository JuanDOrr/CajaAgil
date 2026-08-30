// vite.config.js
//
// Instalación necesaria: npm install -D vite-plugin-pwa
//
// Este plugin genera automáticamente:
// - El manifest.json (para que el navegador pueda "instalar" la app)
// - El service worker (usando Workbox por debajo) para que la app y
//   sus archivos funcionen sin conexión.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate': cuando publiques una nueva versión, el service
      // worker la descarga en segundo plano y se activa en la
      // siguiente vez que el usuario recarga — sin pasos manuales.
      registerType: 'autoUpdate',

      manifest: {
        name: 'CajaÁgil',
        short_name: 'CajaÁgil',
        description: 'Inventario, ventas, fiado y reportes para pequeños negocios',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        display: 'standalone', // se ve como app nativa, sin barra del navegador
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable', // para que se vea bien recortado en Android
          },
        ],
      },

      workbox: {
        // Precachea todos los archivos de la app (JS, CSS, HTML) para
        // que carguen instantáneamente incluso sin conexión.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Estrategia para llamadas a la Google Drive API: nunca se
        // cachean (los datos de sincronización deben ser siempre
        // frescos, y de todas formas solo se llaman cuando hay
        // conexión real).
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
        ],
      },

      devOptions: {
        // Permite probar el service worker también en modo desarrollo
        // (npm run dev), no solo en el build final.
        enabled: true,
      },
    }),
  ],
});
