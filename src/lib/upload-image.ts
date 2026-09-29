import { api } from './api'

// Accept the reference site's 10 MB source images; optimize before the server upload.
export async function uploadImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('JPG, PNG, WebP 이미지를 선택해 주세요.')
  if (file.size > 10 * 1024 * 1024) throw new Error('이미지는 10MB 이하로 선택해 주세요.')
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(
      1,
      2000 / bitmap.width,
      12000 / bitmap.height,
      Math.sqrt(20000000 / (bitmap.width * bitmap.height)),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('이미지 미리보기를 만들지 못했습니다.')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    let data = ''
    for (const quality of [0.88, 0.75, 0.6, 0.45]) {
      data = canvas.toDataURL('image/webp', quality)
      if (data.length <= 4100000) break
    }
    if (data.length > 4100000) throw new Error('이미지가 너무 복잡합니다. 크기를 줄인 뒤 다시 선택해 주세요.')
    return (await api<{ url: string }>('/admin/upload', { method: 'POST', body: JSON.stringify({ data }) }))
      .url
  } finally {
    bitmap.close()
  }
}
