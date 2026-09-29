import { randomUUID } from 'node:crypto'
import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { getStorage } from 'firebase-admin/storage'
import sharp from 'sharp'
import { firestore, isLocal, firebaseConfigured, list } from './store.mjs'
import { HttpError } from './validation.mjs'
export async function uploadImage(data) {
  if (typeof data !== 'string' || data.length > 4400000)
    throw new HttpError(400, '이미지는 3MB 이하로 업로드해 주세요.')
  const match = data.match(/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/)
  if (!match) throw new HttpError(400, 'JPG, PNG, WebP 이미지 파일을 선택해 주세요.')
  const bytes = Buffer.from(match[2], 'base64')
  if (bytes.length > 3 * 1024 * 1024) throw new HttpError(400, '이미지는 3MB 이하여야 합니다.')
  let output
  try {
    output = await sharp(bytes, { limitInputPixels: 40000000, animated: false })
      .rotate()
      .resize({ width: 2000, height: 12000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
  } catch {
    throw new HttpError(400, '이미지 파일을 읽을 수 없습니다.')
  }
  const name = randomUUID() + '.webp'
  if (isLocal() && !firebaseConfigured()) {
    await mkdir(resolve('.local/media'), { recursive: true })
    await writeFile(resolve('.local/media', name), output)
    return { url: `/api/media/${name}` }
  }
  if (!process.env.FIREBASE_STORAGE_BUCKET)
    throw new HttpError(503, '서버에 FIREBASE_STORAGE_BUCKET 설정이 필요합니다.')
  firestore()
  const bucket = getStorage().bucket(process.env.FIREBASE_STORAGE_BUCKET),
    file = bucket.file('public/' + name),
    token = randomUUID()
  await file.save(output, {
    resumable: false,
    metadata: {
      contentType: 'image/webp',
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })
  return {
    url: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(file.name)}?alt=media&token=${token}`,
  }
}
// Delete only this site's generated images, and preserve images used by another record.
export async function deleteUnusedImage(url) {
  if (!url) return ''
  try {
    const groups = await Promise.all(['siteContent', 'rollingCases', 'companyCases'].map(list))
    if (groups.flat().some((v) => !v.deleted && v.image === url)) return ''
    const localName = url.match(/^\/api\/media\/([a-f0-9-]{36}\.webp)$/)?.[1]
    if (localName && isLocal() && !firebaseConfigured()) {
      await unlink(resolve('.local/media', localName)).catch((e) => {
        if (e.code !== 'ENOENT') throw e
      })
    } else if (firebaseConfigured() && process.env.FIREBASE_STORAGE_BUCKET) {
      let parsed
      try {
        parsed = new URL(url)
      } catch {
        return ''
      }
      const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/)
      if (
        parsed.hostname !== 'firebasestorage.googleapis.com' ||
        !match ||
        decodeURIComponent(match[1]) !== process.env.FIREBASE_STORAGE_BUCKET
      )
        return ''
      const name = decodeURIComponent(match[2])
      if (
        !/^public\/[a-f0-9-]{36}\.webp$/.test(name) &&
        !/^(rollingCases|companyCases)\/[a-zA-Z0-9_-]+\/\d+-[a-zA-Z0-9]+\.(png|jpg|jpeg|webp|gif|avif)$/.test(
          name,
        )
      )
        return ''
      firestore()
      await getStorage()
        .bucket(process.env.FIREBASE_STORAGE_BUCKET)
        .file(name)
        .delete({ ignoreNotFound: true })
    }
    return ''
  } catch {
    return '내용은 저장됐지만 이전 이미지 정리에 실패했습니다. 저장소에서 확인해 주세요.'
  }
}
export async function serveLocalMedia(name, res) {
  if (!isLocal() || !/^[-a-f0-9]{36}\.webp$/.test(name)) throw new HttpError(404, '이미지가 없습니다.')
  let bytes
  try {
    bytes = await readFile(resolve('.local/media', name))
  } catch {
    throw new HttpError(404, '이미지가 없습니다.')
  }
  res.statusCode = 200
  res.setHeader('Content-Type', 'image/webp')
  res.setHeader('Cache-Control', 'public,max-age=31536000,immutable')
  res.end(bytes)
}
