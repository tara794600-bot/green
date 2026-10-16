import { createServer } from 'vite'
import { resolve } from 'node:path'
process.env.LOCAL_DATA_FILE = resolve(`.local/e2e-${Date.now()}.json`)
delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON
delete process.env.ADMIN_PASSWORD_HASH
const server = await createServer({
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  mode: 'test',
})
// Vite가 .env 파일을 로드한 뒤 키를 다시 제거해야 E2E가 실제 DB·외부 전송을 사용하지 않습니다.
for (const name of [
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'ADMIN_PASSWORD_HASH',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'GOOGLE_SHEET_ID',
  'GOOGLE_SERVICE_ACCOUNT_JSON',
  'POWERLINK_URL_SECRET',
  'POWERLINK_BASE_URL',
  'POWERLINK_PATH_PREFIX',
])
  delete process.env[name]
process.env.SITE_URL = 'http://127.0.0.1:5174'
await server.listen()
server.printUrls()
