import React, { useState, useCallback } from "react"
import { GraduationCap, HardDrive, AlertTriangle } from "lucide-react"
import { Card, EmptyState } from "../ui"
import { FieldRow, SearchSelect, ScreenHeader, SectionCard } from "./common"
import { displayName, splitClassForm, classFormLabel, deviceForStudent, yearLevelLabel } from "../lib"

// FieldRow shows "—" for a blank, so a card whose every value is blank is pure
// noise. Mirrors FieldRow's own rule that 0 counts as a real value.
const anyFilled = (...vals) => vals.some(v => v === 0 || (v != null && v !== ""))

export default function StudentDevices({ data }) {
  const [student, setStudent] = useState(null)

  const filter = useCallback((s, q) => {
    const query = q.toLowerCase()
    return !s.archived && (s.student_id.toLowerCase().includes(query) || displayName(s).toLowerCase().includes(query))
  }, [])

  // Prefer a stored form value (post-restructure imports); otherwise split it
  // out of the combined "class" value (e.g. "4I") from older imports.
  const split = student && !student.form ? splitClassForm(student.class) : null
  const cls = student ? (student.form ? (student.class || "") : split.class) : ""
  const form = student ? (student.form || split.form) : ""
  const device = student ? deviceForStudent(data, student.student_id) : null

  // The 1:1 program starts at Year 4, so Prep–Yr 3 having no laptop is normal
  // and anything above that is worth a second look.
  const expectsDevice = student && cls !== "" && Number(cls) >= 4

  // No import path fills the insurance columns yet, so for most students that
  // card would be three em dashes. Only show either card once it has content.
  const hasInsurance = anyFilled(device?.insurance_status, device?.insurance_log, device?.current_condition)
  const hasOther = anyFilled(device?.source_year, device?.notes)

  return (
    <div className="space-y-5 animate-fadeIn">
      <ScreenHeader eyebrow="IT Service Desk" title="Student Devices" />

      <SearchSelect
        items={data.students}
        filter={filter}
        getKey={(s) => s.student_id}
        getPrimary={(s) => s.student_id}
        getSecondary={(s) => displayName(s)}
        getMeta={(s) => s.form || yearLevelLabel(s.class)}
        onSelect={setStudent}
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
            <SectionCard title="Student">
              <FieldRow label="Student ID" value={student.student_id} />
              <FieldRow label="Student Name" value={displayName(student)} />
              <FieldRow label="Class & Form" value={classFormLabel(cls, form)} />
              <FieldRow label="Serial Number" value={device?.serial_number} />
            </SectionCard>

            <SectionCard title="Device">
              <FieldRow label="Serial Number" value={device?.serial_number} />
              <FieldRow label="Device Name" value={device?.host_name} />
              <FieldRow label="Device Model" value={device?.model} />
            </SectionCard>

            {hasInsurance && (
              <SectionCard title="Insurance & Condition">
                <FieldRow label="Insurance" value={device?.insurance_status} />
                <FieldRow label="Insurance Log" value={device?.insurance_log} />
                <FieldRow label="Current Condition" value={device?.current_condition} />
              </SectionCard>
            )}

            {hasOther && (
              <SectionCard title="Other">
                <FieldRow label="Issued" value={device?.source_year} />
                <FieldRow label="Notes" value={device?.notes} />
              </SectionCard>
            )}
          </div>

          {!device && (
            expectsDevice ? (
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
        </>
      )}
    </div>
  )
}
