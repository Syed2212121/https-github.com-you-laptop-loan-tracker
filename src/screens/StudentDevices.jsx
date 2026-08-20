import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { GraduationCap, HardDrive, AlertTriangle, Edit3, Loader2 } from "lucide-react"
import { supabase } from "../supabase"
import { Card, EmptyState, Modal, Input, Button } from "../ui"
import { FieldRow, FieldPairRow, SearchSelect, ScreenHeader, SectionCard, CollapsibleSection } from "./common"
import {
  displayName, classLabel, yearLevelNum, splitClassForm, parseName,
  deviceForStudent, yearLevelLabel, fmtDate, serialKey,
} from "../lib"

// FieldRow shows "—" for a blank, so a card whose every value is blank is pure
// noise. Mirrors FieldRow's own rule that 0 counts as a real value.
const anyFilled = (...vals) => vals.some(v => v === 0 || (v != null && v !== ""))

// The two external exports, in the field order the source system lists them.
const INTUNE_FIELDS = [
  ["Device name", "device_name"],
  ["Serial number", "serial_number"],
  ["Manufacturer", "manufacturer"],
  ["Model", "model"],
  ["Management name", "management_name"],
  ["Primary user UPN", "primary_user_upn"],
  ["Primary user email address", "primary_user_email"],
  ["Primary user display name", "primary_user_display_name"],
  ["Compliance", "compliance"],
  ["Ownership", "ownership"],
  ["SkuFamily", "sku_family"],
  ["JoinType", "join_type"],
]

const NETSUPPORT_FIELDS = [
  ["Device_Name", "device_name"],
  ["PC_NODE_ID", "pc_node_id"],
  ["Device_Owner", "device_owner"],
  ["Department", "department"],
  ["UserName", "user_name"],
  ["LogonName", "logon_name"],
  ["SerialNumber", "serial_number"],
]

// ------------------------------------------------------------
// EXTERNAL EXPORT PANELS
// ------------------------------------------------------------

// Fetches one row from an export mirror on demand and remembers it for the rest
// of the session.
//
// Deliberately NOT part of useAppData: bulk-loading both export tables at app
// start would pull thousands of rows to answer a question staff ask about one
// laptop at a time. Fetching on first expand keeps the cost proportional.
function useExportRecord(table, serial, enabled) {
  const cache = useRef(new Map())
  const [state, setState] = useState({ status: "idle", row: null, error: "" })

  useEffect(() => {
    if (!enabled || !serial) return
    const key = `${table}:${serial}`
    if (cache.current.has(key)) {
      setState({ status: "done", row: cache.current.get(key), error: "" })
      return
    }
    let cancelled = false
    setState({ status: "loading", row: null, error: "" })
    // maybeSingle, not single: zero rows is the normal case for a laptop that
    // was not in the last export, and single() raises PGRST116 on zero.
    supabase.from(table).select("*").eq("serial_key", serial).maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { setState({ status: "error", row: null, error: error.message }); return }
        cache.current.set(key, data || null)
        setState({ status: "done", row: data || null, error: "" })
      })
    return () => { cancelled = true }
  }, [table, serial, enabled])

  return state
}

// One collapsible read-only panel over an export mirror. Stays visible when
// there is no matching row — an absent panel reads as "this screen is broken",
// an empty one correctly reads as "this laptop is not in that system".
function ExportPanel({ title, table, serial, fields, open, onToggle }) {
  const { status, row, error } = useExportRecord(table, serial, open)

  const meta = status === "loading" ? "Loading…"
    : status === "error" ? "Unavailable"
    : status === "done" && !row ? "No record"
    : status === "done" && row?.imported_at ? `Imported ${fmtDate(row.imported_at)}`
    : null

  return (
    <CollapsibleSection title={title} meta={meta} open={open} onToggle={onToggle}>
      {status === "loading" && (
        <div className="flex items-center gap-2 py-3 text-sm text-muted">
          <Loader2 size={15} className="animate-spin" /> Looking up {serial}…
        </div>
      )}
      {status === "error" && (
        <div className="py-3 text-sm text-alert">Could not read this export — {error}</div>
      )}
      {status === "done" && !row && (
        <div className="py-3 text-sm text-muted">
          No row for serial <span className="text-ink">{serial}</span> in the last import.
        </div>
      )}
      {status === "done" && row && fields.map(([label, key]) => (
        <FieldRow key={key} label={label} value={row[key]} />
      ))}
    </CollapsibleSection>
  )
}

// ------------------------------------------------------------
// EDIT MODALS — admin only, and never a cabin custodian (RLS rejects their
// writes outright, so the button would only ever produce an error).
// ------------------------------------------------------------

function StudentEditModal({ open, onClose, student, onSaved }) {
  const [form, setForm] = useState({ first_name: "", last_name: "", cls: "" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !student) return
    // Older rows carry only full_name. parseName splits it so the two inputs are
    // never blank against a student who plainly has a name.
    const seed = (student.first_name || student.last_name)
      ? { first_name: student.first_name || "", last_name: student.last_name || "" }
      : parseName(student.full_name)
    setForm({ first_name: seed.first_name, last_name: seed.last_name, cls: classLabel(student) })
    setError("")
  }, [open, student])

  const save = async () => {
    const first = form.first_name.trim()
    const last = form.last_name.trim()
    if (!first && !last) { setError("A student needs a name."); return }

    const cls = form.cls.trim()
    const payload = {
      first_name: first || null,
      last_name: last || null,
      full_name: `${first} ${last}`.trim(),
      form: cls || null,
    }

    // The year level lives in `class` and drives the Year-4 1:1 rule, while the
    // whole form ("8F") lives in `form`. Only rewrite the year level when the
    // typed value actually leads with a number — otherwise a correction that
    // touched just the letter would turn the class into "F" and take the rule
    // down with it. Clearing the field clears both.
    const parsed = splitClassForm(cls)
    if (!cls) payload.class = null
    else if (/^\d+$/.test(parsed.class)) payload.class = parsed.class

    setBusy(true); setError("")
    try {
      const { error: e } = await supabase.from("students")
        .update(payload)
        .eq("student_id", student.student_id)
      if (e) throw e
      await onSaved()
      onClose()
    } catch (e) {
      setError(e.message || "Save failed")
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit student">
      <div className="space-y-3">
        <FieldRow label="Student ID" value={student?.student_id} />
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="First name" value={form.first_name} onChange={v => setForm({ ...form, first_name: v })} />
          <Input label="Last name" value={form.last_name} onChange={v => setForm({ ...form, last_name: v })} />
        </div>
        <Input label="Class" value={form.cls} onChange={v => setForm({ ...form, cls: v })} placeholder="8F" />
        <p className="text-[11px] text-muted">
          Class as SIMS writes it — the whole form, e.g. <span className="text-ink">8F</span>. The
          year level is taken from the number in front of it.
        </p>
        <p className="text-[11px] text-muted">
          Student ID is the key every device assignment points at, so it is not editable here.
          Note the next student roster import will replace anything changed here with whatever
          SIMS says.
        </p>
        {error && <div className="text-sm text-alert">{error}</div>}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy} className="flex-1">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DeviceEditModal({ open, onClose, device, onSaved }) {
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || !device) return
    setForm({
      host_name: device.host_name || "",
      serial_number: device.serial_number || "",
      model: device.model || "",
      source_year: device.source_year || "",
    })
    setError("")
  }, [open, device])

  const save = async () => {
    setBusy(true); setError("")
    try {
      // Only these four. `status` stays untouched — student laptops sit at
      // 'assigned' and flipping that would make one look like loan stock — and
      // `assigned_student_id` is left alone so an edit can never re-home a
      // laptop by accident.
      const { error: e } = await supabase.from("devices").update({
        host_name: form.host_name?.trim() || null,
        serial_number: form.serial_number?.trim() || null,
        model: form.model?.trim() || null,
        source_year: form.source_year?.trim() || null,
      }).eq("id", device.id)
      if (e) throw e
      await onSaved()
      onClose()
    } catch (e) {
      setError(e.message?.includes("duplicate") ? "That serial number already exists." : (e.message || "Save failed"))
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Edit device" wide>
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Device name" value={form.host_name || ""} onChange={v => setForm({ ...form, host_name: v })} placeholder="SL-21816" />
          <Input label="Serial number" value={form.serial_number || ""} onChange={v => setForm({ ...form, serial_number: v })} placeholder="PW0KX282" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input label="Model" value={form.model || ""} onChange={v => setForm({ ...form, model: v })} placeholder="Lenovo 13w 2in1 Gen 3" />
          <Input label="Issued" value={form.source_year || ""} onChange={v => setForm({ ...form, source_year: v })} placeholder="2023" />
        </div>
        <p className="text-[11px] text-muted">
          Serial is the key the SIMS import matches on, and what the Intune and NetSupport
          panels look up. Change it and the next import creates a second row for this laptop.
        </p>

        {device && !device.assigned_student_id && (
          <div className="flex items-start gap-2 text-xs bg-warn/5 border border-warn/25 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5 text-warn" />
            <span className="text-ink">
              This laptop is matched to the student by its device name alone — it carries no
              stored assignment. Changing the name here will break that link.
            </span>
          </div>
        )}

        {error && <div className="text-sm text-alert">{error}</div>}
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button variant="primary" onClick={save} disabled={busy} className="flex-1">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null}Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}

const EditButton = ({ onClick, title }) => (
  <button onClick={onClick} title={title} className="p-1 -mr-1 text-muted hover:text-navy">
    <Edit3 size={15} />
  </button>
)

// ------------------------------------------------------------

export default function StudentDevices({ data, refresh }) {
  // Hold the ID, not the row. SearchSelect hands back the object it matched, and
  // keeping that snapshot meant an edited name never reappeared until reload.
  const [studentId, setStudentId] = useState(null)
  const [editing, setEditing] = useState(null)      // "student" | "device" | null
  const [openPanel, setOpenPanel] = useState(null)  // "intune" | "netsupport" | null

  const student = useMemo(
    () => data.students.find(s => s.student_id === studentId) || null,
    [data.students, studentId]
  )

  const filter = useCallback((s, q) => {
    const query = q.toLowerCase()
    return !s.archived && (s.student_id.toLowerCase().includes(query) || displayName(s).toLowerCase().includes(query))
  }, [])

  const device = student ? deviceForStudent(data, student.student_id) : null

  // The 1:1 program starts at Year 4, so Prep–Yr 3 having no laptop is normal
  // and anything above that is worth a second look.
  const year = student ? yearLevelNum(student) : NaN
  const expectsDevice = Number.isFinite(year) && year >= 4

  // Admins only, and never a cabin custodian — RLS rejects their writes anyway.
  const canEdit = data.isAdmin && !data.cabin

  // No import path fills the insurance columns yet, so for most students that
  // card would be three em dashes. Only show a card once it has content.
  const hasInsurance = anyFilled(device?.insurance_status, device?.insurance_log, device?.current_condition)
  const hasNotes = anyFilled(device?.notes)

  // Both export mirrors key on the repaired, upper-cased serial. Running the
  // device's own serial through the same funnel on read costs nothing and
  // covers rows that were added or edited by hand rather than imported.
  const key = device?.serial_number ? serialKey(device.serial_number) : ""

  return (
    <div className="space-y-5 animate-fadeIn">
      <ScreenHeader eyebrow="IT Service Desk" title="Student Devices" />

      <SearchSelect
        items={data.students}
        filter={filter}
        getKey={(s) => s.student_id}
        getPrimary={(s) => s.student_id}
        getSecondary={(s) => displayName(s)}
        getMeta={(s) => classLabel(s) || yearLevelLabel(s.class)}
        onSelect={(s) => { setStudentId(s.student_id); setOpenPanel(null) }}
        placeholder="Search Student ID or name"
        autoFocus
        inputMode="text"
      />

      {!student && (
        <EmptyState icon={GraduationCap} title="Search for a student" description="Type a Student ID or name above to view their details and assigned device." />
      )}

      {student && (
        <>
          <div className="space-y-3">
            <SectionCard
              title="Student"
              action={canEdit && <EditButton onClick={() => setEditing("student")} title="Edit student" />}
            >
              <FieldPairRow items={[
                { label: "Student ID", value: student.student_id },
                { label: "Class", value: classLabel(student) },
              ]} />
              <FieldPairRow items={[{ label: "Student Name", value: displayName(student) }]} />
            </SectionCard>

            {device && (
              <SectionCard
                title="Device"
                action={canEdit && <EditButton onClick={() => setEditing("device")} title="Edit device" />}
              >
                <FieldPairRow items={[
                  { label: "Device Name", value: device.host_name },
                  { label: "Serial No", value: device.serial_number },
                ]} />
                <FieldPairRow items={[
                  { label: "Model", value: device.model },
                  { label: "Issued", value: device.source_year },
                ]} />
              </SectionCard>
            )}

            {hasInsurance && (
              <SectionCard title="Insurance & Condition">
                <FieldRow label="Insurance" value={device?.insurance_status} />
                <FieldRow label="Insurance Log" value={device?.insurance_log} />
                <FieldRow label="Current Condition" value={device?.current_condition} />
              </SectionCard>
            )}

            {hasNotes && (
              <SectionCard title="Notes">
                <FieldPairRow items={[{ label: "Notes", value: device?.notes }]} />
              </SectionCard>
            )}

            {/* Cabin custodians cannot read either export — both carry student
                names and emails, which 0008 keeps away from them. */}
            {key && !data.cabin && (
              <>
                <ExportPanel
                  title="Device_Intune-SIMS"
                  table="device_intune"
                  serial={key}
                  fields={INTUNE_FIELDS}
                  open={openPanel === "intune"}
                  onToggle={() => setOpenPanel(openPanel === "intune" ? null : "intune")}
                />
                <ExportPanel
                  title="NetSupport DNA"
                  table="device_netsupport"
                  serial={key}
                  fields={NETSUPPORT_FIELDS}
                  open={openPanel === "netsupport"}
                  onToggle={() => setOpenPanel(openPanel === "netsupport" ? null : "netsupport")}
                />
              </>
            )}
          </div>

          {!device && (
            // A cabin custodian cannot read the student SL fleet at all, so
            // every student would otherwise look like a missing-laptop case.
            data.cabin ? (
              <Card className="p-4">
                <div className="flex items-start gap-2 text-sm text-muted">
                  <HardDrive size={16} className="shrink-0 mt-0.5" />
                  <span>Student laptops are not visible to cabin staff. This says nothing about whether this student has one — ask IT if you need to check.</span>
                </div>
              </Card>
            ) : expectsDevice ? (
              <Card className="p-4 border-warn/30 bg-warn/5">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5 text-warn" />
                  <span className="text-ink">No laptop assigned. Students from Year 4 up are normally on the 1:1 program — check the SIMS device list for this student.</span>
                </div>
              </Card>
            ) : (
              <Card className="p-4">
                <div className="flex items-start gap-2 text-sm text-muted">
                  <HardDrive size={16} className="shrink-0 mt-0.5" />
                  <span>No laptop assigned — expected below Year 4.</span>
                </div>
              </Card>
            )
          )}

          <StudentEditModal
            open={editing === "student"}
            onClose={() => setEditing(null)}
            student={student}
            onSaved={refresh}
          />
          <DeviceEditModal
            open={editing === "device"}
            onClose={() => setEditing(null)}
            device={device}
            onSaved={refresh}
          />
        </>
      )}
    </div>
  )
}
