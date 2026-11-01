type RelatedSource = { id: string; service: string; createdAt: string }
export function relatedCompanies<T extends RelatedSource>(companies: T[], item: RelatedSource, limit?: number): T[]
