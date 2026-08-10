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

// Display form of a student ID, e.g. "21816" → "SL-21816".
export function slId(studentId) {
  return studentId ? `SL-${studentId}` : "—"
}

// The device currently associated with a student: the one on their active
// loan, falling back to a device whose host_name matches "SL-<id>". Or null.
export function deviceForStudent(data, studentId) {
  const loan = activeLoanForStudent(data.loans, studentId)
  if (loan) {
    const d = data.devices.find(dev => dev.id === loan.device_id)
    if (d) return d
  }
  return data.devices.find(dev => dev.host_name === slId(studentId)) || null
}
