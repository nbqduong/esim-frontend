import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/demoui/',
  envDir: '../',
  plugins: [
    vue(),
    {
      name: 'wasm-mime-fix',
      configureServer(server: import('vite').ViteDevServer) {
        server.middlewares.use((req, res, next) => {
          if (req.url?.includes('/wasm/') && req.url.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript')
          }
          next()
        })
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@assets': fileURLToPath(new URL('./src/assets', import.meta.url)),
      '@views': fileURLToPath(new URL('./src/views', import.meta.url))
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: ['node_modules'],
        quietDeps: true,
        silenceDeprecations: [
          'import',
          'global-builtin',
          'color-functions',
          'function-units',
          'if-function',
        ],
      },
    },
  },
})
