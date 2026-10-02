import assert from 'node:assert/strict'
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import handler from '../api/handler.js'
import renderPage from '../api/render.js'
import { render } from '../dist-server/entry-server.js'
import { testDocument } from '../tests/fixtures/company-document.mjs'

// Run with --no-experimental-require-module to match the Vercel function loader.
// Import both API entries and the built renderer: a normal local Node import
// would mask CommonJS dependencies that synchronously require ESM-only modules.
assert.equal(typeof handler, 'function')
assert.equal(typeof renderPage, 'function')
assert.equal(typeof render, 'function')

// The deployed renderer must also work without the repository's node_modules.
// Generated require aliases are not necessarily followed by file tracing.
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
