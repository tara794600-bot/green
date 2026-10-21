// shared/seo.mjs의 TypeScript 선언입니다. 함수 형식을 바꾸면 함께 맞춥니다.
import type { CompanyDocument } from './company-document.mjs'

type Named = { id: string; name: string; service?: string; description?: string; document?: CompanyDocument }
type CompanyLike = Named & { visibility?: string; image?: string; createdAt?: string; updatedAt?: string }
type ArticleLike = {
  id: string
  kind: string
  title: string
  excerpt?: string
  body?: string
  image?: string
  updatedAt?: string
}
export type PageMeta = {
  status: 200 | 404
  title: string
  description: string
  robots: string
  canonicalPath: string
  type: 'website' | 'article' | 'profile'
  image: string
  imageAlt: string
  publishedAt: string
  modifiedAt: string
  section: string
  breadcrumbs: { name: string; path: string }[]
  company: CompanyLike | null
  article: ArticleLike | null
}
export type MetaData = {
  articles?: ArticleLike[]
  companies?: CompanyLike[]
  settings?: { phone?: string; address?: string }
  selectedCompany?: CompanyLike | null
  landing?: { keyword: string } | null
  powerlinkPrefix?: string
}
export const SITE_NAME: string
export const DEFAULT_IMAGE: string
export const DEFAULT_DESCRIPTION: string
export const ROBOTS_INDEX: string
export const ROBOTS_NOINDEX: string
export const ROBOTS_SEARCH: string
export const pageNames: Record<string, string>
export const sectionNames: Record<string, string>
export function articlePath(article: ArticleLike): string
export function companyPath(company: { id: string }): string
export function plainText(html?: string): string
export function documentText(document?: CompanyDocument): string
export function summarize(text: string, max?: number): string
export function companyTitle(company: CompanyLike): string
export function fullTitle(title: string): string
export function companyDescription(company: CompanyLike, settings?: { phone?: string }): string
export function pageMeta(pathname: string, search: string, data: MetaData): PageMeta
