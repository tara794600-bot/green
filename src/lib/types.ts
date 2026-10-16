import type { CompanyDocument } from '../../shared/company-document.mjs'

export type ArticleKind = 'practice' | 'case' | 'guide' | 'faq' | 'lawyer'
export type Article = {
  id: string
  kind: ArticleKind
  category: string
  title: string
  excerpt: string
  body: string
  checks: string[]
  materials: string[]
  flow: string[]
  image: string
  published: boolean
  updatedAt: string
}
export type Settings = {
  name: string
  phone: string
  email: string
  address: string
  branchAddress: string
  hours: string
  kakaoUrl: string
  heroTitle: string
  heroDescription: string
  businessNumber: string
  representative: string
}
// failed는 전송 오류, uncertain은 타임아웃 등으로 실제 수신 여부를 확인해야 하는 상태입니다.
export type Delivery = {
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'unconfigured' | 'uncertain'
  attempts: number
  updatedAt?: string
  message?: string
}
export type Consultation = {
  id: string
  name: string
  phone: string
  category: string
  details: string
  preferredTime: string
  status: 'new' | 'contacted' | 'scheduled' | 'completed' | 'closed'
  assignee: string
  priority: 'normal' | 'urgent'
  createdAt: string
  updatedAt: string
  source: string
  keyword?: string
  visitSource?: string
  landingPath?: string
  queryString?: string
  referrer?: string
  consentAt: string
  consentVersion: string
  notes: { id: string; text: string; author: string; createdAt: string }[]
  deliveries: { telegram: Delivery; sheets: Delivery }
}
export type RollingCase = {
  id: string
  category: string
  title: string
  result: string
  image: string
  createdAt: string
  updatedAt: string
}
// searchBlocked는 내부 목록·검색만 숨깁니다. 외부 검색의 noindex를 의미하지 않습니다.
export type CompanyVisibility = 'public' | 'phone' | 'searchBlocked'
export type CompanyCase = {
  id: string
  name: string
  service: string
  description: string
  document?: CompanyDocument
  image: string
  visibility: CompanyVisibility
  createdAt: string
  updatedAt: string
}
export type Powerlink = {
  id: string
  keyword: string
  token: string
  path: string
  url: string
  createdAt: string
}
export type LandingData = { token: string; keyword: string; companies: CompanyCase[] }
// SSR 주입 데이터와 /api/content의 공통 응답입니다. 상세 필드는 해당 경로에서만 추가됩니다.
export type PublicData = {
  articles: Article[]
  settings: Settings
  rollingCases: RollingCase[]
  companies: CompanyCase[]
  powerlinkPrefix?: string
  selectedCompany?: CompanyCase | null
  landing?: LandingData | null
}
export const visibilityLabels: Record<CompanyVisibility, string> = {
  public: '공개',
  phone: '전화연결',
  searchBlocked: '검색차단',
}
export type AppConfig = {
  localPreview: boolean
  firebaseConfigured: boolean
  passwordConfigured: boolean
  integrations: { firebase: boolean; telegram: boolean; sheets: boolean }
}
export type AdminIdentity = { uid: string; email: string; role: 'admin' | 'staff' }
export const statuses: Record<Consultation['status'], string> = {
  new: '신규 접수',
  contacted: '연락 완료',
  scheduled: '상담 예정',
  completed: '상담 완료',
  closed: '종결',
}
export const kindLabels: Record<ArticleKind, string> = {
  practice: '업무 분야',
  case: '사례 안내',
  guide: '소식·가이드',
  faq: '자주 묻는 질문',
  lawyer: '변호사 소개',
}
