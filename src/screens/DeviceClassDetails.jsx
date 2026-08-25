import React, { useState, useMemo, useCallback } from "react"
import { Layers, Loader2, AlertTriangle, Search } from "lucide-react"
import { supabase } from "../supabase"
import { Button, Card, Select, EmptyState, Table } from "../ui"
import { ScreenHeader } from "./common"
import {
  displayName, classLabel, yearLevelNum, yearLevelLabel,
  deviceForStudent, serialKey,
} from "../lib"

// ============================================================
// DEVICE CLASS DETAILS
//
// Pick a class, pick a form, submit — one table of every student in it, the
// laptop they hold, and whether that laptop is enrolled where it should be.
// The same answer used to take one student lookup at a time on the Student
// Devices tab, with two collapsible panels opened by hand each time.
//
// NetSupport School is the one column staff write to. No console exports it,
// so it is a checkbox over devices.netsupport_school (migration 0011).
// ============================================================

// PostgREST puts an .in() filter in the query string, so the whole cohort of
// serials travels in the URL. A year level is ~250 laptops, comfortably fine,
// but nothing caps how big a year group can get — batch so the URL cannot grow
// without bound.
const KEYS_PER_REQUEST = 200

// serial_key -> device_name for one export mirror.
//
// Deliberately NOT useExportRecord (StudentDevices.jsx): that fetches one
// serial on panel expand, which is right for a single student and wrong here —
// it would fire a request per row.
async function fetchDeviceNames(table, keys) {
  const out = new Map()
  for (let i = 0; i < keys.length; i += KEYS_PER_REQUEST) {
    const batch = keys.slice(i, i + KEYS_PER_REQUEST)
    const { data, error } = await supabase
      .from(table)
      .select("serial_key, device_name")
      .in("serial_key", batch)
    if (error) throw error
    for (const r of data) out.set(r.serial_key, r.device_name)
  }
  return out
}

// A student's year level as a number, or NaN when the roster has no year for
// them. yearLevelNum alone is not enough here: Number("") is 0, so a student
// with a blank class would silently file under Prep.
const yearOf = (s) => (String(s.class ?? "").trim() ? yearLevelNum(s) : NaN)

const byNatural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })

// Blank reads as an em dash, the same treatment FieldRow gives it elsewhere.
const cell = (v) => (v ? v : <span className="text-muted">—</span>)

// The NetSupport School cell. A student with no laptop has no row to write to,
// so it says so rather than offering a box that could never be saved.
function SchoolCheck({ row, canEdit, saving, onToggle }) {
  if (!row.device) return <span className="text-xs text-muted">No laptop</span>
  return (
    <span className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={row.school}
        disabled={!canEdit || saving}
        onChange={() => onToggle(row)}
        className="w-4 h-4 accent-navy cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={"NetSupport School on " + (row.device.host_name || row.device.serial_number || "this laptop")}
      />
      {saving && <Loader2 size={13} className="animate-spin text-muted" />}
    </span>
  )
}

export default function DeviceClassDetails({ data, patchLocal }) {
  const [cls, setCls] = useState("")
  const [form, setForm] = useState("")
  const [phase, setPhase] = useState("idle")     // idle | loading | done
  const [result, setResult] = useState(null)     // { cls, form, rows }
  const [error, setError] = useState("")
  const [savingId, setSavingId] = useState(null)

  // Cabin custodians never reach this screen — App.jsx hides the tab from them
  // — but the checkbox is gated anyway, so the UI can never offer a write that
  // RLS would reject.
  const canEdit = !data.cabin

  const classOptions = useMemo(() => {
    const years = new Set()
    for (const s of data.students) {
      if (s.archived) continue
      const n = yearOf(s)
      if (Number.isFinite(n)) years.add(n)
    }
    return [...years]
      .sort((a, b) => a - b)
      .map(n => ({ value: String(n), label: yearLevelLabel(n) }))
  }, [data.students])

  // Cascades off the chosen class, so Year 8 offers 8A-8J and nothing else.
  const formOptions = useMemo(() => {
    if (!cls) return []
    const forms = new Set()
    for (const s of data.students) {
      if (s.archived || String(yearOf(s)) !== cls) continue
      const f = classLabel(s)
      if (f) forms.add(f)
    }
    return [...forms].sort(byNatural).map(f => ({ value: f, label: f }))
  }, [data.students, cls])

  // A form only means anything inside its own class, so changing the class
  // clears it rather than leaving "8I" selected under Year 9.
  const pickClass = (v) => { setCls(v); setForm("") }

  const submit = useCallback(async () => {
    if (!cls) return
    setPhase("loading"); setError("")
    try {
      const cohort = data.students
        .filter(s => !s.archived && String(yearOf(s)) === cls && (!form || classLabel(s) === form))
        .sort((a, b) =>
          byNatural(classLabel(a), classLabel(b)) ||
          displayName(a).localeCompare(displayName(b)))

      // Students and devices are already fully paged into memory by useAppData,
      // so this join is local. Only the two export mirrors are fetched, and
      // only for the serials this cohort actually holds.
      const paired = cohort.map(s => ({ student: s, device: deviceForStudent(data, s.student_id) }))
      const keys = [...new Set(
        paired.map(p => (p.device ? serialKey(p.device.serial_number) : "")).filter(Boolean)
      )]

      const [intune, dna] = keys.length
        ? await Promise.all([
            fetchDeviceNames("device_intune", keys),
            fetchDeviceNames("device_netsupport", keys),
          ])
        : [new Map(), new Map()]

      setResult({
        cls,
        form,
        rows: paired.map(({ student, device }) => {
          const key = device ? serialKey(device.serial_number) : ""
          return {
            student,
            device,
            intune: key ? intune.get(key) : null,
            dna: key ? dna.get(key) : null,
            school: !!device?.netsupport_school,
          }
        }),
      })
      setPhase("done")
    } catch (e) {
      setError(e.message || "Could not load this class.")
      setPhase("idle")
    }
  }, [cls, form, data])

  // Optimistic on both sides: the table moves now, and so does the app-wide
  // devices array, so a tick survives re-submitting the form. Deliberately no
  // refresh() — that re-reads ~2,900 students and ~1,850 devices, which is
  // absurd for one checkbox.
  const toggleSchool = async (row) => {
    if (!row.device || !canEdit) return
    const id = row.device.id
    const next = !row.school

    const apply = (v) => {
      setResult(r => (r ? { ...r, rows: r.rows.map(x => (x.device?.id === id ? { ...x, school: v } : x)) } : r))
      patchLocal("devices", ds => ds.map(d => (d.id === id ? { ...d, netsupport_school: v } : d)))
    }

    setSavingId(id); setError("")
    apply(next)
    const { error: e } = await supabase.from("devices").update({ netsupport_school: next }).eq("id", id)
    if (e) {
      apply(!next)
      setError(e.message || "Could not save that tick.")
    }
    setSavingId(null)
  }

  const head = [
    "Class", "Student ID", "Student Name", "Device Name",
    "Serial Number", "Intune Device Name", "NetSupport DNA", "NetSupport School",
  ]

  const rows = (result?.rows || []).map(row => [
    cell(classLabel(row.student)),
    <span className="tabular-nums">{row.student.student_id}</span>,
    displayName(row.student),
    cell(row.device?.host_name),
    row.device?.serial_number
      ? <span className="tabular-nums">{row.device.serial_number}</span>
      : cell(null),
    cell(row.intune),
    cell(row.dna),
    <SchoolCheck row={row} canEdit={canEdit} saving={savingId === row.device?.id} onToggle={toggleSchool} />,
  ])

  const counts = useMemo(() => {
    const r = result?.rows || []
    return {
      students: r.length,
      withDevice: r.filter(x => x.device).length,
      ticked: r.filter(x => x.school).length,
    }
  }, [result])

  const scope = result
    ? yearLevelLabel(result.cls) + (result.form ? " · " + result.form : " · all forms")
    : ""

  return (
    <div className="space-y-5 animate-fadeIn">
      <ScreenHeader eyebrow="IT Service Desk" title="Device Class Details" />

      <Card className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Select
            label="Class"
            value={cls}
            onChange={pickClass}
            options={classOptions}
            placeholder="Select a class"
          />
          <Select
            label="Form"
            value={form}
            onChange={setForm}
            options={formOptions}
            placeholder={cls ? "All forms" : "Select a class first"}
          />
        </div>
        <Button
          variant="primary"
          onClick={submit}
          disabled={!cls || phase === "loading"}
          className="w-full sm:w-auto"
        >
          {phase === "loading"
            ? <Loader2 size={16} className="animate-spin" />
            : <Search size={16} />}
          Submit
        </Button>
      </Card>

      {error && (
        <div className="flex items-start gap-2 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {!result && phase !== "loading" && (
        <EmptyState
          icon={Layers}
          title="Pick a class"
          description="Choose a class and, if you want to narrow it, a form. Submit to list every student in it with their laptop and how that laptop is enrolled."
        />
      )}

      {phase === "done" && result && (
        result.rows.length === 0 ? (
          <Card className="p-4">
            <div className="text-sm text-muted">No students in {scope}.</div>
          </Card>
        ) : (
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.18em] text-muted shrink-0">{scope}</span>
              <span className="h-px bg-line flex-1" />
              <span className="text-xs text-muted shrink-0 tabular-nums">
                {counts.students} students · {counts.withDevice} with a laptop · {counts.ticked} NetSupport School
              </span>
            </div>
            <Card className="px-4 pb-1">
              <Table head={head} rows={rows} minWidth={980} />
            </Card>
          </div>
        )
      )}
    </div>
  )
}
