import assert from 'node:assert/strict'
import handler from '../api/handler.js'
import renderPage from '../api/render.js'
import { render } from '../dist-server/entry-server.js'

// Run with --no-experimental-require-module to match the Vercel function loader.
// Import both API entries and the built renderer: a normal local Node import
// would mask CommonJS dependencies that synchronously require ESM-only modules.
assert.equal(typeof handler, 'function')
assert.equal(typeof renderPage, 'function')
assert.equal(typeof render, 'function')
console.log('Vercel API and SSR runtime imports passed without require(ESM).')
