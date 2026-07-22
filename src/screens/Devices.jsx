import React, { useState, useMemo } from "react"
import { Search, Plus, Laptop, HardDrive, Edit3, Trash2, Loader2, Archive, ArchiveRestore } from "lucide-react"
import { supabase } from "../supabase"
import { setDeviceArchived } from "../actions"
import { Button, Card, Modal, Badge, Input, Select, Textarea, EmptyState } from "../ui"
import { ScreenHeader } from "./common"
import { displayName } from "../lib"

const STATUS_TONE = { available: "ok", on_loan: "navy", retired: "neutral" }
const STATUS_LABEL = { available: "Available", on_loan: "On loan", retired: "Retired" }

export default function Devices({ data, refresh }) {
  const isAdmin = data.isAdmin
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")  // "", available, on_loan, retired, archived
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // device_id -> student currently holding it
  const holderByDevice = useMemo(() => {
    const map = {}
    for (const l of data.loans) {
      if (l.status === "active") {
        const s = data.students.find(st => st.student_id === l.student_id)
        map[l.device_id] = s ? displayName(s) : l.student_id
      }
    }
    return map
  }, [data.loans, data.students])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matchesText = (d) => !q
      || (d.host_name || "").toLowerCase().includes(q)
      || (d.serial_number || "").toLowerCase().includes(q)
      || (d.model || "").toLowerCase().includes(q)
    if (statusFilter === "archived") {
      return data.devices.filter(d => d.archived && matchesText(d))
    }
    return data.devices.filter(d => !d.archived && (!statusFilter || d.status === statusFilter) && matchesText(d))
  }, [data.devices, search, statusFilter])

  const openNew = () => { setEditing(null); setForm({ host_name: "", serial_number: "", model: "", status: "available", notes: "" }); setError(""); setModalOpen(true) }
  const openEdit = (d) => { setEditing(d); setForm({ ...d }); setError(""); setModalOpen(true) }

  const save = async () => {
    setBusy(true); setError("")
    const payload = {
      host_name: form.host_name?.trim() || null,
      serial_number: form.serial_number?.trim() || null,
      model: form.model?.trim() || null,
      status: form.status || "available",
      notes: form.notes?.trim() || null,
    }
    try {
      if (editing) {
        const { error } = await supabase.from("devices").update(payload).eq("id", editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("devices").insert(payload)
        if (error) throw error
      }
      await refresh()
      setModalOpen(false)
    } catch (e) {
      setError(e.message?.includes("duplicate") ? "That serial number already exists." : (e.message || "Save failed"))
    } finally { setBusy(false) }
  }

  const archive = async (d, archived) => {
    setBusy(true); setError("")
    try { await setDeviceArchived(d.id, archived); await refresh(); setModalOpen(false) }
    catch (e) { setError(e.message || "Update failed") }
    finally { setBusy(false) }
  }

  // Permanent delete — admins only (also enforced by the database).
  const deletePermanent = async (d) => {
    if (!confirm(`Permanently delete ${d.host_name || d.serial_number || "this device"}? This cannot be undone.`)) return
    setBusy(true); setError("")
    try {
      const { error } = await supabase.from("devices").delete().eq("id", d.id)
      if (error) throw error
      await refresh(); setModalOpen(false)
    } catch (e) {
      setError("Can't delete — this device has loan history. Archive it instead.")
    } finally { setBusy(false) }
  }

  const counts = useMemo(() => {
    const live = data.devices.filter(d => !d.archived)
    return {
      all: live.length,
      available: live.filter(d => d.status === "available").length,
      on_loan: live.filter(d => d.status === "on_loan").length,
      retired: live.filter(d => d.status === "retired").length,
      archived: data.devices.filter(d => d.archived).length,
    }
  }, [data.devices])

  const tabs = [["", "All"], ["available", "Available"], ["on_loan", "On loan"], ["retired", "Retired"], ["archived", "Archived"]]

  return (
    <div className="space-y-4 animate-fadeIn">
      <ScreenHeader
        eyebrow="Inventory"
        title="Devices"
        subtitle={`${counts.all} laptops · ${counts.available} available · ${counts.on_loan} on loan`}
        action={<Button onClick={openNew}><Plus size={16} /> Add</Button>}
      />

      {/* Filters */}
      <div className="flex gap-2 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search host name, serial, or model"
            className="w-full pl-10 pr-3 py-2.5 bg-white rounded-lg border border-line focus:border-navy-accent focus:ring-2 focus:ring-navy-accent/20 focus:outline-none text-sm"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {tabs.map(([s, label]) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
                statusFilter === s ? "bg-navy text-white border-navy" : "bg-white text-muted border-line hover:border-navy/30"
              }`}
            >
              {label} <span className="tabular-nums opacity-70">{counts[s || "all"]}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={HardDrive} title="No devices" description={statusFilter === "archived" ? "Nothing archived." : "Add a laptop, or import your inventory from CSV."} />
      ) : (
        <div className="space-y-2">
          {filtered.map(d => (
            <Card key={d.id} className="p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-panel flex items-center justify-center shrink-0">
                <Laptop size={16} className={d.archived ? "text-muted" : "text-navy"} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{d.host_name || d.serial_number || "Unnamed device"}</div>
                <div className="text-xs text-muted truncate">
                  {[d.serial_number, d.model].filter(Boolean).join(" · ") || "—"}
                  {!d.archived && d.status === "on_loan" && holderByDevice[d.id] && <span className="text-navy"> · {holderByDevice[d.id]}</span>}
                </div>
              </div>
              {d.archived
                ? <Badge tone="neutral">Archived</Badge>
                : <Badge tone={STATUS_TONE[d.status]}>{STATUS_LABEL[d.status]}</Badge>}
              {d.archived ? (
                <button onClick={() => archive(d, false)} disabled={busy} title="Restore" className="p-1.5 text-muted hover:text-ok"><ArchiveRestore size={16} /></button>
              ) : (
                <button onClick={() => openEdit(d)} className="p-1.5 text-muted hover:text-navy" title="Edit"><Edit3 size={16} /></button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit device" : "Add device"} wide>
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Host name" value={form.host_name || ""} onChange={v => setForm({ ...form, host_name: v })} placeholder="SL-21816" />
            <Input label="Serial number" value={form.serial_number || ""} onChange={v => setForm({ ...form, serial_number: v })} placeholder="PW0KX282" />
          </div>
          <Input label="Model" value={form.model || ""} onChange={v => setForm({ ...form, model: v })} placeholder="Lenovo 13w 2in1 Gen 3" />
          <Select
            label="Status"
            value={form.status || "available"}
            onChange={v => setForm({ ...form, status: v })}
            options={[
              { value: "available", label: "Available" },
              { value: "on_loan", label: "On loan" },
              { value: "retired", label: "Retired" },
            ]}
          />
          <Textarea label="Notes" value={form.notes || ""} onChange={v => setForm({ ...form, notes: v })} />
          {error && <div className="text-sm text-alert">{error}</div>}

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="primary" onClick={save} disabled={busy} className="flex-1">
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}{editing ? "Save" : "Add device"}
            </Button>
          </div>

          {editing && (
            <div className="flex gap-2 pt-2 mt-1 border-t border-line">
              <Button variant="secondary" onClick={() => archive(editing, true)} disabled={busy} className="flex-1">
                <Archive size={15} /> Archive
              </Button>
              {isAdmin && (
                <Button variant="danger" onClick={() => deletePermanent(editing)} disabled={busy} title="Admins only">
                  <Trash2 size={15} /> Delete
                </Button>
              )}
            </div>
          )}
          {editing && (
            <p className="text-[11px] text-muted">Archiving hides the device but keeps its loan history. {isAdmin ? "Permanent delete is available to you as an admin." : "Only admins can permanently delete."}</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
