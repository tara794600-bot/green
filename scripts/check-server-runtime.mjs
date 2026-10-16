import assert from 'node:assert/strict'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import handler from '../api/handler.js'
import renderPage from '../api/render.js'
import { render } from '../dist-server/entry-server.js'
import { testDocument } from '../tests/fixtures/company-document.mjs'

// Vercel 함수 로더 조건에 맞춰 --no-experimental-require-module 옵션으로 실행합니다.
// 일반 로컬 Node에서는 놓칠 수 있는 CommonJS → ESM 직접 로딩 오류를 API·SSR 양쪽에서 잡습니다.
assert.equal(typeof handler, 'function')
assert.equal(typeof renderPage, 'function')
assert.equal(typeof render, 'function')

// 파일 추적이 생성된 require 별칭을 놓쳐도 동작하도록 SSR 번들은 자체 의존성을 포함해야 합니다.
// 프로젝트 node_modules와 분리된 임시 경로에서 실제 문서 렌더링까지 확인합니다.
const temporaryRoot = resolve(tmpdir())
const isolated = await mkdtemp(join(temporaryRoot, 'naran-ssr-check-'))
try {
  await cp(new URL('../dist-server/', import.meta.url), join(isolated, 'dist-server'), {
    recursive: true,
  })
  await writeFile(join(isolated, 'package.json'), '{"type":"module"}')
  const standalone = await import(pathToFileURL(join(isolated, 'dist-server/entry-server.js')).href)
  assert.equal(typeof standalone.render, 'function')
  const html = standalone.render('/companies/runtime-check', {
    articles: [],
    settings: { phone: '1551-7202' },
    rollingCases: [],
    companies: [],
    selectedCompany: {
      id: 'runtime-check',
      name: 'Runtime check',
      description: 'Isolated server rendering',
      visibility: 'public',
      image: '/images/lawyer-seo.webp',
      document: testDocument,
    },
  })
  assert.match(html, /<h2>상세 안내<\/h2>/)
  assert.match(html, /<strong>HTML 안내<\/strong>/)
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
} finally {
  assert.equal(dirname(isolated), temporaryRoot)
  assert(basename(isolated).startsWith('naran-ssr-check-'))
  await rm(isolated, { recursive: true, force: true })
}
console.log('Vercel API and isolated SSR runtime imports passed without require(ESM).')
