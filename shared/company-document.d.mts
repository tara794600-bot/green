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
export type CompanyDocument = { version: 1; blocks: DocumentBlock[] }
export const MAX_BLOCKS: number
export const MAX_DOCUMENT_LENGTH: number
export const blockTypes: BlockType[]
export const companyDocumentSchema: z.ZodType<CompanyDocument>
export function isImageUrl(value: string): boolean
export function sanitizeContent(html: string): string
export function markdownParts(source: string): { kind: 'html' | 'diagram'; content: string }[]
export function documentImageUrls(record: { image?: string; document?: CompanyDocument }): string[]
