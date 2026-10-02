import { z } from 'zod'
import { companyDocumentSchema } from '../shared/company-document.mjs'

export const categories = [
  '투자·리딩방 사기',
  '출금 거부 거래소',
  '유사수신·다단계',
  '코인·가상자산 사기',
  '기획 투자사기',
  '부업·재테크 사기',
  '기타·잘 모르겠어요',
]
export const consultationSchema = z.object({
  requestId: z.string().uuid(),
  name: z.string().trim().min(2, '성함을 2자 이상 입력해 주세요.').max(60),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(/^0\d{8,10}$/, '연락처를 확인해 주세요.')),
  category: z.string().trim().min(1, '상담 분야를 선택해 주세요.').max(80),
  details: z.string().trim().max(4000).default(''),
  preferredTime: z.string().trim().max(80).default(''),
  consent: z.literal(true, { error: '개인정보 수집·이용 동의가 필요합니다.' }),
  website: z.string().max(0).default(''),
  source: z.string().max(500).default('/'),
  landingPath: z.string().max(1000).default('/'),
  queryString: z.string().max(2000).default(''),
  referrer: z.string().max(1000).default(''),
})
export const updateSchema = z
  .object({
    status: z.enum(['new', 'contacted', 'scheduled', 'completed', 'closed']).optional(),
    priority: z.enum(['normal', 'urgent']).optional(),
    assignee: z.string().trim().max(60).optional(),
    note: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
const safeImage = z
  .string()
  .max(1500)
  .refine(
    (v) =>
      !v ||
      /^\/images\/[a-zA-Z0-9._/-]+$/.test(v) ||
      /^\/api\/media\/[a-f0-9-]{36}\.webp$/.test(v) ||
      /^https:\/\//.test(v),
    '업로드된 이미지 또는 HTTPS 주소를 사용해 주세요.',
  )
export const rollingSchema = z
  .object({
    category: z.string().trim().min(1).max(40),
    title: z.string().trim().min(1).max(120),
    result: z.string().trim().min(1).max(60),
    image: safeImage.refine(Boolean, '이미지를 등록해 주세요.'),
  })
  .strict()
export const companySchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    service: z.string().trim().min(1).max(80),
    description: z.string().trim().min(1).max(2000),
    document: companyDocumentSchema.optional(),
    image: safeImage.refine(Boolean, '이미지를 등록해 주세요.'),
    visibility: z.enum(['public', 'phone', 'searchBlocked']),
  })
  .strict()
export const articleSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    kind: z.enum(['practice', 'case', 'guide', 'faq', 'lawyer']),
    category: z.string().trim().max(80),
    title: z.string().trim().min(2).max(160),
    excerpt: z.string().trim().max(600),
    body: z.string().trim().max(20000),
    checks: z.array(z.string().max(500)).max(30),
    materials: z.array(z.string().max(500)).max(30),
    flow: z.array(z.string().max(200)).max(12),
    image: safeImage,
    published: z.boolean(),
    updatedAt: z.string().optional(),
  })
  .strict()
export const settingsSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9+() -]{7,30}$/),
    email: z.union([z.literal(''), z.email()]),
    address: z.string().max(300),
    branchAddress: z.string().max(300),
    hours: z.string().max(300),
    kakaoUrl: z.string().refine((v) => !v || /^https?:\/\/pf\.kakao\.com\//.test(v)),
    heroTitle: z.string().min(2).max(120),
    heroDescription: z.string().max(500),
    businessNumber: z.string().max(40),
    representative: z.string().max(80),
  })
  .strict()
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
export function parse(schema, value) {
  const result = schema.safeParse(value)
  if (!result.success) throw new HttpError(400, result.error.issues[0].message)
  return result.data
}
