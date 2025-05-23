import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    headers: {
      'Cross-Origin-Embedder-Policy': 'cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    fs: {
      strict: false
    }
  },
  optimizeDeps: {
    force: true,
    include: [
      'three',
      'simplex-noise',
      'react',
      'react-dom',
      '@react-three/fiber',
      '@react-three/drei'
    ],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  build: {
    target: 'es2020',
    commonjsOptions: {
      include: [/three/, /node_modules/]
    },
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  },
  define: {
    global: 'globalThis'
  }
})
