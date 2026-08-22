import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5273,
    strictPort: true,
  },
  preview: {
    port: 5274,
    strictPort: true,
  },
})
