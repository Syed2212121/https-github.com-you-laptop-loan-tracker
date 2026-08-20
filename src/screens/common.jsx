import React, { useMemo, useState } from "react"
import { Search, X, ChevronDown } from "lucide-react"
import { Badge, Card } from "../ui"
import { loanState } from "../lib"

// Renders the coloured status pill for a loan based on its due date.
export function LoanStateBadge({ loan }) {
  const { state, days } = loanState(loan)
  if (state === "returned") return <Badge tone="neutral">Returned</Badge>
  if (state === "overdue") return <Badge tone="alert">Overdue · {days}d</Badge>
  if (state === "due_soon") return <Badge tone="warn">Due in {days}d</Badge>
  return <Badge tone="navy">{days}d left</Badge>
}

// Section heading used at the top of each screen.
export function ScreenHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        {eyebrow && <p className="text-[10px] uppercase tracking-[0.3em] text-navy-accent mb-1.5">{eyebrow}</p>}
        <h1 className="font-serif text-3xl sm:text-4xl text-navy leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// A read-only "Label / value" row for the fixed detail layouts.
// Renders an em dash when the value is empty.
export function FieldRow({ label, value }) {
  const shown = value === 0 ? "0" : (value || "—")
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-line last:border-0">
      <span className="text-[11px] uppercase tracking-[0.15em] text-muted shrink-0">{label}</span>
      <span className="text-sm text-ink text-right break-words">{shown}</span>
    </div>
  )
}

// One line carrying up to two label/value pairs — the condensed detail layout.
// The label sits ABOVE its value rather than opposite it, which is what lets two
// fit across a phone screen. Same blank rule as FieldRow: 0 is a real value.
export function FieldPairRow({ items }) {
  return (
    <div className={`grid ${items.length > 1 ? "grid-cols-2" : "grid-cols-1"} gap-4 py-2.5 border-b border-line last:border-0`}>
      {items.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <span className="block text-[11px] uppercase tracking-[0.15em] text-muted">{label}</span>
          <span className="block text-sm text-ink break-words">{value === 0 ? "0" : (value || "—")}</span>
        </div>
      ))}
    </div>
  )
}

// A titled panel for the fixed read-only detail layouts: header strip + FieldRows.
// `action` is an optional control pinned to the right of the header — an edit
// button, typically — and is omitted for anyone without permission to use it.
export function SectionCard({ title, action, children }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-2.5 border-b border-line bg-panel/60 flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted">{title}</span>
        {action}
      </div>
      <div className="px-5 py-2">{children}</div>
    </Card>
  )
}

// A SectionCard whose body folds away. Same header treatment, plus a chevron.
// `meta` is a short right-aligned note shown before the chevron — use it to say
// what is inside without making the reader open it.
export function CollapsibleSection({ title, meta, open, onToggle, children }) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-2.5 border-b border-line bg-panel/60 text-left hover:bg-panel"
      >
        <span className="text-[11px] uppercase tracking-[0.18em] text-muted min-w-0 flex-1 truncate">{title}</span>
        {meta && <span className="text-xs text-muted shrink-0">{meta}</span>}
        <ChevronDown size={16} className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-5 py-2">{children}</div>}
    </Card>
  )
}

// Reusable search box with a live suggestions dropdown (partial match).
//   items       – array to search
//   filter      – (item, query) => boolean
//   getKey      – item => unique key
//   getPrimary  – item => bold main text
//   getSecondary/getMeta – optional item => text (muted / right-aligned)
//   onSelect    – item => void
export function SearchSelect({
  items, filter, getKey, getPrimary, getSecondary, getMeta,
  onSelect, placeholder = "Search…", autoFocus, inputMode,
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(true)

  const suggestions = useMemo(() => {
    const q = query.trim()
    if (!q || !open) return []
    return items.filter(it => filter(it, q)).slice(0, 8)
  }, [items, query, open, filter])

  const pick = (it) => { onSelect(it); setQuery(""); setOpen(false) }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          inputMode={inputMode}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="w-full pl-11 pr-10 py-3.5 text-base bg-white rounded-xl border border-line focus:border-navy-accent focus:ring-2 focus:ring-navy-accent/20 focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-muted hover:text-ink">
            <X size={16} />
          </button>
        )}
      </div>

      {suggestions.length > 0 && (
        <Card className="absolute z-20 mt-1.5 w-full overflow-hidden shadow-lg">
          {suggestions.map(it => (
            <button
              key={getKey(it)}
              type="button"
              onClick={() => pick(it)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-panel text-left border-b border-line last:border-0"
            >
              <span className="font-medium tabular-nums text-ink shrink-0">{getPrimary(it)}</span>
              {getSecondary && <span className="text-sm text-muted truncate">{getSecondary(it)}</span>}
              {getMeta && <span className="ml-auto text-xs text-muted shrink-0">{getMeta(it)}</span>}
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
