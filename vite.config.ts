import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to https://egorvas.github.io/abc-quest/
export default defineConfig({
  plugins: [react()],
  base: '/abc-quest/',
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
})
