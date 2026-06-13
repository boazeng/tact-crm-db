import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dedicated ports for TACT-CRM (the user runs several projects at once).
// strictPort: fail loudly instead of silently hopping to another port.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5200,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8010',
        changeOrigin: true,
      },
    },
  },
})
