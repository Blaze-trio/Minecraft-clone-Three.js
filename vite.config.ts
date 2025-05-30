import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/Minecraft-clone-Three.js/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: false,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    fs: {
      strict: false
    }
  },
  worker: {
    format: 'es',
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
  resolve: {
    conditions: ['development', 'browser'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
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
