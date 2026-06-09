import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Own port, so it does not collide with other local Vite servers on the default 5173.
  // strictPort evita que Vite salte a otro puerto en silencio si el 5180 está ocupado.
  server: {
    // host: true → escucha en 0.0.0.0 (toda la red local), no solo en localhost,
    // para poder abrir el sitio desde otros dispositivos (móvil) y desde la IP.
    host: true,
    port: 5180,
    strictPort: true,
  },
  preview: {
    port: 5181,
    strictPort: true,
  },
})
