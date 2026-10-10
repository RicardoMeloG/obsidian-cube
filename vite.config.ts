import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Puerto propio para no chocar con otros proyectos que usan el 5173 por defecto.
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
