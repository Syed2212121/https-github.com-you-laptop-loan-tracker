import React, { useEffect } from "react"
import { X } from "lucide-react"

// ============================================================
// DESIGN SYSTEM — white + navy theme
// (structure adapted from the Al-Taqwa Quran register app)
// ============================================================

export function Button({ children, onClick, variant = "primary", size = "md", className = "", type = "button", disabled }) {
  const sizes = {
    sm: "px-3 py-2 text-xs",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-sm",
  }
  const variants = {
    primary: "bg-navy text-white hover:bg-navy-dark border border-navy",
    accent: "bg-navy-accent text-white hover:bg-navy border border-navy-accent",
    secondary: "bg-white text-navy hover:bg-panel border border-navy/25",
    ghost: "bg-transparent text-navy hover:bg-navy/5",
    danger: "bg-white text-alert hover:bg-alert/10 border border-alert/30",
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] ${sizes[size]} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Label({ children }) {
  return <span className="block text-[10px] uppercase tracking-[0.18em] text-muted mb-1.5 font-semibold">{children}</span>
}

export function Input({ label, value, onChange, placeholder, type = "text", inputMode, autoFocus, className = "" }) {
  return (
    <label className="block">
      {label && <Label>{label}</Label>}
      <input
        type={type}
        inputMode={inputMode}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 bg-white rounded-lg border border-line focus:border-navy-accent focus:ring-2 focus:ring-navy-accent/20 focus:outline-none text-ink placeholder:text-muted/50 text-sm ${className}`}
      />
    </label>
  )
}

export function Select({ label, value, onChange, options, placeholder }) {
  return (
    <label className="block">
      {label && <Label>{label}</Label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 bg-white rounded-lg border border-line focus:border-navy-accent focus:ring-2 focus:ring-navy-accent/20 focus:outline-none text-ink text-sm appearance-none cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235b6577' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 0.75rem center",
          paddingRight: "2rem",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}

export function Textarea({ label, value, onChange, placeholder, rows = 2 }) {
  return (
    <label className="block">
      {label && <Label>{label}</Label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3.5 py-2.5 bg-white rounded-lg border border-line focus:border-navy-accent focus:ring-2 focus:ring-navy-accent/20 focus:outline-none text-ink text-sm resize-none"
      />
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [open])
  if (!open) return null
  const sizeClass = wide ? "sm:max-w-2xl" : "sm:max-w-md"
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" onClick={onClose}>
      <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" />
      <div className="relative flex min-h-full items-end sm:items-center justify-center sm:p-4">
        <div
          className={`relative bg-white sm:rounded-2xl rounded-t-2xl border border-line shadow-2xl w-full ${sizeClass} animate-slideUp`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white z-10 sm:rounded-t-2xl">
            <h3 className="font-serif text-lg text-navy">{title}</h3>
            <button onClick={onClose} className="text-muted hover:text-ink p-1 -mr-1"><X size={20} /></button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function Card({ children, className = "" }) {
  return <div className={`bg-white border border-line rounded-xl ${className}`}>{children}</div>
}

export function Avatar({ name = "", size = 10 }) {
  const colors = ["#14274e", "#2b4a8b", "#3d4a6d", "#1f7a4d", "#5b6577", "#0f1d3a"]
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]).join("").toUpperCase() || "?"
  return (
    <div
      style={{ backgroundColor: colors[hash % colors.length], width: `${size * 4}px`, height: `${size * 4}px` }}
      className="flex items-center justify-center rounded-full text-white font-serif text-xs shrink-0"
    >
      {initials}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full border border-line flex items-center justify-center mb-4">
        <Icon size={22} className="text-muted" />
      </div>
      <h3 className="font-serif text-xl text-navy mb-2">{title}</h3>
      <p className="text-sm text-muted max-w-sm mb-5">{description}</p>
      {action}
    </div>
  )
}

// Status pill — tone: "ok" | "alert" | "warn" | "neutral" | "navy"
export function Badge({ children, tone = "neutral", className = "" }) {
  const tones = {
    ok: "bg-ok/10 text-ok border-ok/20",
    alert: "bg-alert/10 text-alert border-alert/20",
    warn: "bg-warn/10 text-warn border-warn/25",
    navy: "bg-navy/10 text-navy border-navy/20",
    neutral: "bg-panel text-muted border-line",
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${tones[tone]} ${className}`}>
      {children}
    </span>
  )
}

// Horizontally scrollable table — the page body must never scroll sideways.
//
//   head: string[]            column headings
//   rows: ReactNode[][]       cells may be JSX, not just text
//   minWidth                  px below which the table scrolls inside itself
//                             rather than squashing; set it to whatever the
//                             columns genuinely need.
//
// Presentational only: no sorting, no pagination, no column config. Callers
// hand it finished rows.
export function Table({ head, rows, minWidth = 560 }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th key={h} className="text-left text-[10px] uppercase tracking-[0.15em] text-muted font-semibold py-2 pr-4 last:pr-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0 align-top">
              {r.map((cell, j) => (
                <td key={j} className="py-2.5 pr-4 last:pr-0 text-ink">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
