import React from "react"
import { Users } from "lucide-react"
import { EmptyState } from "../ui"
import { SearchSelect, ScreenHeader } from "./common"

export default function StaffDevices() {
  const noop = () => {}
  return (
    <div className="space-y-5 animate-fadeIn">
      <ScreenHeader eyebrow="IT Service Desk" title="Staff Devices" />

      {/* Search bar only for now — staff register is a later iteration. */}
      <SearchSelect
        items={[]}
        filter={() => false}
        getKey={() => ""}
        getPrimary={() => ""}
        onSelect={noop}
        placeholder="Search staff devices"
      />

      <EmptyState icon={Users} title="Coming soon" description="The staff device register will be added in a later update." />
    </div>
  )
}
