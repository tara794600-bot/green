// 서버 HTML(SSR)과 브라우저 화면이 같은 제목·설명·색인 규칙을 쓰도록 페이지 메타정보를 한곳에서 계산합니다.
// API 함수에서도 불러오므로 HTML 처리 라이브러리를 import하지 않는 순수 함수로 유지합니다.
export const SITE_NAME = '법무법인 나란'
export const DEFAULT_IMAGE = '/images/consultation.png'
export const DEFAULT_DESCRIPTION =
  '당신의 회복에, 법률로 나란히. 법무법인 나란의 금융사기 피해 상담, 분야별 안내와 상담 준비 가이드.'
export const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
export const ROBOTS_NOINDEX = 'noindex, nofollow'
// 내부 검색 결과는 색인하지 않되 결과 속 상세페이지 링크는 따라가게 합니다.
export const ROBOTS_SEARCH = 'noindex, follow'

export const pageNames = {
  '/': '당신의 회복에, 법률로 나란히.',
  '/about': '나란 소개',
  '/practice': '업무 분야',
  '/cases': '사례 안내',
  '/companies': '사기업체 정보',
  '/guides': '소식·가이드',
  '/lawyers': '담당 변호사',
  '/faq': '자주 묻는 질문',
  '/contact': '오시는 길',
  '/privacy': '개인정보 처리 안내',
  '/consultation': '상담 신청',
}
const pageDescriptions = {
  '/about': '법무법인 나란 소개. 금융사기 피해 상황을 함께 정리하고 필요한 법률 절차를 안내합니다.',
  '/practice':
    '투자·리딩방 사기, 출금 거부 거래소, 유사수신·다단계, 코인·가상자산 사기 등 법무법인 나란의 업무 분야를 안내합니다.',
  '/cases': '금융사기 상담 사례 안내. 비슷한 상황을 통해 내 사건에서 확인할 쟁점을 찾아보세요.',
  '/companies': '업체명이나 피해 유형으로 등록된 업체 정보를 확인하고, 관련 피해 상담을 신청하세요.',
  '/guides': '금융사기 피해 대응과 상담 준비에 도움이 되는 소식과 가이드.',
  '/lawyers': '법무법인 나란의 담당 변호사를 소개합니다.',
  '/faq': '금융사기 피해 상담에 대해 자주 묻는 질문과 답변을 확인하세요.',
  '/privacy': '법무법인 나란 개인정보 처리 안내.',
  '/consultation': '금융사기 피해 상담 신청. 현재 상황을 남겨 주시면 확인 후 연락드립니다.',
}
const sectionPaths = { practice: 'practice', case: 'cases', guide: 'guides', lawyer: 'lawyers' }
const sectionKinds = { practice: 'practice', cases: 'case', guides: 'guide', lawyers: 'lawyer' }
export const sectionNames = {
  practice: '업무 분야',
  case: '사례 안내',
  guide: '소식·가이드',
  lawyer: '담당 변호사',
}
export const articlePath = (article) =>
  sectionPaths[article.kind] ? `/${sectionPaths[article.kind]}/${article.id}` : `/faq#${article.id}`
export const companyPath = (company) => `/companies/${company.id}`

const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' }
// 검색 설명·피드 요약용 텍스트입니다. 문단 경계만 띄우고 굵게·색상 같은 글자 서식은 붙여 씁니다.
export function plainText(html = '') {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(
      /<\/?(?:p|div|br|hr|h[1-6]|li|ul|ol|blockquote|pre|table|tr|td|th|figure|figcaption|section|a\s+data-type)\b[^>]*>/gi,
      ' ',
    )
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name) => entities[name])
    .replace(/\s+/g, ' ')
    .trim()
}
// 이전 블록 형식(마크다운·HTML)도 기호를 걷어내 요약에 사용합니다.
export function documentText(document) {
  if (!document) return ''
  if (typeof document.html === 'string') return plainText(document.html)
  return plainText(
    (document.blocks || [])
      .filter((b) => !['image', 'divider', 'mermaid'].includes(b.type))
      .map((b) => [b.content, b.caption].join(' ').replace(/[#*>`|_~-]+|\[(.*?)\]\(.*?\)/g, ' $1 '))
      .join(' '),
  )
}
export function summarize(text, max = 160) {
  const value = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (value.length <= max) return value
  const cut = value.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…'
}
// 업체명과 관리자가 입력한 유형만 사용합니다. 제목에 없는 판단을 덧붙이지 않습니다.
export const companyTitle = (company) =>
  company.visibility === 'phone'
    ? `${company.name} 전화 상담 안내`
    : company.service
      ? `${company.name} - ${company.service} 정보`
      : company.name
export const fullTitle = (title) => (title ? `${title} | ${SITE_NAME}` : SITE_NAME)
export function companyDescription(company, settings = {}) {
  if (company.visibility === 'phone')
    return `${company.name} 관련 내용은 전화 상담으로 안내해 드립니다.${settings.phone ? ` 대표전화 ${settings.phone}` : ''}`
  return summarize([company.description, documentText(company.document)].filter(Boolean).join(' '))
}

const home = { name: '홈', path: '/' }
/**
 * 경로와 공개 데이터로 페이지 메타정보를 만듭니다. status 404는 서버 응답 코드와 noindex에 사용합니다.
 * 브라우저 내부 이동에서 아직 불러오지 않은 업체는 404로 단정하지 않고 기본 업체 정보로 둡니다.
 */
export function pageMeta(pathname, search, data) {
  const params = new URLSearchParams(search || '')
  const parts = pathname.split('/').filter(Boolean)
  const settings = data.settings || {}
  const base = {
    status: 200,
    title: '',
    description: DEFAULT_DESCRIPTION,
    robots: ROBOTS_INDEX,
    canonicalPath: pathname,
    type: 'website',
    image: DEFAULT_IMAGE,
    imageAlt: SITE_NAME,
    publishedAt: '',
    modifiedAt: '',
    section: '',
    breadcrumbs: [],
    company: null,
    article: null,
  }
  const notFound = {
    ...base,
    status: 404,
    title: fullTitle('페이지를 찾을 수 없습니다.'),
    robots: ROBOTS_NOINDEX,
    canonicalPath: '',
  }
  if (pathname === '/admin' || pathname.startsWith('/admin/'))
    return { ...base, title: fullTitle('관리자'), robots: ROBOTS_NOINDEX, canonicalPath: '' }
  // 광고 전용 주소는 키워드를 보여주되 검색 결과에는 남기지 않습니다.
  if (pathname.startsWith(data.powerlinkPrefix || '/p/') && parts.length === 2)
    return data.landing
      ? { ...base, title: fullTitle(data.landing.keyword), robots: ROBOTS_NOINDEX, canonicalPath: '' }
      : data.landing === null
        ? notFound
        : { ...base, title: fullTitle('나란 상담 안내'), robots: ROBOTS_NOINDEX, canonicalPath: '' }
  if (parts[0] === 'companies' && parts.length === 2) {
    const company =
      data.selectedCompany?.id === parts[1]
        ? data.selectedCompany
        : data.companies?.find((c) => c.id === parts[1])
    if (!company)
      return data.selectedCompany === null ? notFound : { ...base, title: fullTitle(pageNames['/companies']) }
    return {
      ...base,
      title: fullTitle(companyTitle(company)),
      description: companyDescription(company, settings),
      type: 'article',
      image: company.image || DEFAULT_IMAGE,
      imageAlt: `${company.name} 관련 안내 자료`,
      publishedAt: company.createdAt || '',
      modifiedAt: company.updatedAt || company.createdAt || '',
      section: company.service || '',
      breadcrumbs: [home, { name: '업체 정보', path: '/companies' }, { name: company.name, path: pathname }],
      company,
    }
  }
  if (parts.length === 2 && sectionKinds[parts[0]]) {
    const article = data.articles?.find((a) => a.id === parts[1] && a.kind === sectionKinds[parts[0]])
    if (!article) return notFound
    return {
      ...base,
      title: fullTitle(article.title),
      description: summarize(article.excerpt || article.body),
      type: article.kind === 'lawyer' ? 'profile' : 'article',
      image: article.image || DEFAULT_IMAGE,
      imageAlt: article.title,
      modifiedAt: article.updatedAt || '',
      section: sectionNames[article.kind],
      breadcrumbs: [
        home,
        { name: sectionNames[article.kind], path: '/' + parts[0] },
        { name: article.title, path: pathname },
      ],
      article,
    }
  }
  if (!pageNames[pathname]) return notFound
  const searching = Boolean(params.get('q')?.trim())
  const page = Number.parseInt(params.get('page') || '1', 10)
  return {
    ...base,
    title: pathname === '/' ? `${SITE_NAME} | 금융사기 피해 상담` : fullTitle(pageNames[pathname]),
    description:
      pathname === '/contact'
        ? `${SITE_NAME} 오시는 길. ${[settings.address, settings.phone && '대표전화 ' + settings.phone].filter(Boolean).join(' · ')}`
        : pageDescriptions[pathname] || DEFAULT_DESCRIPTION,
    robots: searching ? ROBOTS_SEARCH : ROBOTS_INDEX,
    // 목록의 2페이지 이후도 각자 정식 주소로 두어 그 안의 상세페이지 링크가 수집되게 합니다.
    canonicalPath: searching
      ? ''
      : page > 1 && pathname === '/companies'
        ? `${pathname}?page=${page}`
        : pathname,
    breadcrumbs: pathname === '/' ? [] : [home, { name: pageNames[pathname], path: pathname }],
  }
}
