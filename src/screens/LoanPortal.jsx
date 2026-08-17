import React, { useState, useMemo } from "react"
import {
  Laptop, CheckCircle2, AlertTriangle, RotateCcw, CornerUpLeft,
  Clock, History, Loader2, Users, ChevronLeft,
} from "lucide-react"
import { Button, Card, Modal, Badge, Input, Label, EmptyState } from "../ui"
import { LoanStateBadge, FieldRow, SearchSelect, ScreenHeader } from "./common"
import {
  displayName, fmtDate, splitClassForm, activeLoanLaptopFor, loanState,
  cabinByKey, ALL_CABIN_STAFF, isLoanDevice, yearLevelLabel,
} from "../lib"
import { issueLoan, returnLoan, renewLoan } from "../actions"

export default function LoanPortal({ data, refresh, session }) {
  const [student, setStudent] = useState(null)
  const [issuing, setIssuing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const filter = (s, q) => {
    const query = q.toLowerCase()
    return !s.archived && (s.student_id.toLowerCase().includes(query) || displayName(s).toLowerCase().includes(query))
  }

  // Class value: use stored class when a form column is present, else split "4I".
  const cls = student ? (student.form ? (student.class || "") : splitClassForm(student.class).class) : ""

  // Only a loan laptop makes a student ineligible. Their own assigned SL
  // laptop is not a loan and never blocks borrowing.
  const activeLoan = student ? activeLoanLaptopFor(data, student.student_id) : null
  const eligible = student && !activeLoan
  const deviceOf = (loan) => data.devices.find(d => d.id === loan.device_id)

  // Loan history means loan laptops only — never the student's own SL device.
  const history = useMemo(
    () => student
      ? data.loans.filter(l =>
          l.student_id === student.student_id &&
          isLoanDevice(data.devices.find(d => d.id === l.device_id) || {}))
      : [],
    [student, data.loans, data.devices]
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
  const doIssue = async (device, handedOverBy) => {
    setBusy(true); setError("")
    try {
      await issueLoan({
        studentId: student.student_id,
        deviceId: device.id,
        userId: session?.user?.id,
        handedOverBy,
      })
      await refresh()
      setIssuing(false)
    } catch (e) {
      setError(e.message || "Issue failed")
      setIssuing(false)
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <ScreenHeader eyebrow="IT Service Desk" title="Loan Portal" />

      <SearchSelect
        items={data.students}
        filter={filter}
        getKey={(s) => s.student_id}
        getPrimary={(s) => s.student_id}
        getSecondary={(s) => displayName(s)}
        getMeta={(s) => s.form || yearLevelLabel(s.class)}
        onSelect={(s) => { setStudent(s); setError("") }}
        placeholder="Search Student ID or name"
        autoFocus
      />

      {error && (
        <div className="flex items-start gap-2 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {!student && (
        <EmptyState icon={Users} title="Search for a student" description="Type a Student ID or name above to issue a laptop, process a return, or view loan history." />
      )}

      {student && (
        <div className="space-y-4">
          {/* Identity + eligibility */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <FieldRow label="Student ID" value={student.student_id} />
                <FieldRow label="Student Name" value={displayName(student)} />
                <FieldRow label="Year Level" value={yearLevelLabel(cls)} />
                <FieldRow label="Form" value={student.form || splitClassForm(student.class).form} />
              </div>
              {eligible
                ? <Badge tone="ok"><CheckCircle2 size={13} /> Eligible</Badge>
                : <Badge tone="alert"><AlertTriangle size={13} /> Not eligible</Badge>}
            </div>

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
                  canAct={!data.cabin || deviceOf(activeLoan)?.cabin === data.cabin}
                />
              )}
            </div>
          </Card>

          {/* Student Loan Device Logs */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-[0.18em] text-muted">
              <History size={14} /> Student Loan Device Logs
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
                          {dev ? (dev.lnb || dev.host_name) : "Device removed"}
                          {dev?.lnb && dev?.host_name && <span className="text-muted font-normal"> · {dev.host_name}</span>}
                        </div>
                        <div className="text-xs text-muted flex flex-wrap gap-x-2">
                          <span>Issued {fmtDate(loan.issued_at)}</span>
                          {loan.returned_at
                            ? <span>· Returned {fmtDate(loan.returned_at)}</span>
                            : <span>· Due {fmtDate(loan.due_at)}</span>}
                          {loan.renewed_count > 0 && <span>· Renewed ×{loan.renewed_count}</span>}
                          {loan.handed_over_by && <span>· By {loan.handed_over_by}</span>}
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
        <DevicePicker devices={data.devices} busy={busy} onIssue={doIssue} myCabin={data.cabin} />
      </Modal>
    </div>
  )
}

// `canAct` is false for a cabin custodian looking at a loan from someone
// else's cupboard. The "loans update" policy in 0008 would reject it anyway;
// this turns a permissions error into an explanation.
function ActiveLoanPanel({ loan, device, busy, onReturn, onRenew, canAct = true }) {
  const { state } = loanState(loan)
  const tone = state === "overdue" ? "alert" : state === "due_soon" ? "warn" : "navy"
  return (
    <div className={`rounded-xl border p-4 ${tone === "alert" ? "border-alert/25 bg-alert/5" : tone === "warn" ? "border-warn/25 bg-warn/5" : "border-navy/15 bg-navy/[0.03]"}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] uppercase tracking-[0.15em] text-muted flex items-center gap-1.5"><Clock size={13} /> Currently on loan</span>
        <LoanStateBadge loan={loan} />
      </div>
      <div className="text-sm font-semibold text-ink">
        {device ? (device.lnb || device.host_name) : "Unknown device"}
      </div>
      <div className="text-xs text-muted">
        {device?.model && <span>{device.model} · </span>}
        {device?.host_name && <span>{device.host_name} · </span>}
        Due {fmtDate(loan.due_at)}
      </div>
      {canAct ? (
        <div className="flex gap-2 mt-3">
          <Button variant="primary" className="flex-1" onClick={onReturn} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <CornerUpLeft size={16} />} Return
          </Button>
          <Button variant="secondary" className="flex-1" onClick={onRenew} disabled={busy}>
            <RotateCcw size={16} /> Renew 10d
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted mt-3 flex items-start gap-1.5">
          <AlertTriangle size={13} className="shrink-0 mt-0.5 text-warn" />
          <span>
            This laptop belongs to {cabinByKey(device?.cabin)?.label || "another cabin"}, so it has
            to be returned there. You can still see the loan.
          </span>
        </p>
      )}
    </div>
  )
}

// Two steps: choose an available loan laptop, then record which cabin
// custodian is handing it over. Only LNB laptops are loanable — the devices
// table also holds the CSV-imported student laptops.
//
// `myCabin` is set for a cabin custodian, who may only lend out of their own
// cupboard. The same rule is enforced by the "loans insert" policy in 0008;
// filtering here just means they are never offered a laptop the database
// would refuse. Custodians still READ every loan laptop, because eligibility
// is decided by matching a student's active loan to its device and a laptop
// they could not see would let that student borrow a second one.
function DevicePicker({ devices, busy, onIssue, myCabin }) {
  const [q, setQ] = useState("")
  const [chosen, setChosen] = useState(null)
  const [staff, setStaff] = useState("")

  const available = useMemo(() => {
    const query = q.trim().toLowerCase()
    return devices
      .filter(d => isLoanDevice(d) && d.status === "available")
      .filter(d => !myCabin || d.cabin === myCabin)
      .filter(d => !query
        || (d.lnb || "").toLowerCase().includes(query)
        || (d.serial_number || "").toLowerCase().includes(query)
        || (d.model || "").toLowerCase().includes(query))
      .slice(0, 50)
  }, [devices, q, myCabin])

  // Step 2 — who is handing it over.
  if (chosen) {
    const cabin = cabinByKey(chosen.cabin)
    // No cabin recorded yet → let any custodian be credited.
    const options = cabin ? cabin.staff : ALL_CABIN_STAFF

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => { setChosen(null); setStaff("") }}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink -mt-1"
        >
          <ChevronLeft size={14} /> Choose a different laptop
        </button>

        <div className="flex items-center gap-3 px-3.5 py-3 rounded-lg border border-navy/25 bg-navy/[0.03]">
          <Laptop size={18} className="text-navy shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-ink truncate">
              {chosen.lnb}
              {chosen.serial_number && <span className="text-muted font-normal"> · {chosen.serial_number}</span>}
            </div>
            <div className="text-xs text-muted truncate">
              {[cabin?.label, chosen.model].filter(Boolean).join(" · ") || "No cabin assigned"}
            </div>
          </div>
        </div>

        <div>
          <Label>Handed over by</Label>
          <div className="grid grid-cols-2 gap-2">
            {options.map(name => (
              <button
                key={name}
                type="button"
                onClick={() => setStaff(name)}
                className={`px-3.5 py-2.5 rounded-lg border text-sm font-medium text-left transition-colors ${
                  staff === name
                    ? "border-navy bg-navy text-white"
                    : "border-line bg-white text-ink hover:border-navy/40 hover:bg-panel"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
          {!cabin && (
            <p className="text-xs text-muted mt-2">
              This laptop has no cabin recorded yet, so all IT staff are listed.
            </p>
          )}
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={!staff || busy}
          onClick={() => onIssue(chosen, staff)}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Issue {chosen.lnb}
        </Button>
      </div>
    )
  }

  // Step 1 — pick the laptop.
  return (
    <div className="space-y-3">
      <Input label="Find an available loan laptop" value={q} onChange={setQ} placeholder="LNB, serial, or model" autoFocus />
      {available.length === 0 ? (
        <div className="text-sm text-muted text-center py-6">
          {myCabin ? (
            <>
              No available loan laptops in {cabinByKey(myCabin)?.label || "your cabin"}. You can
              only lend from your own cupboard — free one up by processing a return, or ask IT
              if a laptop is missing its cabin.
            </>
          ) : (
            <>
              No available loan laptops match. Only LNB laptops can be issued — a student's own
              SL laptop is never loaned. Free one up by processing a return, or import your inventory.
            </>
          )}
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {available.map(d => (
            <button
              key={d.id}
              onClick={() => setChosen(d)}
              disabled={busy}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-lg border border-line hover:border-navy/40 hover:bg-panel text-left disabled:opacity-50"
            >
              <Laptop size={18} className="text-navy shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">
                  {d.lnb}
                  {d.serial_number && <span className="text-muted font-normal"> · {d.serial_number}</span>}
                </div>
                <div className="text-xs text-muted truncate">
                  {[cabinByKey(d.cabin)?.label, d.model].filter(Boolean).join(" · ") || "No cabin assigned"}
                </div>
              </div>
              <Badge tone="ok">Available</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
