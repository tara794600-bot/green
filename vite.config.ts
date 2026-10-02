import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const postcssBrowserOptionals: Plugin = {
  // These are disabled by PostCSS's browser map; use an empty module instead
  // of Vite's warning proxy when the inline-style parser probes availability.
  name: 'postcss-browser-optionals',
  enforce: 'pre',
  resolveId(source, importer, options) {
    if (
      !options.ssr &&
      importer?.replaceAll('\\', '/').includes('/node_modules/postcss/') &&
      ['path', 'url', 'fs', 'source-map-js'].includes(source)
    )
      return '\0postcss-browser-empty'
  },
  load(id) {
    if (id === '\0postcss-browser-empty') return 'export default {}'
  },
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)
  return {
    plugins: [
      react(),
      postcssBrowserOptionals,
      {
        name: 'naran-local-api',
        configureServer(server) {
          process.env.LOCAL_PREVIEW = 'true'
          server.middlewares.use('/api', async (req, res) => {
            req.url = '/api' + req.url
            // Server-only module. Never included in the client bundle.
            const file = pathToFileURL(resolve('server/handler.mjs')).href
            const { default: handler } = await import(/* @vite-ignore */ file)
            await handler(req, res)
          })
        },
      },
    ],
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
    optimizeDeps: { rolldownOptions: { plugins: [postcssBrowserOptionals] } },
    build: { chunkSizeWarningLimit: 600 },
  }
})
