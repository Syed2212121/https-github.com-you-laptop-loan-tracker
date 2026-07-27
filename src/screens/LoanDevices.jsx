import React, { useState, useCallback } from "react"
import { HardDrive } from "lucide-react"
import { Card, EmptyState } from "../ui"
import { FieldRow, SearchSelect, ScreenHeader } from "./common"

export default function LoanDevices({ data }) {
  const [device, setDevice] = useState(null)

  const filter = useCallback((d, q) => {
    const query = q.toLowerCase()
    return !d.archived && (
      (d.lnb || "").toLowerCase().includes(query) ||
      (d.host_name || "").toLowerCase().includes(query) ||
      (d.model || "").toLowerCase().includes(query)
    )
  }, [])

  return (
    <div className="space-y-5 animate-fadeIn">
      <ScreenHeader eyebrow="IT Service Desk" title="Loan Devices" />

      <SearchSelect
        items={data.devices}
        filter={filter}
        getKey={(d) => d.id}
        getPrimary={(d) => d.lnb || "—"}
        getSecondary={(d) => [d.host_name, d.model].filter(Boolean).join(" · ")}
        onSelect={setDevice}
        placeholder="Search LNB, device name or model"
        autoFocus
      />

      {!device && (
        <EmptyState icon={HardDrive} title="Search for a device" description="Type a serial number, device name or model above to view its details." />
      )}

      {device && (
        <Card className="p-5">
          <FieldRow label="LNB No" value={device.lnb} />
          <FieldRow label="Device Name" value={device.host_name} />
          <FieldRow label="Device Model" value={device.model} />
          <FieldRow label="Insurance" value={device.insurance_status} />
          <FieldRow label="Insurance Log" value={device.insurance_log} />
          <FieldRow label="Current Condition" value={device.current_condition} />
        </Card>
      )}
    </div>
  )
}
