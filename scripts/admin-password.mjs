import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { readFile, writeFile } from 'node:fs/promises'
import { hashPassword } from '../server/auth.mjs'

// 입력 에코를 막아 비밀번호가 터미널에 남지 않게 하고, 파일에는 해시만 저장합니다.
let muted = false
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding)
    callback()
  },
})
const rl = createInterface({ input: process.stdin, output, terminal: true })
async function ask(prompt) {
  process.stdout.write(prompt)
  muted = true
  const answer = await new Promise((resolve) => rl.question('', resolve))
  muted = false
  process.stdout.write('\n')
  return answer
}
try {
  const password = await ask('새 관리자 비밀번호 (8~128자): '),
    confirm = await ask('비밀번호 확인: ')
  if (password.length < 8 || password.length > 128) throw new Error('비밀번호 길이는 8~128자여야 합니다.')
  if (password !== confirm) throw new Error('두 비밀번호가 일치하지 않습니다.')
  let env = ''
  try {
    env = await readFile('.env.local', 'utf8')
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
  }
  // 기존 .env.local의 다른 설정은 보존합니다. 배포 환경변수 반영은 별도로 수행해야 합니다.
  const setting = `ADMIN_PASSWORD_HASH=${hashPassword(password)}`
  env = /^ADMIN_PASSWORD_HASH=.*$/m.test(env)
    ? env.replace(/^ADMIN_PASSWORD_HASH=.*$/m, setting)
    : env.trimEnd() + '\n' + setting + '\n'
  await writeFile('.env.local', env, { mode: 0o600 })
  console.log('암호화된 비밀번호를 .env.local에 저장했습니다. 서버를 재시작해 주세요.')
} catch (e) {
  console.error(e.message)
  process.exitCode = 1
} finally {
  rl.close()
}
