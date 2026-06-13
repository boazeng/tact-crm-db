import { useEffect, useState, type ReactNode } from 'react'

export type Column<T> = {
  header: string
  key: keyof T | string
  render?: (row: T) => ReactNode
  width?: number | string
  align?: 'start' | 'center' | 'end'
}

type Props<T> = {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string | number
  empty?: string
  actions?: (row: T) => ReactNode
  /** Shrink the table to its content width instead of filling the page. */
  compact?: boolean
  /** Enable client-side pagination with this default page size. Omit to show all
   * rows on one page (the original behaviour). */
  pageSize?: number
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 250]

export default function DataTable<T>({ rows, columns, rowKey, empty, actions, compact, pageSize }: Props<T>) {
  const paginated = pageSize != null
  const [perPage, setPerPage] = useState(pageSize ?? 50)
  const [page, setPage] = useState(1)

  // Reset to the first page whenever the data set or page size changes (e.g. a
  // new search returns a fresh rows array).
  useEffect(() => setPage(1), [rows, perPage])

  if (rows.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          background: 'var(--color-bg-white)',
          border: '1px dashed var(--color-border)',
          borderRadius: 14,
          color: 'var(--color-text-light)',
        }}
      >
        {empty || 'אין נתונים להצגה'}
      </div>
    )
  }

  const totalPages = paginated ? Math.max(1, Math.ceil(rows.length / perPage)) : 1
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = paginated ? (safePage - 1) * perPage : 0
  const end = paginated ? Math.min(start + perPage, rows.length) : rows.length
  const visibleRows = paginated ? rows.slice(start, end) : rows

  return (
    <div>
      <div
        style={{
          background: 'var(--color-bg-white)',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          overflow: 'hidden',
          display: compact ? 'inline-block' : 'block',
          maxWidth: '100%',
        }}
      >
        <table style={{ width: compact ? 'auto' : '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--color-primary-soft)' }}>
              {columns.map((c) => (
                <th
                  key={String(c.key)}
                  style={{
                    textAlign: c.align || 'start',
                    padding: '12px 16px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--color-primary)',
                    letterSpacing: '0.02em',
                    width: c.width,
                  }}
                >
                  {c.header}
                </th>
              ))}
              {actions && (
                <th style={{ padding: '12px 16px', width: 120 }} />
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr
                key={rowKey(row)}
                style={{
                  borderTop: i === 0 ? undefined : '1px solid var(--color-border)',
                  fontSize: '0.9rem',
                }}
              >
                {columns.map((c) => (
                  <td
                    key={String(c.key)}
                    style={{
                      padding: '12px 16px',
                      textAlign: c.align || 'start',
                      color: 'var(--color-text)',
                    }}
                  >
                    {c.render ? c.render(row) : String((row as any)[c.key] ?? '')}
                  </td>
                ))}
                {actions && (
                  <td style={{ padding: '8px 16px', textAlign: 'end' }}>{actions(row)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginated && (
        <Pager
          total={rows.length}
          start={start}
          end={end}
          page={safePage}
          totalPages={totalPages}
          perPage={perPage}
          onPage={setPage}
          onPerPage={setPerPage}
        />
      )}
    </div>
  )
}

type PagerProps = {
  total: number
  start: number
  end: number
  page: number
  totalPages: number
  perPage: number
  onPage: (p: number) => void
  onPerPage: (n: number) => void
}

function Pager({ total, start, end, page, totalPages, perPage, onPage, onPerPage }: PagerProps) {
  const sizeOptions = PAGE_SIZE_OPTIONS.includes(perPage)
    ? PAGE_SIZE_OPTIONS
    : [...PAGE_SIZE_OPTIONS, perPage].sort((a, b) => a - b)

  const navBtn = (label: string, to: number, disabled: boolean) => (
    <button
      onClick={() => onPage(to)}
      disabled={disabled}
      className="tact-btn tact-btn-ghost"
      style={{ padding: '6px 12px', fontSize: '0.82rem', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer' }}
    >
      {label}
    </button>
  )

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.82rem', color: 'var(--color-text-light)' }}>
        <span>
          מציג {start + 1}–{end} מתוך {total}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          לעמוד:
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            style={{
              padding: '4px 8px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg)',
              fontFamily: 'inherit',
              fontSize: '0.82rem',
              color: 'var(--color-text)',
            }}
          >
            {sizeOptions.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {navBtn('« התחלה', 1, page <= 1)}
        {navBtn('‹ הקודם', page - 1, page <= 1)}
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)', padding: '0 8px' }}>
          עמוד {page} מתוך {totalPages}
        </span>
        {navBtn('הבא ›', page + 1, page >= totalPages)}
        {navBtn('סוף »', totalPages, page >= totalPages)}
      </div>
    </div>
  )
}
