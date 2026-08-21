// ============================================================
// Shared helpers — dates, loan rules, parsing
// ============================================================

export const LOAN_DAYS = 10          // provision period
export const DUE_SOON_DAYS = 2       // "due soon" window before due date

const MS_DAY = 1000 * 60 * 60 * 24

// ------------------------------------------------------------
// CABINS — the three physical cupboards loan laptops live in,
// each staffed by two IT members who can hand a laptop over.
// ------------------------------------------------------------
export const CABINS = [
  { key: "yr3_5", label: "Cabin Year 3–5", staff: ["Rudi", "Leo"] },
  { key: "yr6_7", label: "Cabin Year 6–7", staff: ["Adil", "Lee"] },
  { key: "yr8_9", label: "Cabin Year 8–9", staff: ["Syed", "Nadeem"] },
]

export const ALL_CABIN_STAFF = CABINS.flatMap(c => c.staff)

export const cabinByKey = (key) => CABINS.find(c => c.key === key) || null

// Map a loose CSV cabin value onto a cabin key. Tolerant of wording and
// dash style: "3-5", "Yr 3-5", "Cabin Year 3–5", "35" all → "yr3_5".
// Returns null for blanks and anything unrecognised.
export function normalizeCabin(raw) {
  const s = String(raw ?? "").trim()
  if (!s) return null
  if (CABINS.some(c => c.key === s)) return s      // already a key
  const digits = s.replace(/\D/g, "")
  if (digits.length !== 2) return null
  const found = CABINS.find(c => c.key.replace(/\D/g, "") === digits)
  return found ? found.key : null
}

// The loan-vs-student boundary. The devices table holds both CSV-imported
// student laptops and LNB loan laptops; only the latter carry an LNB.
export const isLoanDevice = (d) => !!d.lnb && !d.archived

export const now = () => new Date()

export function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export const todayISO = () => new Date().toISOString().slice(0, 10)

export function fmtDate(d) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
}

export function fmtDateTime(d) {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })
}

// Whole days between now and a due date (positive = days remaining, negative = overdue)
export function daysUntil(due) {
  return Math.ceil((new Date(due).getTime() - Date.now()) / MS_DAY)
}

// Classify an ACTIVE loan for display. Returns { state, days }
//   state: "returned" | "overdue" | "due_soon" | "active"
export function loanState(loan) {
  if (loan.returned_at || loan.status === "returned") return { state: "returned", days: 0 }
  const d = daysUntil(loan.due_at)
  if (d < 0) return { state: "overdue", days: Math.abs(d) }
  if (d <= DUE_SOON_DAYS) return { state: "due_soon", days: d }
  return { state: "active", days: d }
}

// The one active loan for a student (or null)
export function activeLoanForStudent(loans, studentId) {
  return loans.find(l => l.student_id === studentId && l.status === "active") || null
}

// Parse a "Last, First" name into parts. Handles blanks and single-token names.
//
// Unused since the roster import landed — the SIMS "Current Student List" gives
// given name and surname as separate columns, so there is nothing to parse. Kept
// for the next import that arrives with names in one field.
export function parseName(raw) {
  const s = (raw || "").trim()
  if (!s) return { first_name: "", last_name: "", full_name: "" }
  if (s.includes(",")) {
    const [last, first] = s.split(",").map(p => p.trim())
    return {
      first_name: first || "",
      last_name: last || "",
      full_name: `${first || ""} ${last || ""}`.trim(),
    }
  }
  const parts = s.split(/\s+/)
  const first = parts.shift() || ""
  const last = parts.join(" ")
  return { first_name: first, last_name: last, full_name: s }
}

// Parse a slash date to an ISO date string, tolerant of d/m/y vs m/d/y order.
// Returns null for blanks or anything that isn't a valid date (never throws).
export function parseAuDate(raw) {
  const s = (raw || "").trim()
  if (!s) return null
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  let [, aStr, bStr, y] = m
  const a = parseInt(aStr, 10)
  const b = parseInt(bStr, 10)
  if (y.length === 2) y = "20" + y

  let day, mon
  if (a > 12 && b <= 12) { day = a; mon = b }        // first number can only be a day → D/M/Y
  else if (b > 12 && a <= 12) { mon = a; day = b }   // second can only be a day → M/D/Y (US)
  else { day = a; mon = b }                          // ambiguous → default to AU D/M/Y

  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null
  const dd = String(day).padStart(2, "0")
  const mm = String(mon).padStart(2, "0")
  return `${y}-${mm}-${dd}`
}

export function displayName(student) {
  if (!student) return "—"
  return student.full_name || `${student.first_name || ""} ${student.last_name || ""}`.trim() || "(no name)"
}

// Split a "Student Yr." value like "4I" into { class: "4", form: "I" }.
// Leading digits are the class/year; trailing letters are the form group.
// Tolerant of blanks and odd values (falls back to the raw string as class).
export function splitClassForm(raw) {
  const s = String(raw ?? "").trim()
  if (!s) return { class: "", form: "" }
  const m = s.match(/^(\d+)\s*([A-Za-z].*)?$/)
  if (!m) return { class: s, form: "" }
  return { class: m[1], form: (m[2] || "").trim() }
}

// Recombine class + form back into the SIMS "Student Yr." style, e.g. "4I".
// Inverse of splitClassForm. Prep (class "0") with no form reads "0".
//
// Unused since classLabel landed. It used to render the Student Devices class
// field, where it produced "1212D" — post-restructure rows hold "12" in class
// and the WHOLE form "12D" in form, so joining the two doubles the year. Kept
// as the honest inverse of splitClassForm for a caller that has genuinely
// separate parts; do not reach for it to display a student's class.
export function classFormLabel(cls, form) {
  return `${String(cls ?? "").trim()}${String(form ?? "").trim()}`
}

// The one class label staff actually say, e.g. "12D".
//
// Roster imports since the restructure store the year level in `class` ("12")
// and the FULL form in `form` ("12D", not "D") — so joining the two with
// classFormLabel gives "1212D". Older rows kept the combined value in `class`
// and left `form` null. Either shape reduces to the same answer here.
export function classLabel(student) {
  if (!student) return ""
  return String(student.form || student.class || "").trim()
}

// The numeric year level, whichever import shape the row came from. Used for
// the Year-4 1:1 threshold, where "12D" must not parse as NaN.
export function yearLevelNum(student) {
  if (!student) return NaN
  const cls = student.form ? student.class : splitClassForm(student.class).class
  return Number(String(cls ?? "").trim())
}

// Display form of a student ID, e.g. "21816" → "SL-21816".
export function slId(studentId) {
  return studentId ? `SL-${studentId}` : "—"
}

// Year level 0 is Prep, not "Year 0". Everything else reads as its number.
export function yearLevelLabel(raw) {
  const s = String(raw ?? "").trim()
  if (!s) return ""
  return s === "0" ? "Prep" : `Year ${s}`
}

// The SIMS "Year" column is the year a device was issued and decides which row
// is a student's current laptop. Not all values are numeric: 823 rows read
// "2020-21", which sits between 2020 and 2023, so it sorts as 2021.
export function sourceYearNum(raw) {
  const s = String(raw ?? "").trim()
  if (s === "2020-21") return 2021
  return parseInt(s, 10) || 0
}

// Repair the serial shapes the SIMS export is known to mangle. Only
// unambiguous fixes are applied — anything needing a human (two serials merged
// into one cell, or a value Excel turned into a date) is returned untouched and
// flagged, so the importer can report it rather than silently invent a serial.
export function cleanSerial(raw) {
  const s = String(raw ?? "").trim()
  if (!s) return { value: "", changed: false, suspect: false }

  // Full Lenovo barcode — "1s" + machine type + model + the 8-char serial.
  if (/^1s[0-9A-Za-z]{18}$/.test(s)) return { value: s.slice(-8), changed: true, suspect: false }
  // Stray hyphen: "R9-111BGV" → "R9111BGV".
  if (/^R9-[0-9A-Za-z]{6}$/.test(s)) return { value: s.replace("-", ""), changed: true, suspect: false }
  // A stray "atitude" (from "Latitude") pasted in front of the serial.
  if (/^atitude\s+/i.test(s)) return { value: s.replace(/^atitude\s+/i, ""), changed: true, suspect: false }

  // Two serials in one cell, or an Excel date corruption like "05-May-04".
  const suspect = /[()>]|\s-\s|\s{2,}/.test(s) || !/^[A-Za-z0-9]{6,9}$/.test(s)
  return { value: s, changed: false, suspect }
}

// The join key between our devices and the Intune / NetSupport exports.
//
// devices.serial_number went through cleanSerial() at import, so a full Lenovo
// "1s…" barcode was stored as its last 8 characters. Both consoles export the
// raw barcode, so raw-to-raw would never match. Send both sides through the
// same funnel, then upper-case, because the two consoles disagree about case
// and Postgres does not. Idempotent — safe to run on an already-clean serial,
// which is what lets it be applied on read as well as on import.
//
// A suspect serial still gets a key: it simply matches nothing, which is the
// truth. Only a blank returns "".
export function serialKey(raw) {
  return cleanSerial(raw).value.toUpperCase()
}

// ------------------------------------------------------------
// CSV IMPORT — pure row-shaping, kept out of the screen so it can be
// exercised against the real SIMS exports without a browser.
// ------------------------------------------------------------

// Roster rows → student records. SIMS gives year level and form as separate
// columns, so unlike the old combined "Student Yr." there is nothing to split.
// The form is kept as SIMS writes it ("4I", not "I") — that is what staff and
// students actually say, and it round-trips back to SIMS unchanged.
export function buildRosterImport(rows) {
  const byId = new Map()
  let skipped = 0
  for (const r of rows) {
    const id = String(r["StudentID"] ?? "").trim()
    if (!id) { skipped++; continue }
    const given = String(r["StudentGiven1"] ?? "").trim()
    const surname = String(r["StudentSurname"] ?? "").trim()
    byId.set(id, {
      student_id: id,
      first_name: given || null,
      last_name: surname || null,
      full_name: `${given} ${surname}`.trim() || null,
      class: String(r["StudentYearLevel"] ?? "").trim() || null,
      form: String(r["StudentForm"] ?? "").trim() || null,
    })
  }
  const students = [...byId.values()]
  return {
    students,
    skipped,
    total: rows.length,
    noName: students.filter(s => !s.full_name).length,
    noYear: students.filter(s => !s.class).length,
  }
}

// SIMS device rows → device records carrying their assignment.
//
// This deliberately does NOT produce student records. The device export has no
// year level and an inconsistently formatted name, so importing it as a student
// used to null out the class/form the roster had just supplied. `roster` is the
// set of student_ids already in the database; a row whose student is not in it
// is reported, not invented — which is what drops the export's ~1,600 rows
// belonging to students who have left.
export function buildDeviceImport(rows, roster) {
  const byStudent = new Map()   // student_id → winning row
  let skipped = 0, notCurrent = 0, repaired = 0
  const suspect = []

  for (const r of rows) {
    const sid = String(r["Student ID"] ?? "").trim()
    const rawSerial = String(r["Device SN"] ?? "").trim()
    if (!sid && !rawSerial) continue        // blank line
    if (!sid || !rawSerial) { skipped++; continue }
    if (!roster.has(sid)) { notCurrent++; continue }

    const sn = cleanSerial(rawSerial)
    if (sn.suspect) { suspect.push({ sid, serial: rawSerial }); skipped++; continue }

    // The export is a full history, so a student can appear several times. The
    // newest issue year is their current laptop. Ties keep the earlier row,
    // which is the order the export already arrives in (newest block first).
    const year = String(r["Year"] ?? "").trim()
    const prev = byStudent.get(sid)
    if (prev && sourceYearNum(prev._year) >= sourceYearNum(year)) continue
    if (sn.changed && !prev) repaired++

    byStudent.set(sid, {
      serial_number: sn.value,
      host_name: (r["Host Name"] || "").trim() || null,
      model: (r["Model"] || "").trim() || null,
      notes: (r["Notes"] || "").trim() || null,
      source_year: year || null,
      assigned_student_id: sid,
      status: "assigned",
      _year: year,
    })
  }

  // One student can only hold one laptop, but two students can still name the
  // same serial — and serial_number is unique, so the second upsert would
  // silently steal the device from the first. Surface those instead.
  const bySerial = new Map()
  for (const d of byStudent.values()) {
    const key = d.serial_number.toUpperCase()
    if (!bySerial.has(key)) bySerial.set(key, [])
    bySerial.get(key).push(d.assigned_student_id)
  }
  const clashes = [...bySerial.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([serial, ids]) => ({ serial, students: ids }))

  const devices = [...byStudent.values()].map(({ _year, ...d }) => d)
  return { devices, skipped, notCurrent, repaired, suspect, clashes, total: rows.length }
}

// ------------------------------------------------------------
// EXTERNAL FLEET EXPORTS — Intune and NetSupport DNA
//
// Both tables mirror the last export from a system this app does not own.
// Each row keeps TWO serials: serial_key, the serialKey() normalisation that
// joins to devices, and serial_number, exactly what the console exported —
// which is what the panel displays, because overwriting it with our repaired
// version would quietly throw away the only copy of the raw barcode.
// A row with no serial at all is dropped: without one there is no way to say
// which laptop it is about.
// ------------------------------------------------------------

const txt = (v) => String(v ?? "").trim() || null

// Shared shape for both export importers.
//
// De-dupes by key before returning, because a chunked upsert CANNOT touch the
// same key twice in one statement — Postgres raises "ON CONFLICT DO UPDATE
// command cannot affect row a second time" and the whole 500-row chunk is lost.
// Re-enrolled machines genuinely do appear twice in these exports, so the last
// row wins and the count is reported rather than swallowed.
//
// `imported_at` is in the payload rather than left to the column default: a
// default only fires on INSERT, so on the UPDATE half of an upsert a re-import
// would silently keep the original timestamp forever.
//
// `knownSerials` is a Set from knownSerialSet() — used only for the preview.
function buildExportImport(rows, knownSerials, serialHeader, shape, stampedAt) {
  const byKey = new Map()
  let noSerial = 0, duplicates = 0
  const imported_at = stampedAt || new Date().toISOString()

  for (const r of rows) {
    const raw = String(r[serialHeader] ?? "").trim()
    const key = serialKey(raw)
    if (!key) { noSerial++; continue }
    if (byKey.has(key)) duplicates++
    byKey.set(key, { serial_key: key, serial_number: raw, ...shape(r), imported_at })
  }

  const records = [...byKey.values()]
  const matched = knownSerials
    ? records.filter(d => knownSerials.has(d.serial_key)).length
    : 0
  return {
    records,
    noSerial,
    duplicates,
    matched,
    unmatched: records.length - matched,
    total: rows.length,
  }
}

// Intune export rows → device_intune records. Headers are matched exactly as
// the Intune console writes them, spaces and casing included.
export function buildIntuneImport(rows, knownSerials, stampedAt) {
  return buildExportImport(rows, knownSerials, "Serial number", (r) => ({
    device_name: txt(r["Device name"]),
    manufacturer: txt(r["Manufacturer"]),
    model: txt(r["Model"]),
    management_name: txt(r["Management name"]),
    primary_user_upn: txt(r["Primary user UPN"]),
    primary_user_email: txt(r["Primary user email address"]),
    primary_user_display_name: txt(r["Primary user display name"]),
    compliance: txt(r["Compliance"]),
    ownership: txt(r["Ownership"]),
    sku_family: txt(r["SkuFamily"]),
    join_type: txt(r["JoinType"]),
  }), stampedAt)
}

// NetSupport DNA export rows → device_netsupport records. DNA writes its
// headers in Pascal_Snake_Case, which is why these differ in style from Intune.
//
// "Class" is the year level DNA holds against the machine ("8"), not a form
// group — DNA exports "Form" ("8I") separately and we do not keep it, because
// students.class and students.form already say the same thing with the roster
// behind them. This column is here to show what DNA itself believes.
export function buildNetsupportImport(rows, knownSerials, stampedAt) {
  return buildExportImport(rows, knownSerials, "SerialNumber", (r) => ({
    device_name: txt(r["Device_Name"]),
    pc_node_id: txt(r["PC_NODE_ID"]),
    device_owner: txt(r["Device_Owner"]),
    class: txt(r["Class"]),
    user_name: txt(r["UserName"]),
    logon_name: txt(r["LogonName"]),
  }), stampedAt)
}

// The set of device serials SIMS knows, in the shape the export tables key on.
// Used only to tell an admin how much of an export actually lands on a laptop.
export function knownSerialSet(devices) {
  return new Set(devices.map(d => serialKey(d.serial_number)).filter(Boolean))
}

// The SL laptop a student is assigned. Assignment is NOT a loan — an SL laptop
// is the student's own machine and never goes out on loan.
export function assignedDeviceFor(data, studentId) {
  return data.devices.find(d => d.assigned_student_id === studentId) || null
}

// The student's own device. Prefers the explicit assignment; falls back to a
// host_name of "SL-<id>" for rows imported before assignment existed.
//
// This deliberately does NOT consult loans. It used to, which meant a student
// holding a loan laptop had that loaner shown as their own device — and it made
// every CSV-imported holding look like an active loan.
export function deviceForStudent(data, studentId) {
  return assignedDeviceFor(data, studentId)
      || data.devices.find(dev => dev.host_name === slId(studentId))
      || null
}

// The student's active LOAN LAPTOP loan, ignoring anything that isn't LNB
// stock. Eligibility keys off this, so a leftover SL row can never make a
// student ineligible to borrow.
export function activeLoanLaptopFor(data, studentId) {
  return data.loans.find(l =>
    l.student_id === studentId &&
    l.status === "active" &&
    isLoanDevice(data.devices.find(d => d.id === l.device_id) || {})
  ) || null
}
