import React from "react"
import { GraduationCap, HardDrive, ClipboardList, Users, Workflow, Link2, Shield, KeyRound, Boxes, ShieldCheck, MonitorSmartphone } from "lucide-react"
import { Card, Badge, Table } from "../ui"
import { ScreenHeader, LoanStateBadge } from "./common"
import { LOAN_DAYS, DUE_SOON_DAYS, CABINS } from "../lib"

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
  [<C>class</C>, "text", <span>Year level from SIMS <C>StudentYearLevel</C>, e.g. <C>4</C>. <C>0</C> means Prep and displays as such. Older imports hold the combined <C>4I</C>.</span>],
  [<C>form</C>, "text", <span>Form group from SIMS <C>StudentForm</C>, stored verbatim, e.g. <C>4I</C>. Older imports hold just the letter, split out of "Student Yr.".</span>],
  [<C>details</C>, "jsonb", <span className="text-muted">Reserved — defaults to <C>{"{}"}</C>, nothing writes it yet.</span>],
  [<C>notes</C>, "text", "Free text."],
  [<C>archived</C>, "boolean", "Soft delete. Archived students are hidden from search."],
  [<C>created_at</C>, "timestamptz", "Defaults to now()."],
]

const DEVICES = [
  [<C>id</C>, "uuid", <span><Badge tone="navy">PK</Badge> <span className="ml-1">Generated. Loans reference this, not the serial.</span></span>],
  [<C>lnb</C>, "text", <span><Badge tone="neutral">unique</Badge> <span className="ml-1">Asset number IT uses day to day, e.g. <C>LNB-0166</C>. Present only on loan laptops — its presence is what makes a device loanable.</span></span>],
  [<C>cabin</C>, "text", <span><C>yr3_5</C> · <C>yr6_7</C> · <C>yr8_9</C> (checked). Which cabin the loan laptop lives in. Null until the cabin CSV is imported.</span>],
  [<C>host_name</C>, "text", <span>e.g. <C>SL-21816</C> — the machine name. Usually encodes the student ID, but not reliably: of 468 CSV rows, 109 disagree and 73 are blank. Never rely on it to identify the owner.</span>],
  [<C>assigned_student_id</C>, "text", <span><Badge tone="neutral">FK</Badge> <span className="ml-1">→ <C>students.student_id</C>. The student whose own SL laptop this is. Assignment is <span className="font-semibold">not</span> a loan.</span></span>],
  [<C>serial_number</C>, "text", <span><Badge tone="neutral">unique</Badge> <span className="ml-1">The import key — devices are upserted by serial.</span></span>],
  [<C>model</C>, "text", "From the CSV."],
  [<C>source_year</C>, "text", <span>The SIMS <C>Year</C> column — which year this laptop was issued. Decides which row is a student's current laptop when the export lists several. Not always numeric: <C>2020-21</C> appears on 823 rows.</span>],
  [<C>status</C>, "text", <span><C>available</C> · <C>on_loan</C> · <C>retired</C> · <C>assigned</C> (checked). Issue/return flips the first two; SL laptops sit at <C>assigned</C>.</span>],
  [<C>netsupport_school</C>, "boolean", <span>Not null, defaults false. The one management field staff set by HAND — no console exports it. Ticked from Device Class Details; never written by the importers.</span>],
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
  [<C>original_issue_date</C>, "date", <span className="text-muted">Unused since 0006 — the CSV's "Collection Date" belonged to the seeded loans, which are gone. Nothing writes it now.</span>],
  [<C>returned_at</C>, "timestamptz", "Null while the loan is active."],
  [<C>renewed_count</C>, "integer", "Incremented on every renewal."],
  [<C>status</C>, "text", <span><C>active</C> · <C>returned</C> (checked).</span>],
  [<C>issued_by</C>, "uuid", <span>→ <C>auth.users</C>. The signed-in account that recorded the issue.</span>],
  [<C>handed_over_by</C>, "text", <span>The named cabin custodian who physically passed the laptop over, e.g. <C>Rudi</C>. Chosen at issue time — not an <C>auth.users</C> reference.</span>],
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
  [<C>cabin</C>, "text", <span><C>yr3_5</C> · <C>yr6_7</C> · <C>yr8_9</C> (checked). Set means a cabin custodian: read-only inventory, may lend only from their own cupboard, and cannot see student laptops. Null means admin or full staff.</span>],
  [<C>created_at</C>, "timestamptz", "Defaults to now()."],
]

// Two mirrors of external fleet exports. Neither is app-owned data — only the
// CSV importers write them, and both cover machines that have no devices row.
const DEVICE_INTUNE = [
  [<C>serial_key</C>, "text", <span><Badge tone="navy">PK</Badge> <span className="ml-1"><C>cleanSerial(serial_number)</C> upper-cased. The join to <C>devices.serial_number</C>, which went through the same funnel at import. Not displayed.</span></span>],
  [<C>serial_number</C>, "text", <span>As Intune exported it — the raw Lenovo barcode, not the 8 characters <C>devices</C> stores. Displayed; never joined on.</span>],
  [<C>device_name</C>, "text", <span>Intune "Device name".</span>],
  [<C>manufacturer</C>, "text", "From the export."],
  [<C>model</C>, "text", "From the export."],
  [<C>management_name</C>, "text", "From the export."],
  [<C>primary_user_upn</C>, "text", "The signed-in owner Intune knows about — usually the student."],
  [<C>primary_user_email</C>, "text", <span>Intune "Primary user email address".</span>],
  [<C>primary_user_display_name</C>, "text", "From the export."],
  [<C>compliance</C>, "text", "Intune compliance state."],
  [<C>ownership</C>, "text", "Corporate or personal, as Intune records it."],
  [<C>sku_family</C>, "text", "From the export."],
  [<C>join_type</C>, "text", "How the machine is joined to the tenant."],
  [<C>imported_at</C>, "timestamptz", "Set by the importer on every row, not by a column default — a default would not re-fire on the update half of an upsert."],
]

const DEVICE_NETSUPPORT = [
  [<C>serial_key</C>, "text", <span><Badge tone="navy">PK</Badge> <span className="ml-1">Same normalisation as <C>device_intune</C>.</span></span>],
  [<C>serial_number</C>, "text", <span>DNA "SerialNumber", as exported.</span>],
  [<C>device_name</C>, "text", <span>DNA "Device_Name".</span>],
  [<C>pc_node_id</C>, "text", <span>DNA's own identity for the machine. Indexed, but not the key — a row with no serial can't be joined to a laptop and is dropped at import.</span>],
  [<C>device_owner</C>, "text", "From the export."],
  [<C>class</C>, "text", <span>DNA "Class" — the year level DNA has against the machine. Reference only; <C>students.class</C> is the authority for a student's year.</span>],
  [<C>user_name</C>, "text", "From the export."],
  [<C>logon_name</C>, "text", "From the export."],
  [<C>imported_at</C>, "timestamptz", "Set by the importer on every row."],
]

// The three physical cabins. Source of truth is CABINS in src/lib.js — the
// mapping is code, not data, so only devices.cabin lives in the database.
const CABIN_ROWS = CABINS.map(c => [<C>{c.key}</C>, c.label, c.staff.join(" · ")])

// --- lifecycle --------------------------------------------------------------

const LIFECYCLE = [
  [
    <span className="font-semibold text-navy">1 · Import</span>,
    "Import tab (CSV)",
    <span>Two SIMS exports, in order. The <span className="font-semibold">roster</span> upserts <C>students</C> by ID and is the only thing that writes a student — it alone carries year level, form and a reliable name. The <span className="font-semibold">device</span> file then upserts <C>devices</C> by serial, writing <C>assigned_student_id</C> and <C>status=assigned</C>. It joins against the roster, so its history rows for students who have left are reported and dropped, and where a student appears several times the newest <C>source_year</C> wins. <span className="font-semibold">No loans are created</span> — a student's own SL laptop is an assignment. Re-running updates rather than duplicates. A third uploader sets <C>devices.cabin</C> from an LNB/Cabin file, creating any LNB it hasn't seen.</span>,
  ],
  [
    <span className="font-semibold text-navy">2 · Look up</span>,
    <span className="text-muted">Read only, apart from the NetSupport School tick on Device Class Details.</span>,
    <span className="text-muted">Read only. Nothing is written by searching.</span>,
  ],
  [
    <span className="font-semibold text-navy">3 · Issue</span>,
    "Loan Portal → Issue a laptop",
    <span>Inserts <C>loans</C> with <C>status=active</C>, <C>due_at = now + {LOAN_DAYS}d</C> and the chosen <C>handed_over_by</C>, then sets <C>devices.status = on_loan</C>. Only LNB laptops can be issued.</span>,
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
  [<span><C>students</C> → <C>devices</C></span>, "one to one", <span>Via <C>assigned_student_id</C> — the student's own SL laptop. Permanent, and never a loan.</span>, <C>set null</C>],
  [<span><C>students</C> → <C>loans</C></span>, "one to many", <span>A student has many loans over time, but only one <C>active</C>. Loan laptops (LNB) only.</span>, <C>cascade</C>],
  [<span><C>devices</C> → <C>loans</C></span>, "one to many", <span>A device has many loans over time, but only one <C>active</C>.</span>, <C>restrict</C>],
  [<span><C>auth.users</C> → <C>staff</C></span>, "one to one", "Only listed users can read or write anything.", <C>cascade</C>],
  [<span><C>auth.users</C> → <C>loans</C></span>, "one to many", <span>Via <C>issued_by</C> / <C>returned_by</C> / <C>renewed_by</C>.</span>, "—"],
  [<span><C>devices</C> → <C>device_intune</C></span>, "one to one", <span>Matched on the normalised serial, <span className="font-semibold">not</span> a foreign key — the export covers staff machines that have no <C>devices</C> row, and one orphan in a chunked upsert would take 499 good rows with it.</span>, "—"],
  [<span><C>devices</C> → <C>device_netsupport</C></span>, "one to one", <span>Same arrangement as <C>device_intune</C>.</span>, "—"],
]

const GUARDS = [
  [<span>One active loan per student</span>, <span>Partial unique index <C>loans_one_active_per_student</C></span>, "A student holding a laptop shows as Not eligible until they return it."],
  [<span>One active loan per device</span>, <span>Partial unique index <C>loans_one_active_per_device</C></span>, "A laptop can't be issued twice, even on a double-click race."],
  [<span>Serial is unique</span>, <span>Unique constraint on <C>devices.serial_number</C></span>, "Makes the CSV import idempotent."],
  [<span>LNB is unique</span>, <span>Partial unique index <C>devices_lnb_key</C></span>, "Nulls allowed for legacy rows with no LNB yet."],
  [<span>Status stays valid</span>, <span>Check constraints on <C>devices.status</C> and <C>loans.status</C></span>, "Only the listed values can be stored."],
  [<span>Cabin stays valid</span>, <span>Check constraint on <C>devices.cabin</C></span>, "A typo in the cabin CSV is rejected by the database, not silently stored."],
  [<span>SL laptops are never loaned</span>, <span>Trigger <C>loans_device_must_be_loanable</C></span>, "A loan may only reference a device with an LNB. The UI enforces this too, but the UI is how 468 bogus loans got in once already."],
  [<span>One laptop per student</span>, <span>Partial unique index <C>devices_one_per_student</C></span>, "A student can hold only one live assigned device. Archived rows keep their old assignment without blocking the current one."],
  [<span>Nothing is truly deleted</span>, <span><C>archived</C> flag on students and devices</span>, "Soft delete keeps the loan trail complete."],
  [<span>One export row per serial</span>, <span>Primary key on <C>serial_key</C></span>, "Re-importing an export updates rows rather than stacking copies. The importer collapses duplicate serials first — a chunked upsert can't touch the same key twice in one statement."],
]

const ACCESS = [
  ["Read", <span>Any member of <C>staff</C></span>, <span>Enforced by <C>public.is_staff()</C>. Cabin custodians are the exception: they can't see student laptops, only loan stock.</span>],
  ["Insert, update", <span>Full staff — not cabin custodians</span>, <span><C>is_staff() and not is_cabin_scoped()</C>. The UI is mostly stricter than this: the edit modals are admin-only. The NetSupport School tick is the exception — it matches the policy exactly, because no importer owns that column.</span>],
  ["Read Intune & NetSupport", <span>Full staff only</span>, <span><C>is_staff() and not is_cabin_scoped()</C> — these rows carry a student's UPN and email next to their serial, so custodians are kept out.</span>],
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

      <Section icon={KeyRound} title="Tables" hint="Six tables in the public schema. Greyed rows are columns that exist but have no data source wired yet.">
        <div className="space-y-4">
          <SchemaCard icon={GraduationCap} name="students" purpose="One row per student, keyed by their college ID." count={students.length} columns={STUDENTS} />
          <SchemaCard icon={HardDrive} name="devices" purpose="The laptop inventory — loan pool and assigned machines." count={devices.length} columns={DEVICES} />
          <SchemaCard icon={ClipboardList} name="loans" purpose="Every issue, renewal and return. The audit trail." count={loans.length} columns={LOANS} />
          <SchemaCard icon={Users} name="staff" purpose="Who may use the app, and who may delete." columns={STAFF} />
          <SchemaCard icon={ShieldCheck} name="device_intune" purpose="Mirror of the Intune export. Read-only reference, refreshed by re-importing the CSV." columns={DEVICE_INTUNE} />
          <SchemaCard icon={MonitorSmartphone} name="device_netsupport" purpose="Mirror of the NetSupport DNA export. Read-only reference." columns={DEVICE_NETSUPPORT} />
        </div>
      </Section>

      <Section
        icon={Boxes}
        title="Cabins"
        hint="The three cupboards loan laptops live in. Only the key is stored on a device — the label and staff names come from CABINS in src/lib.js."
      >
        <Card className="px-4 pb-1">
          <Table head={["Key", "Cabin", "IT staff"]} rows={CABIN_ROWS} minWidth={480} />
        </Card>
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
        Mirrors <C>supabase/migrations/0001</C>–<C>0009</C> and <C>src/actions.js</C>. Update this screen whenever a migration lands.
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
