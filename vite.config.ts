import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)
  return {
    plugins: [
      react(),
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
    build: { chunkSizeWarningLimit: 600 },
  }
})
