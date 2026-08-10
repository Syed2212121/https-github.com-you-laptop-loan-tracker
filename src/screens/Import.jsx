import React, { useState } from "react"
import Papa from "papaparse"
import { Upload, FileText, Users, HardDrive, ClipboardList, CheckCircle2, AlertTriangle, Loader2, ArrowRight, Boxes, RefreshCw, PlusCircle } from "lucide-react"
import { supabase } from "../supabase"
import { Card, Button } from "../ui"
import { parseName, parseAuDate, addDays, splitClassForm, normalizeCabin, LOAN_DAYS } from "../lib"

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

// Build a de-duplicated preview from parsed CSV rows.
function buildPreview(rows) {
  const students = new Map()
  const devices = new Map()
  const pairs = []
  let skipped = 0

  for (const r of rows) {
    const sid = String(r["Student ID"] ?? "").trim()
    const serial = String(r["Device SN"] ?? "").trim()
    if (!sid && !serial) continue          // blank line
    if (!sid || !serial) { skipped++; continue }

    if (!students.has(sid)) {
      const nm = parseName(r["Student Name"])
      const cf = splitClassForm(r["Student Yr."])   // "4I" → { class: "4", form: "I" }
      students.set(sid, {
        student_id: sid,
        first_name: nm.first_name || null,
        last_name: nm.last_name || null,
        full_name: nm.full_name || null,
        class: cf.class || null,
        form: cf.form || null,
      })
    }
    if (!devices.has(serial)) {
      devices.set(serial, {
        serial_number: serial,
        host_name: (r["Host Name"] || "").trim() || null,
        model: (r["Model"] || "").trim() || null,
      })
    }
    pairs.push({ student_id: sid, serial, original_issue_date: parseAuDate(r["Collection Date"]) })
  }

  // One active loan per student and per device → dedupe, keep first occurrence.
  const seenStu = new Set(), seenDev = new Set(), loanPairs = []
  for (const p of pairs) {
    if (seenStu.has(p.student_id) || seenDev.has(p.serial)) continue
    seenStu.add(p.student_id); seenDev.add(p.serial); loanPairs.push(p)
  }

  return {
    students: [...students.values()],
    devices: [...devices.values()],
    loanPairs,
    skipped,
    total: rows.length,
  }
}

export default function Import({ refresh, setTab }) {
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState(null)
  const [phase, setPhase] = useState("idle") // idle | preview | importing | done
  const [results, setResults] = useState(null)
  const [error, setError] = useState("")

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setError(""); setResults(null); setPreview(null); setPhase("idle")
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        try {
          const p = buildPreview(res.data)
          if (!p.students.length) { setError("No valid rows found. Check the file has 'Student ID' and 'Device SN' columns."); return }
          setPreview(p); setPhase("preview")
        } catch (err) { setError(err.message || "Could not read the file.") }
      },
      error: (err) => setError(err.message || "Could not parse the file."),
    })
  }

  const runImport = async () => {
    if (!preview) return
    setPhase("importing"); setError("")
    try {
      // 1) Students
      for (const c of chunk(preview.students, 500)) {
        const { error } = await supabase.from("students").upsert(c, { onConflict: "student_id" })
        if (error) throw error
      }
      // 2) Devices — upsert and collect ids by serial
      const serialToId = {}
      for (const c of chunk(preview.devices, 500)) {
        const { data, error } = await supabase.from("devices").upsert(c, { onConflict: "serial_number" }).select("id,serial_number")
        if (error) throw error
        for (const d of data) serialToId[d.serial_number] = d.id
      }
      // 3) Existing active loans → don't double-issue
      const { data: act, error: actErr } = await supabase.from("loans").select("student_id,device_id").eq("status", "active")
      if (actErr) throw actErr
      const activeStu = new Set(act.map(a => a.student_id))
      const activeDev = new Set(act.map(a => a.device_id))

      // 4) Build active loans starting a fresh 10-day clock at go-live
      const issued_at = new Date().toISOString()
      const due_at = addDays(new Date(), LOAN_DAYS).toISOString()
      const toInsert = []
      const deviceIds = []
      let skippedExisting = 0
      for (const p of preview.loanPairs) {
        const did = serialToId[p.serial]
        if (!did) continue
        if (activeStu.has(p.student_id) || activeDev.has(did)) { skippedExisting++; continue }
        toInsert.push({
          student_id: p.student_id, device_id: did,
          issued_at, due_at, original_issue_date: p.original_issue_date, status: "active",
        })
        deviceIds.push(did)
        activeStu.add(p.student_id); activeDev.add(did)
      }
      // 5) Insert loans
      for (const c of chunk(toInsert, 500)) {
        const { error } = await supabase.from("loans").insert(c)
        if (error) throw error
      }
      // 6) Mark those devices on_loan
      for (const c of chunk(deviceIds, 300)) {
        const { error } = await supabase.from("devices").update({ status: "on_loan" }).in("id", c)
        if (error) throw error
      }

      setResults({
        students: preview.students.length,
        devices: preview.devices.length,
        loans: toInsert.length,
        skippedExisting,
        skipped: preview.skipped,
      })
      await refresh()
      setPhase("done")
    } catch (e) {
      setError(e.message || "Import failed.")
      setPhase("preview")
    }
  }

  const reset = () => { setPreview(null); setFileName(""); setResults(null); setPhase("idle"); setError("") }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div>
        <p className="text-[10px] uppercase tracking-[0.3em] text-navy-accent mb-1.5">Setup</p>
        <h1 className="font-serif text-3xl sm:text-4xl text-navy leading-tight">Import CSV</h1>
        <p className="text-sm text-muted mt-1">Load students, devices and current holdings from your <span className="font-medium">LWT_SL</span> export.</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted shrink-0">Student holdings</span>
        <span className="h-px bg-line flex-1" />
      </div>

      {/* File picker */}
      <label className="block">
        <div className="border-2 border-dashed border-line rounded-2xl p-8 text-center hover:border-navy/30 cursor-pointer transition-colors bg-white">
          <Upload size={28} className="mx-auto text-navy mb-2" />
          <div className="text-sm font-medium text-ink">{fileName || "Choose a CSV file"}</div>
          <div className="text-xs text-muted mt-1">Expects columns: Student ID, Student Name, Student Yr., Host Name, Device SN, Model, Collection Date</div>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </div>
      </label>

      {error && (
        <div className="flex items-start gap-2 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {/* Preview */}
      {phase === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <PreviewStat icon={Users} label="Students" value={preview.students.length} />
            <PreviewStat icon={HardDrive} label="Devices" value={preview.devices.length} />
            <PreviewStat icon={ClipboardList} label="Active loans" value={preview.loanPairs.length} />
          </div>
          <Card className="p-4 text-xs text-muted space-y-1">
            <div className="flex items-center gap-2"><FileText size={14} /> {preview.total} rows read from <span className="font-medium text-ink">{fileName}</span></div>
            {preview.skipped > 0 && <div className="text-warn">{preview.skipped} row(s) skipped (missing Student ID or serial).</div>}
            <div>Seeded loans start a fresh {LOAN_DAYS}-day window from today. Students/devices already loaded are updated, not duplicated.</div>
          </Card>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} className="flex-1">Choose another</Button>
            <Button variant="primary" onClick={runImport} className="flex-1"><Upload size={16} /> Import now</Button>
          </div>
        </div>
      )}

      {phase === "importing" && (
        <Card className="p-8 text-center">
          <Loader2 size={28} className="mx-auto animate-spin text-navy mb-2" />
          <div className="text-sm text-muted">Importing… this can take a moment for large files.</div>
        </Card>
      )}

      {/* Results */}
      {phase === "done" && results && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-ok mb-3"><CheckCircle2 size={20} /> <span className="font-serif text-lg">Import complete</span></div>
            <ul className="text-sm text-ink space-y-1.5">
              <li className="flex justify-between"><span className="text-muted">Students loaded/updated</span><span className="font-semibold tabular-nums">{results.students}</span></li>
              <li className="flex justify-between"><span className="text-muted">Devices loaded/updated</span><span className="font-semibold tabular-nums">{results.devices}</span></li>
              <li className="flex justify-between"><span className="text-muted">Active loans created</span><span className="font-semibold tabular-nums">{results.loans}</span></li>
              {results.skippedExisting > 0 && <li className="flex justify-between"><span className="text-muted">Already on loan (kept)</span><span className="font-semibold tabular-nums">{results.skippedExisting}</span></li>}
              {results.skipped > 0 && <li className="flex justify-between"><span className="text-muted">Rows skipped</span><span className="font-semibold tabular-nums text-warn">{results.skipped}</span></li>}
            </ul>
          </Card>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} className="flex-1">Import another</Button>
            <Button variant="primary" onClick={() => setTab("loanPortal")} className="flex-1">Go to Loan Portal <ArrowRight size={16} /></Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted shrink-0">Loan laptop cabins</span>
        <span className="h-px bg-line flex-1" />
      </div>

      <CabinImport refresh={refresh} />
    </div>
  )
}

// ============================================================
// CABIN CSV — assigns loan laptops to one of the three cabins.
// Expects columns: LNB, Cabin. Known LNBs are updated in place;
// unknown ones are created as available loan stock, so the same
// file can both seed new laptops and re-shelve existing ones.
// ============================================================
function CabinImport({ refresh }) {
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState(null)
  const [phase, setPhase] = useState("idle") // idle | reading | preview | importing | done
  const [results, setResults] = useState(null)
  const [error, setError] = useState("")

  const reset = () => { setPreview(null); setFileName(""); setResults(null); setPhase("idle"); setError("") }

  const onFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name); setError(""); setResults(null); setPreview(null); setPhase("reading")
    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: async (res) => {
        try {
          // De-duplicate on LNB, keeping the last cabin seen for it.
          const byLnb = new Map()
          let badCabin = 0, skipped = 0
          for (const r of res.data) {
            const lnb = String(r["LNB"] ?? "").trim().toUpperCase()
            if (!lnb) { skipped++; continue }
            const cabin = normalizeCabin(r["Cabin"])
            if (!cabin) { badCabin++; continue }
            byLnb.set(lnb, cabin)
          }
          if (byLnb.size === 0) {
            setError("No usable rows. Check the file has 'LNB' and 'Cabin' columns, and that Cabin reads like \"Yr 3-5\".")
            setPhase("idle"); return
          }

          // Split into updates vs creates so the preview is honest about
          // which laptops this file will bring into existence.
          const { data: existing, error: exErr } = await supabase
            .from("devices").select("lnb").not("lnb", "is", null)
          if (exErr) throw exErr
          const actualByUpper = new Map((existing || []).map(d => [d.lnb.toUpperCase(), d.lnb]))

          const update = [], create = []
          for (const [lnb, cabin] of byLnb) {
            const actual = actualByUpper.get(lnb)
            if (actual) update.push({ lnb: actual, cabin })
            else create.push({ lnb, cabin, status: "available" })
          }
          setPreview({ update, create, badCabin, skipped, total: res.data.length })
          setPhase("preview")
        } catch (err) {
          setError(err.message || "Could not read the file."); setPhase("idle")
        }
      },
      error: (err) => { setError(err.message || "Could not parse the file."); setPhase("idle") },
    })
  }

  const runImport = async () => {
    if (!preview) return
    setPhase("importing"); setError("")
    try {
      // One update per cabin rather than one per laptop.
      const byCabin = new Map()
      for (const u of preview.update) {
        if (!byCabin.has(u.cabin)) byCabin.set(u.cabin, [])
        byCabin.get(u.cabin).push(u.lnb)
      }
      for (const [cabin, lnbs] of byCabin) {
        for (const c of chunk(lnbs, 300)) {
          const { error } = await supabase.from("devices").update({ cabin }).in("lnb", c)
          if (error) throw error
        }
      }
      for (const c of chunk(preview.create, 500)) {
        const { error } = await supabase.from("devices").insert(c)
        if (error) throw error
      }
      setResults({ updated: preview.update.length, created: preview.create.length })
      await refresh()
      setPhase("done")
    } catch (e) {
      setError(e.message || "Cabin import failed.")
      setPhase("preview")
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <div className="border-2 border-dashed border-line rounded-2xl p-8 text-center hover:border-navy/30 cursor-pointer transition-colors bg-white">
          <Boxes size={28} className="mx-auto text-navy mb-2" />
          <div className="text-sm font-medium text-ink">{fileName || "Choose a cabin CSV"}</div>
          <div className="text-xs text-muted mt-1">Expects columns: LNB, Cabin (e.g. “LNB-0166”, “Yr 3-5”)</div>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </div>
      </label>

      {error && (
        <div className="flex items-start gap-2 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {phase === "reading" && (
        <Card className="p-6 text-center text-sm text-muted">
          <Loader2 size={20} className="mx-auto animate-spin text-navy mb-2" /> Reading file…
        </Card>
      )}

      {phase === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <PreviewStat icon={RefreshCw} label="Re-shelved" value={preview.update.length} />
            <PreviewStat icon={PlusCircle} label="New laptops" value={preview.create.length} />
          </div>
          <Card className="p-4 text-xs text-muted space-y-1">
            <div className="flex items-center gap-2"><FileText size={14} /> {preview.total} rows read from <span className="font-medium text-ink">{fileName}</span></div>
            {preview.badCabin > 0 && <div className="text-warn">{preview.badCabin} row(s) skipped — Cabin not recognised as 3-5, 6-7 or 8-9.</div>}
            {preview.skipped > 0 && <div className="text-warn">{preview.skipped} row(s) skipped — no LNB.</div>}
            {preview.create.length > 0 && <div>New LNBs will be created as available loan stock with no model or serial yet.</div>}
          </Card>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} className="flex-1">Choose another</Button>
            <Button variant="primary" onClick={runImport} className="flex-1"><Upload size={16} /> Apply cabins</Button>
          </div>
        </div>
      )}

      {phase === "importing" && (
        <Card className="p-6 text-center text-sm text-muted">
          <Loader2 size={20} className="mx-auto animate-spin text-navy mb-2" /> Applying cabins…
        </Card>
      )}

      {phase === "done" && results && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-ok mb-3"><CheckCircle2 size={20} /> <span className="font-serif text-lg">Cabins updated</span></div>
            <ul className="text-sm text-ink space-y-1.5">
              <li className="flex justify-between"><span className="text-muted">Laptops re-shelved</span><span className="font-semibold tabular-nums">{results.updated}</span></li>
              <li className="flex justify-between"><span className="text-muted">New laptops created</span><span className="font-semibold tabular-nums">{results.created}</span></li>
            </ul>
          </Card>
          <Button variant="secondary" onClick={reset} className="w-full">Import another cabin file</Button>
        </div>
      )}
    </div>
  )
}

function PreviewStat({ icon: Icon, label, value }) {
  return (
    <Card className="p-4 text-center">
      <Icon size={18} className="mx-auto text-navy mb-1.5" />
      <div className="font-serif text-2xl text-navy tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted mt-0.5">{label}</div>
    </Card>
  )
}
