import React, { useState, useMemo } from "react"
import {
  Search, Laptop, CheckCircle2, AlertTriangle, RotateCcw, CornerUpLeft,
  Clock, History, X, Loader2, User, Hash,
} from "lucide-react"
import { Button, Card, Modal, Badge, Input, EmptyState } from "../ui"
import { LoanStateBadge } from "./common"
import { displayName, fmtDate, activeLoanForStudent, loanState } from "../lib"
import { issueLoan, returnLoan, renewLoan } from "../actions"

export default function Lookup({ data, refresh, session, setTab }) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState(null)
  const [issuing, setIssuing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const student = useMemo(
    () => data.students.find(s => s.student_id === selectedId) || null,
    [data.students, selectedId]
  )

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || selectedId) return []
    return data.students
      .filter(s => !s.archived && (s.student_id.toLowerCase().includes(q) || displayName(s).toLowerCase().includes(q)))
      .slice(0, 8)
  }, [query, data.students, selectedId])

  const exactMatch = useMemo(
    () => data.students.find(s => s.student_id === query.trim()) || null,
    [query, data.students]
  )

  const select = (s) => { setSelectedId(s.student_id); setQuery(s.student_id); setError("") }
  const clear = () => { setSelectedId(null); setQuery(""); setError("") }

  const onSubmit = (e) => {
    e.preventDefault()
    if (exactMatch) select(exactMatch)
    else if (suggestions.length === 1) select(suggestions[0])
  }

  const activeLoan = student ? activeLoanForStudent(data.loans, student.student_id) : null
  const eligible = student && !activeLoan
  const history = useMemo(
    () => student ? data.loans.filter(l => l.student_id === student.student_id) : [],
    [student, data.loans]
  )

  const doReturn = async (loan) => {
    setBusy(true); setError("")
    try { await returnLoan(loan, session?.user?.id); await refresh() }
    catch (e) { setError(e.message || "Return failed") }
    finally { setBusy(false) }
  }
  const doRenew = async (loan) => {
    setBusy(true); setError("")
    try { await renewLoan(loan, session?.user?.id); await refresh() }
    catch (e) { setError(e.message || "Renew failed") }
    finally { setBusy(false) }
  }
  const doIssue = async (device) => {
    setBusy(true); setError("")
    try {
      await issueLoan({ studentId: student.student_id, deviceId: device.id, userId: session?.user?.id })
      await refresh()
      setIssuing(false)
    } catch (e) {
      setError(e.message || "Issue failed")
      setIssuing(false)
    } finally { setBusy(false) }
  }

  const deviceOf = (loan) => data.devices.find(d => d.id === loan.device_id)

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-navy-accent mb-1.5">Loan a Laptop</p>
        <h1 className="font-serif text-3xl sm:text-4xl text-navy leading-tight">Student lookup</h1>
      </div>

      {/* Search */}
      <form onSubmit={onSubmit} className="relative">
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedId(null) }}
            inputMode="numeric"
            autoFocus
            placeholder="Enter Student ID (e.g. 21816)"
            className="w-full pl-11 pr-24 py-3.5 text-base bg-white rounded-xl border border-line focus:border-navy-accent focus:ring-2 focus:ring-navy-accent/20 focus:outline-none"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {query && (
              <button type="button" onClick={clear} className="p-1.5 text-muted hover:text-ink"><X size={16} /></button>
            )}
            <Button type="submit" size="sm">Find</Button>
          </div>
        </div>

        {/* Live suggestions */}
        {suggestions.length > 0 && (
          <Card className="absolute z-20 mt-1.5 w-full overflow-hidden shadow-lg">
            {suggestions.map(s => (
              <button
                key={s.student_id}
                type="button"
                onClick={() => select(s)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-panel text-left border-b border-line last:border-0"
              >
                <Hash size={14} className="text-muted shrink-0" />
                <span className="font-medium tabular-nums text-ink">{s.student_id}</span>
                <span className="text-sm text-muted truncate">{displayName(s)}</span>
                {s.class && <span className="ml-auto text-xs text-muted shrink-0">{s.class}</span>}
              </button>
            ))}
          </Card>
        )}
      </form>

      {error && (
        <div className="flex items-start gap-2 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {/* No selection yet */}
      {!student && query.trim() && !suggestions.length && (
        <EmptyState icon={User} title="No student found" description={`No student matches "${query.trim()}". Check the ID, or import your student list first.`} />
      )}
      {!student && !query.trim() && (
        <EmptyState icon={Laptop} title="Enter a Student ID" description="Search above to view a student's details, eligibility, and loan history." />
      )}

      {/* Student detail */}
      {student && (
        <div className="space-y-4">
          {/* Identity + eligibility */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted">
                  <span>Student</span>
                  <span className="tabular-nums font-semibold text-ink">{student.student_id}</span>
                  {student.class && <><span>·</span><span>{student.class}</span></>}
                </div>
                <h2 className="font-serif text-2xl text-navy mt-1">{displayName(student)}</h2>
              </div>
              {eligible
                ? <Badge tone="ok"><CheckCircle2 size={13} /> Eligible</Badge>
                : <Badge tone="alert"><AlertTriangle size={13} /> Not eligible</Badge>}
            </div>

            {student.notes && (
              <div className="mt-3 text-sm text-ink/80 bg-panel rounded-lg px-3 py-2 italic">{student.notes}</div>
            )}

            {/* Action area */}
            <div className="mt-4">
              {eligible ? (
                <Button size="lg" className="w-full" onClick={() => setIssuing(true)} disabled={busy}>
                  <Laptop size={18} /> Issue a laptop
                </Button>
              ) : (
                <ActiveLoanPanel
                  loan={activeLoan}
                  device={deviceOf(activeLoan)}
                  busy={busy}
                  onReturn={() => doReturn(activeLoan)}
                  onRenew={() => doRenew(activeLoan)}
                />
              )}
            </div>
          </Card>

          {/* History */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-[0.18em] text-muted">
              <History size={14} /> History logs
              <span className="text-muted/70">({history.length})</span>
            </div>
            {history.length === 0 ? (
              <Card className="p-4 text-sm text-muted text-center">No previous loans on record.</Card>
            ) : (
              <div className="space-y-2">
                {history.map(loan => {
                  const dev = deviceOf(loan)
                  return (
                    <Card key={loan.id} className="p-3.5 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-panel flex items-center justify-center shrink-0">
                        <Laptop size={16} className="text-navy" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-ink truncate">
                          {dev ? (dev.host_name || dev.serial_number) : "Device removed"}
                          {dev?.serial_number && dev?.host_name && <span className="text-muted font-normal"> · {dev.serial_number}</span>}
                        </div>
                        <div className="text-xs text-muted flex flex-wrap gap-x-2">
                          <span>Issued {fmtDate(loan.issued_at)}</span>
                          {loan.returned_at
                            ? <span>· Returned {fmtDate(loan.returned_at)}</span>
                            : <span>· Due {fmtDate(loan.due_at)}</span>}
                          {loan.renewed_count > 0 && <span>· Renewed ×{loan.renewed_count}</span>}
                        </div>
                      </div>
                      <LoanStateBadge loan={loan} />
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Issue device picker */}
      <Modal open={issuing} onClose={() => setIssuing(false)} title={`Issue a laptop · ${student ? displayName(student) : ""}`} wide>
        <DevicePicker devices={data.devices} busy={busy} onPick={doIssue} />
      </Modal>
    </div>
  )
}

function ActiveLoanPanel({ loan, device, busy, onReturn, onRenew }) {
  const { state } = loanState(loan)
  const tone = state === "overdue" ? "alert" : state === "due_soon" ? "warn" : "navy"
  return (
    <div className={`rounded-xl border p-4 ${tone === "alert" ? "border-alert/25 bg-alert/5" : tone === "warn" ? "border-warn/25 bg-warn/5" : "border-navy/15 bg-navy/[0.03]"}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-[0.15em] text-muted flex items-center gap-1.5"><Clock size={13} /> Currently on loan</span>
        <LoanStateBadge loan={loan} />
      </div>
      <div className="text-sm font-semibold text-ink">
        {device ? (device.host_name || device.serial_number) : "Unknown device"}
      </div>
      <div className="text-xs text-muted">
        {device?.model && <span>{device.model} · </span>}
        {device?.serial_number && <span>SN {device.serial_number} · </span>}
        Due {fmtDate(loan.due_at)}
      </div>
      <div className="flex gap-2 mt-3">
        <Button variant="primary" className="flex-1" onClick={onReturn} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CornerUpLeft size={16} />} Return
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onRenew} disabled={busy}>
          <RotateCcw size={16} /> Renew 10d
        </Button>
      </div>
    </div>
  )
}

function DevicePicker({ devices, busy, onPick }) {
  const [q, setQ] = useState("")
  const available = useMemo(() => {
    const query = q.trim().toLowerCase()
    return devices
      .filter(d => d.status === "available" && !d.archived)
      .filter(d => !query
        || (d.host_name || "").toLowerCase().includes(query)
        || (d.serial_number || "").toLowerCase().includes(query)
        || (d.model || "").toLowerCase().includes(query))
      .slice(0, 50)
  }, [devices, q])

  return (
    <div className="space-y-3">
      <Input label="Find an available device" value={q} onChange={setQ} placeholder="Host name, serial, or model" autoFocus />
      {available.length === 0 ? (
        <div className="text-sm text-muted text-center py-6">No available devices match. Free one up by processing a return, or add devices in Inventory.</div>
      ) : (
        <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {available.map(d => (
            <button
              key={d.id}
              onClick={() => onPick(d)}
              disabled={busy}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg border border-line hover:border-navy/40 hover:bg-panel text-left disabled:opacity-50"
            >
              <Laptop size={18} className="text-navy shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{d.host_name || d.serial_number || "Device"}</div>
                <div className="text-xs text-muted truncate">{[d.serial_number, d.model].filter(Boolean).join(" · ")}</div>
              </div>
              <Badge tone="ok">Available</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
