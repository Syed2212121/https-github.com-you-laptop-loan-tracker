import React, { useState, useMemo } from "react"
import { Laptop, CornerUpLeft, RotateCcw, Loader2, ClipboardList } from "lucide-react"
import { Card, Button, EmptyState } from "../ui"
import { LoanStateBadge } from "./common"
import { displayName, fmtDate, loanState } from "../lib"
import { returnLoan, renewLoan } from "../actions"

const FILTERS = [
  { key: "active", label: "Active" },
  { key: "overdue", label: "Overdue" },
  { key: "returned", label: "Returned" },
  { key: "all", label: "All" },
]

export default function Loans({ data, refresh, session }) {
  const [filter, setFilter] = useState("active")
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState("")

  const studentName = (id) => {
    const s = data.students.find(st => st.student_id === id)
    return s ? displayName(s) : id
  }
  const deviceOf = (loan) => data.devices.find(d => d.id === loan.device_id)

  const rows = useMemo(() => {
    let list = data.loans
    if (filter === "active") list = list.filter(l => l.status === "active")
    else if (filter === "returned") list = list.filter(l => l.status === "returned")
    else if (filter === "overdue") list = list.filter(l => l.status === "active" && loanState(l).state === "overdue")
    // sort: active by soonest due first; returned by most recently returned
    return [...list].sort((a, b) => {
      if (a.status === "active" && b.status === "active") return new Date(a.due_at) - new Date(b.due_at)
      if (a.status !== b.status) return a.status === "active" ? -1 : 1
      return new Date(b.returned_at || b.issued_at) - new Date(a.returned_at || a.issued_at)
    })
  }, [data.loans, filter])

  const counts = useMemo(() => ({
    active: data.loans.filter(l => l.status === "active").length,
    overdue: data.loans.filter(l => l.status === "active" && loanState(l).state === "overdue").length,
    returned: data.loans.filter(l => l.status === "returned").length,
    all: data.loans.length,
  }), [data.loans])

  const act = async (fn, loan) => {
    setBusyId(loan.id); setError("")
    try { await fn(loan, session?.user?.id); await refresh() }
    catch (e) { setError(e.message || "Action failed") }
    finally { setBusyId(null) }
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-navy-accent mb-1.5">Transactions</p>
        <h1 className="font-serif text-3xl sm:text-4xl text-navy leading-tight">Loans</h1>
      </div>

      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-colors ${
              filter === f.key ? "bg-navy text-white border-navy" : "bg-white text-muted border-line hover:border-navy/30"
            }`}
          >
            {f.label} <span className="tabular-nums opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">{error}</div>}

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nothing here" description="No loans match this filter." />
      ) : (
        <div className="space-y-2">
          {rows.map(loan => {
            const dev = deviceOf(loan)
            const isActive = loan.status === "active"
            const busy = busyId === loan.id
            return (
              <Card key={loan.id} className="p-3.5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-panel flex items-center justify-center shrink-0">
                    <Laptop size={16} className="text-navy" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink truncate">{studentName(loan.student_id)}</div>
                    <div className="text-xs text-muted truncate">
                      <span className="tabular-nums">{loan.student_id}</span>
                      {" · "}{dev ? (dev.host_name || dev.serial_number) : "device removed"}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      Issued {fmtDate(loan.issued_at)}
                      {loan.returned_at ? ` · Returned ${fmtDate(loan.returned_at)}` : ` · Due ${fmtDate(loan.due_at)}`}
                      {loan.renewed_count > 0 && ` · ×${loan.renewed_count}`}
                    </div>
                  </div>
                  <LoanStateBadge loan={loan} />
                </div>
                {isActive && (
                  <div className="flex gap-2 mt-3">
                    <Button variant="primary" size="sm" className="flex-1" onClick={() => act(returnLoan, loan)} disabled={busy}>
                      {busy ? <Loader2 size={14} className="animate-spin" /> : <CornerUpLeft size={14} />} Return
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1" onClick={() => act(renewLoan, loan)} disabled={busy}>
                      <RotateCcw size={14} /> Renew
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
