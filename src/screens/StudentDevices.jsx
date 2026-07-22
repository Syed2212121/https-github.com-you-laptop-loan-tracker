import React, { useState, useCallback } from "react"
import { GraduationCap } from "lucide-react"
import { Card, EmptyState } from "../ui"
import { FieldRow, SearchSelect, ScreenHeader } from "./common"
import { displayName, slId, splitClassForm, deviceForStudent } from "../lib"

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

  return (
    <div className="space-y-5 animate-fadeIn">
      <ScreenHeader eyebrow="IT Service Desk" title="Student Devices" />

      <SearchSelect
        items={data.students}
        filter={filter}
        getKey={(s) => s.student_id}
        getPrimary={(s) => slId(s.student_id)}
        getSecondary={(s) => displayName(s)}
        getMeta={(s) => s.class || ""}
        onSelect={setStudent}
        placeholder="Search Student ID or name"
        autoFocus
        inputMode="text"
      />

      {!student && (
        <EmptyState icon={GraduationCap} title="Search for a student" description="Type a Student ID or name above to view their details and assigned device." />
      )}

      {student && (
        <Card className="p-5">
          <FieldRow label="Student ID" value={slId(student.student_id)} />
          <FieldRow label="Student Name" value={displayName(student)} />
          <FieldRow label="Class" value={cls} />
          <FieldRow label="Form" value={form} />
          <FieldRow label="Serial Number" value={device?.serial_number} />
          <FieldRow label="Device Name" value={device?.host_name} />
          <FieldRow label="Device Model" value={device?.model} />
          <FieldRow label="Insurance" value={device?.insurance_status} />
          <FieldRow label="Insurance Log" value={device?.insurance_log} />
          <FieldRow label="Current Condition" value={device?.current_condition} />
        </Card>
      )}
    </div>
  )
}
