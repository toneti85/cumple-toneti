import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/cumple-toneti/', // 👈 cambia por tu repo real
})
