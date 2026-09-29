type Visit = { landingPath: string; queryString: string; referrer: string; capturedAt: number }
let fallback: Visit | null = null
export function captureVisit(prefix = '/p/') {
  if (typeof window === 'undefined' || window.location.pathname.startsWith('/admin')) return
  let previous = fallback
  try {
    previous = JSON.parse(sessionStorage.getItem('naran-visit') || 'null') || previous
  } catch {
    /* private browsing */
  }
  const params = new URLSearchParams(window.location.search)
  const campaign =
    window.location.pathname.startsWith(prefix) ||
    ['n_keyword', 'n_query', 'NaPm', 'gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_term'].some((key) =>
      params.has(key),
    )
  if (
    previous &&
    Date.now() - previous.capturedAt < 30 * 60 * 1000 &&
    (!campaign ||
      (previous.landingPath === window.location.pathname && previous.queryString === window.location.search))
  ) {
    fallback = previous
    return
  }
  fallback = {
    landingPath: window.location.pathname.slice(0, 1000),
    queryString: window.location.search.slice(0, 2000),
    referrer: document.referrer.slice(0, 1000),
    capturedAt: Date.now(),
  }
  try {
    sessionStorage.setItem('naran-visit', JSON.stringify(fallback))
  } catch {
    /* retain in memory */
  }
}
export function visitFields() {
  if (!fallback) captureVisit()
  return {
    landingPath: fallback?.landingPath || '/',
    queryString: fallback?.queryString || '',
    referrer: fallback?.referrer || '',
  }
}
