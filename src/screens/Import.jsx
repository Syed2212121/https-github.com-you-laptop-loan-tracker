import React, { useState } from "react"
import Papa from "papaparse"
import { Upload, FileText, Users, HardDrive, ClipboardList, CheckCircle2, AlertTriangle, Loader2, ArrowRight, Boxes, RefreshCw, PlusCircle, GraduationCap, ShieldCheck, MonitorSmartphone } from "lucide-react"
import { supabase, fetchAll } from "../supabase"
import { Card, Button } from "../ui"
import { normalizeCabin, buildRosterImport, buildDeviceImport, buildIntuneImport, buildNetsupportImport, knownSerialSet } from "../lib"

const chunk = (arr, n) => {
  const out = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

export default function Import({ data, refresh, setTab }) {
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState(null)
  const [phase, setPhase] = useState("idle") // idle | preview | importing | done
  const [results, setResults] = useState(null)
  const [error, setError] = useState("")

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
          // The roster has to be loaded first — it decides which rows are
          // current students and which belong to somebody who has left.
          const { data: rosterRows, error: rosterErr } = await fetchAll(
            q => q.select("student_id"), "students"
          )
          if (rosterErr) throw rosterErr
          const roster = new Set(rosterRows.map(s => s.student_id))
          if (roster.size === 0) {
            setError("No students in the database yet. Import the student roster first — the device file only says which laptop each student holds, not who they are.")
            setPhase("idle"); return
          }
          const p = buildDeviceImport(res.data, roster)
          if (!p.devices.length) {
            setError(p.notCurrent > 0
              ? `None of the ${p.notCurrent} rows match a student in the roster. Is this the right file, and is the roster up to date?`
              : "No valid rows found. Check the file has 'Student ID' and 'Device SN' columns.")
            setPhase("idle"); return
          }
          setPreview(p); setPhase("preview")
        } catch (err) { setError(err.message || "Could not read the file."); setPhase("idle") }
      },
      error: (err) => { setError(err.message || "Could not parse the file."); setPhase("idle") },
    })
  }

  const runImport = async () => {
    if (!preview) return
    setPhase("importing"); setError("")
    try {
      // Devices only — students come from the roster import. No loans are
      // created: an SL laptop is the student's own machine and is never loaned.
      for (const c of chunk(preview.devices, 500)) {
        const { error } = await supabase.from("devices").upsert(c, { onConflict: "serial_number" })
        if (error) throw error
      }

      setResults({
        devices: preview.devices.length,
        assignments: preview.devices.filter(d => d.assigned_student_id).length,
        skipped: preview.skipped,
        notCurrent: preview.notCurrent,
        repaired: preview.repaired,
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
        <p className="text-sm text-muted mt-1">Load students and their laptops from your <span className="font-medium">SIMS</span> exports. Import the roster first — it says who each student is, and the device file only makes sense once they exist. Steps 4 and 5 stand on their own and can be run at any time, in any order.</p>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted shrink-0">1 · Student roster</span>
        <span className="h-px bg-line flex-1" />
      </div>

      <RosterImport refresh={refresh} />

      <div className="flex items-center gap-3 pt-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted shrink-0">2 · Student holdings</span>
        <span className="h-px bg-line flex-1" />
      </div>

      {/* File picker */}
      <label className="block">
        <div className="border-2 border-dashed border-line rounded-2xl p-8 text-center hover:border-navy/30 cursor-pointer transition-colors bg-white">
          <Upload size={28} className="mx-auto text-navy mb-2" />
          <div className="text-sm font-medium text-ink">{fileName || "Choose the device CSV"}</div>
          <div className="text-xs text-muted mt-1">Expects columns: Student ID, Device SN, Host Name, Model, Notes, Year</div>
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
          <Loader2 size={20} className="mx-auto animate-spin text-navy mb-2" /> Reading file and matching against the roster…
        </Card>
      )}

      {/* Preview */}
      {phase === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <PreviewStat icon={HardDrive} label="Laptops" value={preview.devices.length} />
            <PreviewStat icon={ClipboardList} label="Students matched" value={preview.devices.filter(d => d.assigned_student_id).length} />
          </div>
          <Card className="p-4 text-xs text-muted space-y-1">
            <div className="flex items-center gap-2"><FileText size={14} /> {preview.total} rows read from <span className="font-medium text-ink">{fileName}</span></div>
            {preview.notCurrent > 0 && <div>{preview.notCurrent} row(s) belong to students who are no longer on the roster — these are past laptops and will not be imported.</div>}
            {preview.repaired > 0 && <div>{preview.repaired} serial(s) tidied automatically (full barcode or stray hyphen).</div>}
            {preview.skipped > 0 && <div className="text-warn">{preview.skipped} row(s) skipped — no Student ID or serial, or a serial that needs a person to read it.</div>}
            <div>Where a student appears more than once, the laptop from the most recent <span className="font-medium text-ink">Year</span> is taken as the one they hold now.</div>
            <div>Each laptop is recorded as <span className="font-medium text-ink">assigned</span> to its student — not as a loan. SL laptops are never loaned, so this leaves every student free to borrow an LNB laptop. Devices already loaded are updated, not duplicated.</div>
          </Card>

          {preview.clashes.length > 0 && (
            <Card className="p-4 border-alert/30 bg-alert/5">
              <div className="flex items-center gap-2 text-alert text-sm font-medium mb-2">
                <AlertTriangle size={16} /> {preview.clashes.length} serial(s) claimed by two students
              </div>
              <p className="text-xs text-muted mb-2">A serial can only belong to one laptop, so importing now would give the device to whichever student is written last and quietly leave the other with nothing. Fix these in the source file first.</p>
              <ul className="text-xs text-ink space-y-1 max-h-40 overflow-y-auto">
                {preview.clashes.map(c => (
                  <li key={c.serial} className="flex justify-between gap-3">
                    <span className="font-mono">{c.serial}</span>
                    <span className="text-muted">students {c.students.join(" & ")}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {preview.suspect.length > 0 && (
            <Card className="p-4 border-warn/30 bg-warn/5">
              <div className="flex items-center gap-2 text-warn text-sm font-medium mb-2">
                <AlertTriangle size={16} /> {preview.suspect.length} serial(s) could not be read
              </div>
              <p className="text-xs text-muted mb-2">Two serials in one cell, or a value Excel turned into a date. These rows are skipped rather than guessed at.</p>
              <ul className="text-xs text-ink space-y-1 max-h-40 overflow-y-auto">
                {preview.suspect.map((s, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="font-mono">{s.serial}</span>
                    <span className="text-muted">student {s.sid}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

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
              <li className="flex justify-between"><span className="text-muted">Devices loaded/updated</span><span className="font-semibold tabular-nums">{results.devices}</span></li>
              <li className="flex justify-between"><span className="text-muted">Laptops assigned to students</span><span className="font-semibold tabular-nums">{results.assignments}</span></li>
              {results.notCurrent > 0 && <li className="flex justify-between"><span className="text-muted">Past laptops (student has left)</span><span className="font-semibold tabular-nums">{results.notCurrent}</span></li>}
              {results.repaired > 0 && <li className="flex justify-between"><span className="text-muted">Serials tidied</span><span className="font-semibold tabular-nums">{results.repaired}</span></li>}
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
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted shrink-0">3 · Loan laptop cabins</span>
        <span className="h-px bg-line flex-1" />
      </div>

      <CabinImport refresh={refresh} />

      <div className="flex items-center gap-3 pt-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted shrink-0">4 · Intune export</span>
        <span className="h-px bg-line flex-1" />
      </div>

      <ExportImport kind="intune" data={data} refresh={refresh} />

      <div className="flex items-center gap-3 pt-3">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted shrink-0">5 · NetSupport DNA export</span>
        <span className="h-px bg-line flex-1" />
      </div>

      <ExportImport kind="netsupport" data={data} refresh={refresh} />
    </div>
  )
}

// ============================================================
// STUDENT ROSTER CSV — the authority on who a student is.
// Expects columns: StudentID, StudentYearLevel, StudentForm,
// StudentGiven1, StudentSurname (the SIMS "Current Student List").
//
// Note the header spellings have no spaces — they are SIMS's own, and are
// matched exactly, so the export needs no editing beyond Save As → CSV.
// ============================================================
function RosterImport({ refresh }) {
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState(null)
  const [phase, setPhase] = useState("idle") // idle | preview | importing | done
  const [results, setResults] = useState(null)
  const [error, setError] = useState("")

  const reset = () => { setPreview(null); setFileName(""); setResults(null); setPhase("idle"); setError("") }

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
          const p = buildRosterImport(res.data)
          if (!p.students.length) {
            setError("No valid rows found. Check the file has a 'StudentID' column (no space).")
            return
          }
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
      for (const c of chunk(preview.students, 500)) {
        const { error } = await supabase.from("students").upsert(c, { onConflict: "student_id" })
        if (error) throw error
      }
      setResults({ students: preview.students.length, skipped: preview.skipped })
      await refresh()
      setPhase("done")
    } catch (e) {
      setError(e.message || "Roster import failed.")
      setPhase("preview")
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <div className="border-2 border-dashed border-line rounded-2xl p-8 text-center hover:border-navy/30 cursor-pointer transition-colors bg-white">
          <GraduationCap size={28} className="mx-auto text-navy mb-2" />
          <div className="text-sm font-medium text-ink">{fileName || "Choose the student roster CSV"}</div>
          <div className="text-xs text-muted mt-1">Expects columns: StudentID, StudentYearLevel, StudentForm, StudentGiven1, StudentSurname</div>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </div>
      </label>

      {error && (
        <div className="flex items-start gap-2 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {phase === "preview" && preview && (
        <div className="space-y-4">
          <PreviewStat icon={Users} label="Students" value={preview.students.length} />
          <Card className="p-4 text-xs text-muted space-y-1">
            <div className="flex items-center gap-2"><FileText size={14} /> {preview.total} rows read from <span className="font-medium text-ink">{fileName}</span></div>
            {preview.skipped > 0 && <div className="text-warn">{preview.skipped} row(s) skipped — no StudentID.</div>}
            {preview.noName > 0 && <div className="text-warn">{preview.noName} student(s) have no name.</div>}
            {preview.noYear > 0 && <div className="text-warn">{preview.noYear} student(s) have no year level.</div>}
            <div>Students already loaded are updated, not duplicated. Nobody is deleted — a student who has left keeps their record and simply holds no laptop.</div>
          </Card>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} className="flex-1">Choose another</Button>
            <Button variant="primary" onClick={runImport} className="flex-1"><Upload size={16} /> Import roster</Button>
          </div>
        </div>
      )}

      {phase === "importing" && (
        <Card className="p-6 text-center text-sm text-muted">
          <Loader2 size={20} className="mx-auto animate-spin text-navy mb-2" /> Importing roster…
        </Card>
      )}

      {phase === "done" && results && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-ok mb-3"><CheckCircle2 size={20} /> <span className="font-serif text-lg">Roster loaded</span></div>
            <ul className="text-sm text-ink space-y-1.5">
              <li className="flex justify-between"><span className="text-muted">Students loaded/updated</span><span className="font-semibold tabular-nums">{results.students}</span></li>
              {results.skipped > 0 && <li className="flex justify-between"><span className="text-muted">Rows skipped</span><span className="font-semibold tabular-nums text-warn">{results.skipped}</span></li>}
            </ul>
          </Card>
          <Button variant="secondary" onClick={reset} className="w-full">Import another roster</Button>
        </div>
      )}
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

// ============================================================
// EXTERNAL FLEET EXPORTS — Intune and NetSupport DNA.
//
// Both cover the whole fleet, staff machines included, so unlike the device
// import there is no roster to check against and no order to respect: either
// file can be loaded on its own at any time. Rows matching no laptop in SIMS
// are still stored — most of them are staff machines, and dropping them would
// mean re-importing the day one of those machines reaches a student.
//
// The two differ only in their headers and their labels, so they share one
// component rather than two near-identical hundred-line copies.
// ============================================================
const EXPORT_KINDS = {
  intune: {
    icon: ShieldCheck,
    table: "device_intune",
    build: buildIntuneImport,
    prompt: "Choose the Intune device export",
    columns: "Expects columns: Device name, Serial number, Manufacturer, Model, Management name, Primary user UPN, Primary user email address, Primary user display name, Compliance, Ownership, SkuFamily, JoinType",
    missing: "No usable rows. Check the file has a 'Serial number' column — that is the only thing that can be matched to a laptop.",
    stat: "Intune devices",
    done: "Intune export loaded",
    failed: "Intune import failed.",
    again: "Import another Intune export",
    action: "Import Intune export",
  },
  netsupport: {
    icon: MonitorSmartphone,
    table: "device_netsupport",
    build: buildNetsupportImport,
    prompt: "Choose the NetSupport DNA export",
    columns: "Expects columns: Device_Name, PC_NODE_ID, Device_Owner, Class, UserName, LogonName, SerialNumber",
    missing: "No usable rows. Check the file has a 'SerialNumber' column — that is the only thing that can be matched to a laptop.",
    stat: "DNA devices",
    done: "NetSupport DNA export loaded",
    failed: "NetSupport DNA import failed.",
    again: "Import another DNA export",
    action: "Import DNA export",
  },
}

function ExportImport({ kind, data, refresh }) {
  const cfg = EXPORT_KINDS[kind]
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState(null)
  const [phase, setPhase] = useState("idle") // idle | preview | importing | done
  const [results, setResults] = useState(null)
  const [error, setError] = useState("")

  const reset = () => { setPreview(null); setFileName(""); setResults(null); setPhase("idle"); setError("") }

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
          const p = cfg.build(res.data, knownSerialSet(data.devices))
          if (!p.records.length) { setError(cfg.missing); return }
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
      for (const c of chunk(preview.records, 500)) {
        const { error } = await supabase.from(cfg.table).upsert(c, { onConflict: "serial_key" })
        if (error) throw error
      }
      setResults(preview)
      // Nothing in `data` caches these tables — the panels fetch their own row
      // on demand — but refreshing keeps this uploader behaving like the others.
      await refresh()
      setPhase("done")
    } catch (e) {
      setError(e.message || cfg.failed)
      setPhase("preview")
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <div className="border-2 border-dashed border-line rounded-2xl p-8 text-center hover:border-navy/30 cursor-pointer transition-colors bg-white">
          <cfg.icon size={28} className="mx-auto text-navy mb-2" />
          <div className="text-sm font-medium text-ink">{fileName || cfg.prompt}</div>
          <div className="text-xs text-muted mt-1">{cfg.columns}</div>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </div>
      </label>

      {error && (
        <div className="flex items-start gap-2 text-sm text-alert bg-alert/5 border border-alert/20 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {phase === "preview" && preview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <PreviewStat icon={cfg.icon} label={cfg.stat} value={preview.records.length} />
            <PreviewStat icon={HardDrive} label="Match a SIMS laptop" value={preview.matched} />
          </div>
          <Card className="p-4 text-xs text-muted space-y-1">
            <div className="flex items-center gap-2"><FileText size={14} /> {preview.total} rows read from <span className="font-medium text-ink">{fileName}</span></div>
            {preview.noSerial > 0 && <div className="text-warn">{preview.noSerial} row(s) skipped — no serial number, so there is no way to say which laptop they are about.</div>}
            {preview.duplicates > 0 && <div className="text-warn">{preview.duplicates} duplicate serial(s) — the last row for each wins.</div>}
            <div>{preview.unmatched} row(s) match no laptop in SIMS. That is expected — the export covers staff machines too, and they are stored either way.</div>
            <div>Devices already loaded are updated, not duplicated.</div>
          </Card>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={reset} className="flex-1">Choose another</Button>
            <Button variant="primary" onClick={runImport} className="flex-1"><Upload size={16} /> {cfg.action}</Button>
          </div>
        </div>
      )}

      {phase === "importing" && (
        <Card className="p-6 text-center text-sm text-muted">
          <Loader2 size={20} className="mx-auto animate-spin text-navy mb-2" /> Importing…
        </Card>
      )}

      {phase === "done" && results && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 text-ok mb-3"><CheckCircle2 size={20} /> <span className="font-serif text-lg">{cfg.done}</span></div>
            <ul className="text-sm text-ink space-y-1.5">
              <li className="flex justify-between"><span className="text-muted">Rows loaded/updated</span><span className="font-semibold tabular-nums">{results.records.length}</span></li>
              <li className="flex justify-between"><span className="text-muted">Matching a SIMS laptop</span><span className="font-semibold tabular-nums">{results.matched}</span></li>
              {results.noSerial > 0 && <li className="flex justify-between"><span className="text-muted">Rows skipped</span><span className="font-semibold tabular-nums text-warn">{results.noSerial}</span></li>}
            </ul>
          </Card>
          <Button variant="secondary" onClick={reset} className="w-full">{cfg.again}</Button>
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
