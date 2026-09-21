import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': '/src' },
  },
  server: {
    allowedHosts: ['primexpc.com', 'www.primexpc.com', 'localhost'],
  },
  preview: {
    allowedHosts: ['primexpc.com', 'www.primexpc.com', 'localhost'],
  },
})
