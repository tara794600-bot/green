// JS로 공유하는 문서 형식의 TypeScript 선언입니다. 스키마·렌더러 변경 시 함께 맞춥니다.
import type { z } from 'zod'
export type BlockType = 'markdown' | 'callout' | 'stat' | 'mermaid' | 'html' | 'image' | 'divider'
export type BlockStyle = {
  color: string
  background: string
  borderColor: string
  accent: string
  shadow: 'none' | 'soft' | 'strong'
  animation: 'none' | 'fade' | 'pulse' | 'float'
  align: 'left' | 'center' | 'right'
  radius: number
  padding: number
  borderWidth: number
  fontSize: number
}
export type DocumentBlock = {
  id: string
  type: BlockType
  content: string
  caption: string
  style: BlockStyle
}
/** 이전 블록 편집기로 저장된 본문입니다. 읽을 때 HTML로 변환합니다. */
export type LegacyCompanyDocument = { version: 1; blocks: DocumentBlock[] }
export type HtmlCompanyDocument = { version: 2; html: string }
export type CompanyDocument = HtmlCompanyDocument | LegacyCompanyDocument
export type DocumentFont = {
  label: string
  family: string
  fallback: string
  weights?: string
  bundled?: boolean
}
export const MAX_DOCUMENT_HTML: number
export const MAX_DOCUMENT_IMAGES: number
export const MAX_BLOCKS: number
export const MAX_DOCUMENT_LENGTH: number
export const blockTypes: BlockType[]
export const documentFonts: DocumentFont[]
export const companyDocumentSchema: z.ZodType<CompanyDocument>
export function isImageUrl(value: string): boolean
export function htmlImageSources(html: string): string[]
export function sanitizeContent(html: string, options?: { localImages?: boolean }): string
export function fontStylesheet(html: string): string
export function documentHtml(document: CompanyDocument | undefined): string
export function hasDocumentContent(document: CompanyDocument | undefined): boolean
export function documentImageUrls(record: { image?: string; document?: CompanyDocument }): string[]
