import react from '@vitejs/plugin-react'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const postcssBrowserOptionals: Plugin = {
  // PostCSS의 브라우저 비활성 모듈은 빈 모듈로 대체합니다.
  // 인라인 스타일 파서가 Node 기능 유무를 확인할 때 Vite의 경고 프록시를 읽지 않도록 합니다.
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
  // 서버 API용 키도 Node 환경에 로드합니다. 클라이언트용 VITE_ 접두사를 붙이지 마세요.
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
            // 개발 서버에서만 동적으로 로드합니다. 이 모듈을 클라이언트 코드에서 import하지 않습니다.
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
    // SSR 의존성을 번들에 포함해 Vercel 파일 추적 누락과 CommonJS/ESM 로딩 오류를 방지합니다.
    // 변경 시 check-server-runtime.mjs의 격리 실행 검사를 반드시 확인하세요.
    ssr: { noExternal: true },
  }
})
