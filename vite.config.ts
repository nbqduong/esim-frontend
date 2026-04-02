import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
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
        // Silence deprecation warnings from Bootstrap 5.3's own SCSS
        // (Bootstrap hasn't migrated to @use yet - planned for v6)
        silenceDeprecations: [
          'import',
          'global-builtin',
          'color-functions',
          'if-function',
          'function-units',
        ],
      },
    },
  },
})
