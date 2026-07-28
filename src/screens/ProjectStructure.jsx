import React from "react"
import { GraduationCap, HardDrive, ClipboardList, Users, Workflow, Link2, Shield, KeyRound, Boxes } from "lucide-react"
import { Card, Badge } from "../ui"
import { ScreenHeader, LoanStateBadge } from "./common"
import { LOAN_DAYS, DUE_SOON_DAYS } from "../lib"

// ============================================================
// PROJECT STRUCTURE — a read-only reference of the data model.
// Everything here is hand-mirrored from supabase/migrations/*.sql
// and src/actions.js. When a migration changes, update this file.
// ============================================================

// --- small presentational helpers -------------------------------------------

// Monospaced column / value name.
const C = ({ children }) => (
  <code className="font-mono text-[12px] text-navy bg-panel px-1.5 py-0.5 rounded whitespace-nowrap">{children}</code>
)

// Horizontally scrollable table — the page body must never scroll sideways.
function Table({ head, rows, minWidth = 560 }) {
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

function Section({ icon: Icon, title, hint, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2 text-[11px] uppercase tracking-[0.18em] text-muted">
        <Icon size={14} /> {title}
      </div>
      {hint && <p className="text-xs text-muted mb-2.5 max-w-2xl">{hint}</p>}
      {children}
    </section>
  )
}

// One database table: header strip (name · purpose · live row count) + columns.
function SchemaCard({ icon: Icon, name, purpose, count, columns }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-line bg-panel/60">
        <Icon size={17} className="text-navy shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm text-navy font-semibold">{name}</div>
          <div className="text-xs text-muted">{purpose}</div>
        </div>
        {count != null && (
          <div className="text-right shrink-0">
            <div className="font-serif text-xl text-navy tabular-nums leading-none">{count}</div>
            <div className="text-[9px] uppercase tracking-[0.15em] text-muted mt-1">rows</div>
          </div>
        )}
      </div>
      <div className="px-4 pb-1">
        <Table head={["Column", "Type", "Notes"]} rows={columns} minWidth={520} />
      </div>
    </Card>
  )
}

// --- schema data ------------------------------------------------------------

const STUDENTS = [
  [<C>student_id</C>, "text", <span><Badge tone="navy">PK</Badge> <span className="ml-1">e.g. <C>21816</C>. From the CSV "Student ID". Stored bare; the <C>SL-</C> form is a device host name, not the ID.</span></span>],
  [<C>first_name</C>, "text", 'Parsed from "Student Name" ("Last, First").'],
  [<C>last_name</C>, "text", "Parsed from the same column."],
  [<C>full_name</C>, "text", "Preferred display name; falls back to first + last."],
  [<C>class</C>, "text", <span>Year level, e.g. <C>4</C>. Older imports hold the combined <C>4I</C>.</span>],
  [<C>form</C>, "text", <span>Form group, e.g. <C>I</C>. Split out of "Student Yr." on import.</span>],
  [<C>details</C>, "jsonb", <span className="text-muted">Reserved — defaults to <C>{"{}"}</C>, nothing writes it yet.</span>],
  [<C>notes</C>, "text", "Free text."],
  [<C>archived</C>, "boolean", "Soft delete. Archived students are hidden from search."],
  [<C>created_at</C>, "timestamptz", "Defaults to now()."],
]

const DEVICES = [
  [<C>id</C>, "uuid", <span><Badge tone="navy">PK</Badge> <span className="ml-1">Generated. Loans reference this, not the serial.</span></span>],
  [<C>lnb</C>, "text", <span><Badge tone="neutral">unique</Badge> <span className="ml-1">Asset number IT uses day to day, e.g. <C>LNB-0166</C>. Shown first wherever a device is named.</span></span>],
  [<C>host_name</C>, "text", <span>e.g. <C>SL-21816</C> — the machine name, which encodes the student ID for 1:1 assigned laptops.</span>],
  [<C>serial_number</C>, "text", <span><Badge tone="neutral">unique</Badge> <span className="ml-1">The import key — devices are upserted by serial.</span></span>],
  [<C>model</C>, "text", "From the CSV."],
  [<C>status</C>, "text", <span><C>available</C> · <C>on_loan</C> · <C>retired</C> (checked). Flipped by issue/return.</span>],
  [<C>warranty_expiry</C>, "date", <span className="text-muted">Reserved — for the Lenovo API phase.</span>],
  [<C>insurance_status</C>, "text", <span className="text-muted">Reserved — displayed as "Insurance", no source wired.</span>],
  [<C>insurance_log</C>, "text", <span className="text-muted">Reserved — displayed, no source wired.</span>],
  [<C>current_condition</C>, "text", <span className="text-muted">Reserved — displayed, no source wired.</span>],
  [<C>it_support</C>, "text", <span className="text-muted">Reserved — not shown anywhere yet.</span>],
  [<C>notes</C>, "text", "Free text."],
  [<C>archived</C>, "boolean", "Soft delete — keeps loan history intact."],
  [<C>created_at</C>, "timestamptz", "Defaults to now()."],
]

const LOANS = [
  [<C>id</C>, "uuid", <span><Badge tone="navy">PK</Badge></span>],
  [<C>student_id</C>, "text", <span><Badge tone="neutral">FK</Badge> <span className="ml-1">→ <C>students.student_id</C>, on delete cascade.</span></span>],
  [<C>device_id</C>, "uuid", <span><Badge tone="neutral">FK</Badge> <span className="ml-1">→ <C>devices.id</C>, on delete restrict — a device with history can't be deleted.</span></span>],
  [<C>issued_at</C>, "timestamptz", <span>Start of the {LOAN_DAYS}-day window.</span>],
  [<C>due_at</C>, "timestamptz", <span><C>issued_at</C> + {LOAN_DAYS} days. Reset by each renewal.</span>],
  [<C>original_issue_date</C>, "date", "The CSV collection date, kept for seeded loans only."],
  [<C>returned_at</C>, "timestamptz", "Null while the loan is active."],
  [<C>renewed_count</C>, "integer", "Incremented on every renewal."],
  [<C>status</C>, "text", <span><C>active</C> · <C>returned</C> (checked).</span>],
  [<C>issued_by</C>, "uuid", <span>→ <C>auth.users</C>. Who handed it out.</span>],
  [<C>returned_by</C>, "uuid", <span>→ <C>auth.users</C>. Who took it back.</span>],
  [<C>renewed_by</C>, "uuid", <span>→ <C>auth.users</C>. Who extended it.</span>],
  [<C>reminder_sent_at</C>, "timestamptz", <span className="text-muted">Reserved — for the overdue-email phase. Cleared on renewal.</span>],
  [<C>notes</C>, "text", "Free text."],
  [<C>created_at</C>, "timestamptz", "Defaults to now()."],
]

const STAFF = [
  [<C>id</C>, "uuid", <span><Badge tone="navy">PK</Badge> <span className="ml-1">→ <C>auth.users</C>, on delete cascade.</span></span>],
  [<C>email</C>, "text", "Login email."],
  [<C>is_admin</C>, "boolean", "Admins are the only role that can permanently delete rows."],
  [<C>created_at</C>, "timestamptz", "Defaults to now()."],
]

// --- lifecycle --------------------------------------------------------------

const LIFECYCLE = [
  [
    <span className="font-semibold text-navy">1 · Import</span>,
    "Import tab (CSV)",
    <span>Upserts <C>students</C> by ID and <C>devices</C> by serial, then opens an active <C>loans</C> row for each student–device pair and sets those devices to <C>on_loan</C>. Re-running updates rather than duplicates.</span>,
  ],
  [
    <span className="font-semibold text-navy">2 · Look up</span>,
    "Students · Devices · Loan Portal",
    <span className="text-muted">Read only. Nothing is written by searching.</span>,
  ],
  [
    <span className="font-semibold text-navy">3 · Issue</span>,
    "Loan Portal → Issue a laptop",
    <span>Inserts <C>loans</C> with <C>status=active</C> and <C>due_at = now + {LOAN_DAYS}d</C>, then sets <C>devices.status = on_loan</C>.</span>,
  ],
  [
    <span className="font-semibold text-navy">4 · Renew</span>,
    <span>Loan Portal → Renew {LOAN_DAYS}d</span>,
    <span>Pushes <C>due_at</C> to <C>now + {LOAN_DAYS}d</C>, bumps <C>renewed_count</C>, clears <C>reminder_sent_at</C>. The device does not change hands.</span>,
  ],
  [
    <span className="font-semibold text-navy">5 · Return</span>,
    "Loan Portal → Return",
    <span>Sets <C>loans.status = returned</C> and <C>returned_at = now</C>, then frees the device back to <C>available</C>. The loan row stays as history.</span>,
  ],
]

const RELATIONSHIPS = [
  [<span><C>students</C> → <C>loans</C></span>, "one to many", <span>A student has many loans over time, but only one <C>active</C>.</span>, <C>cascade</C>],
  [<span><C>devices</C> → <C>loans</C></span>, "one to many", <span>A device has many loans over time, but only one <C>active</C>.</span>, <C>restrict</C>],
  [<span><C>auth.users</C> → <C>staff</C></span>, "one to one", "Only listed users can read or write anything.", <C>cascade</C>],
  [<span><C>auth.users</C> → <C>loans</C></span>, "one to many", <span>Via <C>issued_by</C> / <C>returned_by</C> / <C>renewed_by</C>.</span>, "—"],
]

const GUARDS = [
  [<span>One active loan per student</span>, <span>Partial unique index <C>loans_one_active_per_student</C></span>, "A student holding a laptop shows as Not eligible until they return it."],
  [<span>One active loan per device</span>, <span>Partial unique index <C>loans_one_active_per_device</C></span>, "A laptop can't be issued twice, even on a double-click race."],
  [<span>Serial is unique</span>, <span>Unique constraint on <C>devices.serial_number</C></span>, "Makes the CSV import idempotent."],
  [<span>LNB is unique</span>, <span>Partial unique index <C>devices_lnb_key</C></span>, "Nulls allowed for legacy rows with no LNB yet."],
  [<span>Status stays valid</span>, <span>Check constraints on <C>devices.status</C> and <C>loans.status</C></span>, "Only the listed values can be stored."],
  [<span>Nothing is truly deleted</span>, <span><C>archived</C> flag on students and devices</span>, "Soft delete keeps the loan trail complete."],
]

const ACCESS = [
  ["Read, insert, update", <span>Any member of <C>staff</C></span>, <span>Enforced by <C>public.is_staff()</C> in row-level security.</span>],
  ["Permanent delete", <span>Admins only (<C>is_admin</C>)</span>, <span>Enforced by <C>public.is_admin()</C>. Day-to-day work archives instead.</span>],
  ["Everyone else", "No access", "RLS is forced on every table, and public signup is off."],
]

const RESERVED = [
  ["Staff device register", <span>Screen is a <span className="text-muted">Coming soon</span> placeholder — no staff-device table exists yet.</span>],
  ["Warranty lookup", <span><C>devices.warranty_expiry</C> exists; the Lenovo API is not wired.</span>],
  ["Overdue email reminders", <span><C>loans.reminder_sent_at</C> exists; no mailer is wired.</span>],
  ["Insurance & condition", <span><C>insurance_status</C>, <C>insurance_log</C>, <C>current_condition</C> display as "—" until a source is chosen.</span>],
  ["Archive a device", <span><C>setDeviceArchived()</C> exists in <C>actions.js</C> but no current screen calls it.</span>],
]

// --- screen -----------------------------------------------------------------

export default function ProjectStructure({ data }) {
  const students = data?.students ?? []
  const devices = data?.devices ?? []
  const loans = data?.loans ?? []

  // Sample loans for the state legend — a real one when we have it, otherwise a
  // synthetic date so the badges still render.
  const day = 24 * 60 * 60 * 1000
  const sample = (offsetDays, returned) => ({
    due_at: new Date(Date.now() + offsetDays * day).toISOString(),
    returned_at: returned ? new Date().toISOString() : null,
    status: returned ? "returned" : "active",
  })

  return (
    <div className="space-y-7 animate-fadeIn">
      <ScreenHeader
        eyebrow="Reference"
        title="Project Structure"
        subtitle="The data model behind the app — what each table holds, and how a laptop moves from the shelf to a student and back."
      />

      {/* Live shape of the data */}
      <div className="grid grid-cols-3 gap-3">
        <Stat icon={GraduationCap} label="Students" value={students.length} />
        <Stat icon={HardDrive} label="Devices" value={devices.length} />
        <Stat icon={ClipboardList} label="Loans" value={loans.length} />
      </div>

      <Section
        icon={Workflow}
        title="How a loan moves"
        hint="Every write the app makes, in order. Steps 3–5 are the daily loop."
      >
        <Card className="px-4 pb-1">
          <Table head={["Step", "Where", "What changes in the data"]} rows={LIFECYCLE} minWidth={640} />
        </Card>
      </Section>

      <Section
        icon={Boxes}
        title="Loan states"
        hint={`Derived from due_at at render time — no state column is stored. "Due soon" starts ${DUE_SOON_DAYS} days out.`}
      >
        <Card className="px-4 pb-1">
          <Table
            minWidth={480}
            head={["Badge", "State", "Condition"]}
            rows={[
              [<LoanStateBadge loan={sample(5)} />, <C>active</C>, <span>More than {DUE_SOON_DAYS} days until <C>due_at</C>.</span>],
              [<LoanStateBadge loan={sample(1)} />, <C>due_soon</C>, <span>Within {DUE_SOON_DAYS} days of <C>due_at</C>.</span>],
              [<LoanStateBadge loan={sample(-3)} />, <C>overdue</C>, <span>Past <C>due_at</C> and still not returned.</span>],
              [<LoanStateBadge loan={sample(-3, true)} />, <C>returned</C>, <span><C>returned_at</C> is set.</span>],
            ]}
          />
        </Card>
      </Section>

      <Section icon={KeyRound} title="Tables" hint="Four tables in the public schema. Greyed rows are columns that exist but have no data source wired yet.">
        <div className="space-y-4">
          <SchemaCard icon={GraduationCap} name="students" purpose="One row per student, keyed by their college ID." count={students.length} columns={STUDENTS} />
          <SchemaCard icon={HardDrive} name="devices" purpose="The laptop inventory — loan pool and assigned machines." count={devices.length} columns={DEVICES} />
          <SchemaCard icon={ClipboardList} name="loans" purpose="Every issue, renewal and return. The audit trail." count={loans.length} columns={LOANS} />
          <SchemaCard icon={Users} name="staff" purpose="Who may use the app, and who may delete." columns={STAFF} />
        </div>
      </Section>

      <Section icon={Link2} title="Relationships">
        <Card className="px-4 pb-1">
          <Table head={["Between", "Cardinality", "Meaning", "On delete"]} rows={RELATIONSHIPS} minWidth={680} />
        </Card>
      </Section>

      <Section icon={Shield} title="Guards & rules" hint="Enforced in the database, so a UI bug or a double-click can't break them.">
        <Card className="px-4 pb-1">
          <Table head={["Rule", "Enforced by", "Why it matters"]} rows={GUARDS} minWidth={680} />
        </Card>
      </Section>

      <Section icon={Shield} title="Who can do what">
        <Card className="px-4 pb-1">
          <Table head={["Action", "Who", "How"]} rows={ACCESS} minWidth={560} />
        </Card>
      </Section>

      <Section icon={Boxes} title="Reserved for later" hint="Built into the schema but not yet connected — listed so the gaps stay visible.">
        <Card className="px-4 pb-1">
          <Table head={["Area", "Status"]} rows={RESERVED} minWidth={520} />
        </Card>
      </Section>

      <p className="text-xs text-muted pt-1">
        Mirrors <C>supabase/migrations/0001</C>–<C>0004</C> and <C>src/actions.js</C>. Update this screen whenever a migration lands.
      </p>
    </div>
  )
}

function Stat({ icon: Icon, label, value }) {
  return (
    <Card className="p-4 text-center">
      <Icon size={18} className="mx-auto text-navy mb-1.5" />
      <div className="font-serif text-2xl text-navy tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted mt-0.5">{label}</div>
    </Card>
  )
}
