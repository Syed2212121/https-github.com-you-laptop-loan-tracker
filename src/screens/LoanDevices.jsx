import React, { useState, useCallback, useMemo } from "react"
import { HardDrive, ChevronDown, Laptop } from "lucide-react"
import { Card, Badge, EmptyState } from "../ui"
import { FieldRow, SearchSelect, ScreenHeader } from "./common"
import { CABINS, cabinByKey, isLoanDevice } from "../lib"

export default function LoanDevices({ data }) {
  const [device, setDevice] = useState(null)
  const [openCabin, setOpenCabin] = useState(null)

  // Only LNB laptops belong on this screen. The devices table also holds the
  // CSV-imported student laptops, which are not loanable stock.
  const loanDevices = useMemo(() => data.devices.filter(isLoanDevice), [data.devices])

  const filter = useCallback((d, q) => {
    const query = q.toLowerCase()
    return (
      (d.lnb || "").toLowerCase().includes(query) ||
      (d.host_name || "").toLowerCase().includes(query) ||
      (d.model || "").toLowerCase().includes(query)
    )
  }, [])

  // The three known cabins, plus a trailing bucket for laptops with no cabin
  // yet — without it they'd be invisible until the cabin CSV is imported.
  const groups = useMemo(() => {
    const byKey = new Map(CABINS.map(c => [c.key, []]))
    const unassigned = []
    for (const d of loanDevices) (byKey.get(d.cabin) || unassigned).push(d)

    const byLnb = (a, b) => (a.lnb || "").localeCompare(b.lnb || "")
    const out = CABINS.map(c => ({ ...c, devices: byKey.get(c.key).sort(byLnb) }))
    if (unassigned.length) {
      out.push({ key: "unassigned", label: "Unassigned", staff: [], devices: unassigned.sort(byLnb) })
    }
    return out
  }, [loanDevices])

  // Collapse on pick so the detail card above is in view on mobile.
  const pick = (d) => { setDevice(d); setOpenCabin(null) }

  return (
    <div className="space-y-5 animate-fadeIn">
      <ScreenHeader eyebrow="IT Service Desk" title="Loan Devices" />

      <SearchSelect
        items={loanDevices}
        filter={filter}
        getKey={(d) => d.id}
        getPrimary={(d) => d.lnb}
        getSecondary={(d) => [d.host_name, d.model].filter(Boolean).join(" · ")}
        getMeta={(d) => cabinByKey(d.cabin)?.label || ""}
        onSelect={pick}
        placeholder="Search LNB, device name or model"
        autoFocus
      />

      {device && (
        <Card className="p-5">
          <FieldRow label="LNB No" value={device.lnb} />
          <FieldRow label="Cabin" value={cabinByKey(device.cabin)?.label} />
          <FieldRow label="Device Name" value={device.host_name} />
          <FieldRow label="Device Model" value={device.model} />
          <FieldRow label="Insurance" value={device.insurance_status} />
          <FieldRow label="Insurance Log" value={device.insurance_log} />
          <FieldRow label="Current Condition" value={device.current_condition} />
        </Card>
      )}

      {loanDevices.length === 0 ? (
        <EmptyState
          icon={HardDrive}
          title="No loan laptops yet"
          description="Loan laptops are the LNB-tagged devices. Import them from the Import tab to see them here."
        />
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-2.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted shrink-0">
              {device ? "Or browse by cabin" : "Browse by cabin"}
            </span>
            <span className="h-px bg-line flex-1" />
          </div>
          <Card className="overflow-hidden">
            {groups.map(cabin => (
              <CabinSection
                key={cabin.key}
                cabin={cabin}
                open={openCabin === cabin.key}
                onToggle={() => setOpenCabin(openCabin === cabin.key ? null : cabin.key)}
                selectedId={device?.id}
                onPick={pick}
              />
            ))}
          </Card>
        </div>
      )}
    </div>
  )
}

// One collapsible cabin: header strip (name · staff · available count) that
// expands to the laptops inside. On-loan laptops stay listed but dimmed, so a
// missing laptop reads as "out" rather than "gone".
function CabinSection({ cabin, open, onToggle, selectedId, onPick }) {
  const available = cabin.devices.filter(d => d.status === "available").length

  return (
    <div className="border-b border-line last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-panel"
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-ink">{cabin.label}</div>
          <div className="text-xs text-muted truncate">
            {cabin.staff.length ? cabin.staff.join(" · ") : "No cabin assigned"}
          </div>
        </div>
        <span className="text-xs text-muted tabular-nums shrink-0">
          {available} avail<span className="text-muted/60"> / {cabin.devices.length}</span>
        </span>
        <ChevronDown size={16} className={`text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="pb-1.5 bg-panel/40">
          {cabin.devices.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted">No laptops in this cabin.</div>
          ) : cabin.devices.map(d => {
            const free = d.status === "available"
            return (
              <button
                key={d.id}
                type="button"
                disabled={!free}
                onClick={() => onPick(d)}
                className={`w-full flex items-center gap-3 pl-6 pr-4 py-2.5 text-left ${
                  free ? "hover:bg-white" : "opacity-50 cursor-default"
                } ${selectedId === d.id ? "bg-navy/[0.06]" : ""}`}
              >
                <Laptop size={15} className="text-navy shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink tabular-nums">{d.lnb}</div>
                  {(d.host_name || d.model) && (
                    <div className="text-xs text-muted truncate">
                      {[d.host_name, d.model].filter(Boolean).join(" · ")}
                    </div>
                  )}
                </div>
                {free
                  ? <Badge tone="ok">Available</Badge>
                  : <Badge tone="neutral">{d.status === "on_loan" ? "On loan" : "Retired"}</Badge>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
