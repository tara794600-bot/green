import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  ExternalLink,
  Copy,
  ImagePlus,
  ArrowRight,
  Link2,
  Layers,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { api, ApiError, dateTime, errorMessage } from '../lib/api'
import { uploadImage } from '../lib/upload-image'
import {
  visibilityLabels,
  type CompanyCase,
  type CompanyVisibility,
  type Powerlink,
  type RollingCase,
} from '../lib/types'
import { EmptyState, ErrorNotice, Modal } from '../components/ui'
import CompanyDocumentEditor from '../components/CompanyDocumentEditor'
import { clearDocumentDraft } from '../lib/company-document'
import {
  companyDocumentSchema,
  htmlImageSources,
  type CompanyDocument,
} from '../../shared/company-document.mjs'
import './reference.css'

type Kind = 'rolling' | 'companies' | 'powerlinks'
type Row = RollingCase | CompanyCase | Powerlink
type Page = { items: Row[]; total: number; filtered: number; page: number; pages: number }
const descriptions = {
  rolling: {
    title: '홈 롤링 사례',
    eyebrow: 'HOME SHOWCASE',
    text: '카테고리, 사건명, 결과와 이미지를 등록하면 홈 롤링 영역에 반영됩니다.',
    button: '롤링 사례 추가',
    icon: Layers,
  },
  companies: {
    title: '사기업체 관리',
    eyebrow: 'COMPANY DIRECTORY',
    text: '업체 정보를 등록하고, 상세페이지와 검색 노출 방식을 관리하세요.',
    button: '사기업체 추가',
    icon: Building2,
  },
  powerlinks: {
    title: '파워링크 URL',
    eyebrow: 'CAMPAIGN LINKS',
    text: '키워드별 암호화 링크를 만들고 상담 접수의 광고 유입을 확인하세요.',
    button: 'URL 생성',
    icon: Link2,
  },
}
const nameOf = (row: Row) => ('name' in row ? row.name : 'title' in row ? row.title : row.keyword)
export default function AdminReference({ kind }: { kind: Kind }) {
  const info = descriptions[kind]
  const [page, setPage] = useState(1),
    [query, setQuery] = useState(''),
    [search, setSearch] = useState('')
  const [data, setData] = useState<Page | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('')
  const [edit, setEdit] = useState<Row | 'new' | null>(null),
    [removing, setRemoving] = useState<Row | null>(null),
    [busy, setBusy] = useState(false)
  // 검색·페이지 요청이 역순으로 끝나도 최신 요청의 결과만 목록에 반영합니다.
  const requestNumber = useRef(0)
  const refresh = useCallback(() => {
    const number = ++requestNumber.current
    return api<Page>(`/admin/${kind}?page=${page}&q=${encodeURIComponent(search)}`)
      .then((result) => {
        if (number !== requestNumber.current) return
        setData(result)
        setError('')
      })
      .catch((e) => {
        if (number === requestNumber.current) setError(errorMessage(e))
      })
      .finally(() => {
        if (number === requestNumber.current) setLoading(false)
      })
  }, [kind, page, search])
  useEffect(() => {
    void refresh()
  }, [refresh])
  async function saved(message: string) {
    setEdit(null)
    setNotice(message)
    await refresh()
    window.dispatchEvent(new Event('content-updated'))
  }
  async function remove() {
    if (!removing || busy) return
    setBusy(true)
    try {
      const result = await api<{ warning?: string }>(`/admin/${kind}/${removing.id}`, { method: 'DELETE' })
      setRemoving(null)
      await saved(result.warning || '삭제했습니다.')
    } catch (e) {
      setError(errorMessage(e))
      setRemoving(null)
    } finally {
      setBusy(false)
    }
  }
  async function visibility(row: CompanyCase, value: CompanyVisibility) {
    setBusy(true)
    try {
      await api(`/admin/companies/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ visibility: value }),
      })
      await saved(`“${row.name}”의 노출 설정을 ${visibilityLabels[value]}로 변경했습니다.`)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setNotice('URL을 복사했습니다.')
    } catch {
      setError('자동 복사가 허용되지 않았습니다. URL을 선택해 직접 복사해 주세요.')
    }
  }
  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">{info.eyebrow}</p>
          <h1>{info.title}</h1>
          <p>{info.text}</p>
        </div>
        <button className="button small" onClick={() => setEdit('new')}>
          <Plus size={17} />
          {info.button}
        </button>
      </div>
      <div className="reference-summary">
        <span className="reference-summary-icon">
          <info.icon size={23} />
        </span>
        <div>
          <strong>
            {data?.total ?? '—'}
            <small>개 등록</small>
          </strong>
          <p>
            {kind === 'rolling'
              ? '홈페이지에서 자동으로 순환하는 사례'
              : kind === 'companies'
                ? '공개 · 전화연결 · 검색차단을 개별 설정'
                : '원문 키워드를 숨긴 광고용 전용 주소'}
          </p>
        </div>
        <Link to={kind === 'companies' ? '/companies' : '/'} target="_blank">
          페이지 보기
          <ExternalLink size={15} />
        </Link>
      </div>
      {error && <ErrorNotice message={error} onRetry={refresh} />}
      {notice && (
        <div className="success-notice" role="status">
          {notice}
          <button type="button" onClick={() => setNotice('')} aria-label="알림 닫기">
            ×
          </button>
        </div>
      )}
      <section className="admin-card">
        <div className="table-toolbar">
          <form
            className="reference-search"
            onSubmit={(e) => {
              e.preventDefault()
              setPage(1)
              setSearch(query.trim())
            }}
          >
            <label className="search-box">
              <Search size={17} />
              <input
                type="search"
                aria-label="전체 등록 항목 검색"
                placeholder={
                  kind === 'companies'
                    ? '전체 업체명, 유형, 설명 검색'
                    : kind === 'rolling'
                      ? '사건명, 카테고리, 결과 검색'
                      : '파워링크 키워드 검색'
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (!e.target.value) {
                    setSearch('')
                    setPage(1)
                  }
                }}
              />
            </label>
            <button className="button outline small">검색</button>
          </form>
          <button
            className="text-button"
            disabled={loading}
            onClick={() => {
              setSearch('')
              setQuery('')
              setPage(1)
              void refresh()
            }}
          >
            <RefreshCw size={15} />
            새로고침
          </button>
        </div>
        {loading ? (
          <p className="reference-loading" role="status">
            목록을 불러오는 중입니다…
          </p>
        ) : data?.items.length ? (
          <>
            <div className="reference-count">
              {search ? `검색 ${data.filtered}개 · ` : ''}전체 {data.total}개
            </div>
            <ul className="reference-list">
              {data.items.map((row) => (
                <li key={row.id}>
                  {'image' in row && (
                    <button
                      className="reference-thumbnail"
                      onClick={() => setEdit(row)}
                      aria-label={`${nameOf(row)} 수정`}
                    >
                      <img src={row.image} alt="" loading="lazy" />
                    </button>
                  )}
                  <div className="reference-row-copy">
                    <div className="reference-row-kicker">
                      {'service' in row ? row.service : 'category' in row ? row.category : '파워링크 키워드'}
                      {'visibility' in row && (
                        <span className={`visibility-badge ${row.visibility}`}>
                          {visibilityLabels[row.visibility]}
                        </span>
                      )}
                    </div>
                    <strong>{nameOf(row)}</strong>
                    {'result' in row && <p>{row.result}</p>}
                    {'description' in row && <p className="reference-description">{row.description}</p>}
                    {'url' in row && (
                      <input
                        className="reference-url"
                        aria-label={`${row.keyword} URL`}
                        value={row.url}
                        readOnly
                        onFocus={(e) => e.target.select()}
                      />
                    )}
                    <small>{dateTime(row.createdAt)} 등록</small>
                  </div>
                  <div className="reference-row-actions">
                    {'visibility' in row && (
                      <label className="compact-label">
                        노출 설정
                        <select
                          value={row.visibility}
                          disabled={busy}
                          aria-label={`${row.name} 노출 설정`}
                          onChange={(e) => void visibility(row, e.target.value as CompanyVisibility)}
                        >
                          {Object.entries(visibilityLabels).map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="table-actions">
                      {'url' in row ? (
                        <>
                          <button
                            className="icon-button"
                            title="URL 복사"
                            aria-label={`${row.keyword} URL 복사`}
                            onClick={() => void copy(row.url)}
                          >
                            <Copy size={17} />
                          </button>
                          <a
                            className="icon-button"
                            href={row.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${row.keyword} 링크 열기`}
                          >
                            <ExternalLink size={17} />
                          </a>
                        </>
                      ) : (
                        <>
                          <button
                            className="icon-button"
                            aria-label={`${nameOf(row)} 수정`}
                            onClick={() => setEdit(row)}
                          >
                            <Pencil size={17} />
                          </button>
                          {'name' in row && (
                            <Link
                              className="icon-button"
                              to={`/companies/${row.id}`}
                              target="_blank"
                              aria-label={`${row.name} 상세페이지 보기`}
                            >
                              <ExternalLink size={17} />
                            </Link>
                          )}
                        </>
                      )}
                      <button
                        className="icon-button danger"
                        disabled={busy}
                        aria-label={`${nameOf(row)} 삭제`}
                        onClick={() => setRemoving(row)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="reference-pagination">
              <span>
                {data.page} / {data.pages} 페이지 · 페이지당 30개
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label="이전 페이지"
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  aria-label="다음 페이지"
                  disabled={data.page >= data.pages}
                  onClick={() => setPage(data.page + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title={search ? '검색 결과가 없습니다.' : '아직 등록한 항목이 없습니다.'}
            description={
              search
                ? '다른 검색어로 전체 목록을 확인해 보세요.'
                : '첫 항목을 등록해 홈페이지에 반영해 보세요.'
            }
          />
        )}
      </section>
      {kind === 'companies' && (
        <div className="reference-help">
          <h2>노출 설정 안내</h2>
          <p>
            <strong>공개</strong> 홈페이지 목록·내부 검색과 상세페이지에 표시됩니다.
          </p>
          <p>
            <strong>전화연결</strong> 내부 목록·검색에서 숨기고 상세 주소에서는 전화 상담 안내를 표시합니다.
          </p>
          <p>
            <strong>검색차단</strong> 내부 목록·검색에서만 숨깁니다. 직접 주소와 외부 검색으로 방문하면
            상세페이지가 표시됩니다.
          </p>
        </div>
      )}
      {kind === 'powerlinks' && (
        <div className="reference-help">
          <h2>광고 링크 사용하기</h2>
          <p>
            생성한 URL을 광고의 연결 주소로 사용하세요. 해당 키워드와 관련 업체 정보를 홈에서 보여주고, 상담
            접수에 유입 키워드를 함께 저장합니다.
          </p>
          <p>목록에서 삭제해도 이미 배포한 링크는 유지됩니다. 기존 참고 사이트와 동일한 방식입니다.</p>
        </div>
      )}
      {edit && <ReferenceEditor kind={kind} value={edit} onClose={() => setEdit(null)} onSave={saved} />}
      {removing && (
        <Modal
          title="등록 항목 삭제"
          onClose={() => {
            if (!busy) setRemoving(null)
          }}
        >
          <p>“{nameOf(removing)}” 항목을 삭제할까요?</p>
          <p className="muted">
            {kind === 'powerlinks'
              ? '관리 목록에서 삭제됩니다. 배포한 URL은 계속 열립니다.'
              : '삭제한 항목은 복원할 수 없습니다. 다른 항목에서 사용하지 않는 업로드 이미지도 정리됩니다.'}
          </p>
          <div className="modal-actions">
            <button className="button outline" disabled={busy} onClick={() => setRemoving(null)}>
              취소
            </button>
            <button className="button danger-button" disabled={busy} onClick={() => void remove()}>
              {busy ? '삭제 중…' : '삭제하기'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
function ReferenceEditor({
  kind,
  value,
  onClose,
  onSave,
}: {
  kind: Kind
  value: Row | 'new'
  onClose: () => void
  onSave: (message: string) => Promise<void>
}) {
  const initial = value === 'new' ? null : value
  const [document, setDocument] = useState<CompanyDocument>(() =>
    initial && 'document' in initial && initial.document ? initial.document : { version: 2, html: '' },
  )
  const draftKey = initial?.id || 'new'
  // 편집 중에는 blob URL로 미리보기만 만듭니다. 실제 업로드는 저장 시 수행하고 닫을 때 URL을 해제합니다.
  const imageFiles = useRef(new Map<string, File>())
  useEffect(() => {
    const files = imageFiles.current
    return () => {
      for (const url of files.keys()) URL.revokeObjectURL(url)
    }
  }, [])
  function addImageFile(file: File) {
    const url = URL.createObjectURL(file)
    imageFiles.current.set(url, file)
    return url
  }
  const [fields, setFields] = useState({
    category: initial && 'category' in initial ? initial.category : '',
    title: initial && 'title' in initial ? initial.title : '',
    result: initial && 'result' in initial ? initial.result : '',
    name: initial && 'name' in initial ? initial.name : '',
    service: initial && 'service' in initial ? initial.service : '',
    description: initial && 'description' in initial ? initial.description : '',
    visibility: initial && 'visibility' in initial ? initial.visibility : ('public' as CompanyVisibility),
    keyword: '',
  })
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview],
  )
  const image = preview || (initial && 'image' in initial ? initial.image : '')
  const change = (key: keyof typeof fields, text: string) => setFields((v) => ({ ...v, [key]: text }))
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (kind !== 'powerlinks' && !image) {
      setError('이미지를 선택해 주세요.')
      return
    }
    setBusy(true)
    setError('')
    const uploadedImages: string[] = []
    let uploaded = '',
      persisted = false
    try {
      // 본문에 남아 있는 업로드 전 사진(blob URL)입니다. 같은 사진을 여러 번 넣어도 한 번만 업로드합니다.
      const localImages =
        kind === 'companies' && 'html' in document
          ? [...new Set(htmlImageSources(document.html))].filter((src) => imageFiles.current.has(src))
          : []
      const replaceImages = (html: string, urls: string[]) =>
        localImages.reduce((text, src, i) => text.replaceAll(src, urls[i]), html)
      // 업로드 전에 문서를 검사합니다. 이 편집기가 보유한 blob URL만 검증용 경로로 임시 치환합니다.
      if (kind === 'companies') {
        const checked = companyDocumentSchema.safeParse(
          'html' in document
            ? {
                ...document,
                html: replaceImages(
                  document.html,
                  localImages.map(() => '/images/pending.webp'),
                ),
              }
            : document,
        )
        if (!checked.success) throw new Error(checked.error.issues[0].message)
      }
      if (file) {
        uploaded = await uploadImage(file)
        uploadedImages.push(uploaded)
      }
      let savedDocument = document
      if ('html' in document && localImages.length) {
        const urls: string[] = []
        for (const src of localImages) {
          const url = await uploadImage(imageFiles.current.get(src)!)
          urls.push(url)
          uploadedImages.push(url)
        }
        savedDocument = { ...document, html: replaceImages(document.html, urls) }
      }
      const selectedImage = uploaded || image
      const payload =
        kind === 'rolling'
          ? { category: fields.category, title: fields.title, result: fields.result, image: selectedImage }
          : kind === 'companies'
            ? {
                name: fields.name,
                service: fields.service,
                description: fields.description,
                document: savedDocument,
                visibility: fields.visibility,
                image: selectedImage,
              }
            : { keyword: fields.keyword }
      const result = await api<{ warning?: string }>(`/admin/${kind}${initial ? '/' + initial.id : ''}`, {
        method: initial ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      })
      persisted = true
      if (kind === 'companies') clearDocumentDraft(draftKey)
      await onSave(
        result.warning ||
          (kind === 'powerlinks'
            ? '광고 URL을 생성했습니다. 복사해서 사용하세요.'
            : '저장했습니다. 홈페이지에 반영되었습니다.'),
      )
    } catch (e) {
      setError(errorMessage(e))
      // 5xx 응답은 저장 여부가 불명확하므로 즉시 정리하지 않습니다. 삭제 API도 공유 참조를 재검사합니다.
      if (!persisted && (!(e instanceof ApiError) || (e.status >= 400 && e.status < 500)))
        for (const url of uploadedImages)
          await api('/admin/media', { method: 'DELETE', body: JSON.stringify({ url }) }).catch(() => {})
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      title={initial ? `${descriptions[kind].title} 수정` : descriptions[kind].button}
      wide={kind !== 'powerlinks'}
      className={kind === 'companies' ? 'company-editor-modal' : ''}
      onClose={() => {
        if (!busy) onClose()
      }}
    >
      <form className="reference-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          {kind === 'powerlinks' ? (
            <label>
              키워드
              <input
                autoFocus
                required
                maxLength={120}
                placeholder="예: 코인 사기 변호사"
                value={fields.keyword}
                onChange={(e) => change('keyword', e.target.value)}
              />
              <small>키워드 원문이 URL에 노출되지 않도록 암호화합니다.</small>
            </label>
          ) : (
            <>
              {kind === 'rolling' ? (
                <>
                  <div className="form-grid">
                    <label>
                      카테고리
                      <input
                        required
                        maxLength={40}
                        value={fields.category}
                        onChange={(e) => change('category', e.target.value)}
                        placeholder="예: 형사"
                      />
                    </label>
                    <label>
                      결과
                      <input
                        required
                        maxLength={60}
                        value={fields.result}
                        onChange={(e) => change('result', e.target.value)}
                        placeholder="확인된 사건 결과"
                      />
                    </label>
                  </div>
                  <label>
                    사건명
                    <input
                      required
                      maxLength={120}
                      value={fields.title}
                      onChange={(e) => change('title', e.target.value)}
                      placeholder="사건명을 입력해 주세요"
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="form-grid">
                    <label>
                      업체명
                      <input
                        required
                        maxLength={80}
                        value={fields.name}
                        onChange={(e) => change('name', e.target.value)}
                        placeholder="업체명"
                      />
                    </label>
                    <label>
                      유형
                      <input
                        required
                        maxLength={80}
                        value={fields.service}
                        onChange={(e) => change('service', e.target.value)}
                        placeholder="예: 코인 리딩방 사기"
                      />
                    </label>
                  </div>
                  <label>
                    설명 · 목록용 요약
                    <textarea
                      required
                      rows={3}
                      maxLength={2000}
                      value={fields.description}
                      onChange={(e) => change('description', e.target.value)}
                      placeholder="피해 유형 또는 진행 상태"
                    />
                    <small>목록과 검색에 표시할 짧은 안내입니다. {fields.description.length} / 2,000자</small>
                  </label>
                  <fieldset className="visibility-options">
                    <legend>게시물 노출 설정</legend>
                    {Object.entries(visibilityLabels).map(([key, label]) => (
                      <label key={key} className={fields.visibility === key ? 'selected' : ''}>
                        <input
                          type="radio"
                          name="visibility"
                          value={key}
                          checked={fields.visibility === key}
                          onChange={() => change('visibility', key)}
                        />
                        <span>
                          <strong>{label}</strong>
                          <small>
                            {key === 'public'
                              ? '홈페이지 목록, 내부 검색, 상세페이지에 표시'
                              : key === 'phone'
                                ? '내부 검색에서 숨김 · 상세 주소는 전화 안내'
                                : '내부 검색에서만 숨김 · 상세페이지 유지'}
                          </small>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </>
              )}
              <label className="reference-upload">
                <span>
                  <ImagePlus size={18} />
                  {initial ? '이미지 교체 (선택)' : '이미지 파일'}
                </span>
                {image && <img src={image} alt="등록 이미지 미리보기" />}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  required={!image}
                  onChange={(e) => {
                    const next = e.target.files?.[0]
                    if (next) {
                      setFile(next)
                      setPreview(URL.createObjectURL(next))
                      setError('')
                    }
                  }}
                />
                <small>JPG · PNG · WebP / 최대 10MB. 업로드할 때 웹용 이미지로 최적화합니다.</small>
              </label>
              {kind === 'companies' && (
                <CompanyDocumentEditor
                  value={document}
                  onChange={setDocument}
                  onImageFile={addImageFile}
                  draftKey={draftKey}
                />
              )}
            </>
          )}
        </fieldset>
        {error && <ErrorNotice message={error} />}
        <div className="modal-actions">
          <button className="button outline" type="button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button className="button" disabled={busy}>
            {busy ? '저장 중…' : kind === 'powerlinks' ? 'URL 생성하기' : '저장하기'}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  )
}
