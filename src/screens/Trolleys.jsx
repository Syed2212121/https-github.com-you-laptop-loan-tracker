import React, { useState, useMemo, useEffect } from "react"
import { Boxes, Plus, X, Loader2, AlertTriangle, Laptop, ChevronRight } from "lucide-react"
import { supabase } from "../supabase"
import { Card, Button, Input, Modal, Badge, EmptyState } from "../ui"
import { ScreenHeader } from "./common"

// ============================================================
// TROLLEYS — the physical carts loan laptops live in.
//
// A cart is a name, a place, and the laptops in it. The count on each row is
// "still in the cart" over "belongs to the cart", so 14/16 reads as two out
// with students. Both halves come from devices.trolley_id (migration 0012);
// nothing is stored twice.
//
// Deliberately independent of devices.cabin. A cabin is one of three staffed
// cupboards and an access boundary; a trolley is a cart on wheels. Five carts
// do not map onto three cupboards.
// ============================================================

// The laptops that belong to one cart. Excludes archived rows — a soft-deleted
// laptop should not pad a cart it is no longer part of.
const stockOf = (devices, trolleyId) =>
  devices.filter(d => d.trolley_id === trolleyId && !d.archived)

// "Still in the cart" is the literal question the row answers, so a retired
// laptop counts as present — it is sitting in the cart, just not lendable.
// Switch to status === "available" if the number should mean "can go out".
const stillIn = (stock) => stock.filter(d => d.status !== "on_loan").length

const statusBadge = (d) =>
  d.status === "on_loan" ? <Badge tone="neutral">On loan</Badge>
    : d.status === "retired" ? <Badge tone="warn">Retired</Badge>
      : <Badge tone="ok">Available</Badge>

// ------------------------------------------------------------
// MODAL — one component in two modes, because the fields overlap.
//   create → name + location
//   edit   → name + location, plus the laptops in the cart
// ------------------------------------------------------------
function TrolleyModal({ open, mode, trolley, devices, canEdit, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", location: "" })
  const [lnb, setLnb] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [note, setNote] = useState("")

  useEffect(() => {
    if (!open) return
    setForm({ name: trolley?.name || "", location: trolley?.location || "" })
    setLnb(""); setError(""); setNote("")
  }, [open, trolley])

  // Read the cart straight from the live devices array rather than snapshotting
  // it, so an add or remove is reflected the moment refresh() lands.
  const stock = useMemo(
    () => (trolley ? stockOf(devices, trolley.id) : []),
    [devices, trolley]
  )

  const save = async () => {
    const name = form.name.trim()
    if (!name) { setError("A trolley needs a name."); return }
    const payload = { name, location: form.location.trim() || null }

    setBusy(true); setError("")
    try {
      const { error: e } = mode === "create"
        ? await supabase.from("trolleys").insert(payload)
        : await supabase.from("trolleys").update(payload).eq("id", trolley.id)
      if (e) throw e
      await onSaved()
      if (mode === "create") onClose()
      else setNote("Saved.")
    } catch (e) {
      setError(e.message?.includes("duplicate") || e.code === "23505"
        ? `There is already a trolley called "${name}".`
        : (e.message || "Save failed"))
    } finally { setBusy(false) }
  }

  // Type an LNB: attach it if we hold it, create it as loan stock if we do not.
  // Same fallback the cabin importer uses — a cart can be built up by hand
  // before the laptops have been imported from anywhere.
  const addLaptop = async () => {
    const key = lnb.trim().toUpperCase()
    if (!key) return

    const existing = devices.find(d => (d.lnb || "").toUpperCase() === key)
    if (existing?.trolley_id === trolley.id) {
      setNote(`${existing.lnb} is already in this trolley.`)
      setLnb(""); return
    }

    setBusy(true); setError(""); setNote("")
    try {
      if (existing) {
        const { error: e } = await supabase.from("devices")
          .update({ trolley_id: trolley.id }).eq("id", existing.id)
        if (e) throw e
        // A laptop lives in one cart at a time, so this is a move. Say so
        // rather than let it look like a silent duplicate.
        setNote(existing.trolley_id
          ? `${existing.lnb} moved here from another trolley.`
          : `${existing.lnb} added.`)
      } else {
        const { error: e } = await supabase.from("devices")
          .insert({ lnb: key, trolley_id: trolley.id, status: "available" })
        if (e) throw e
        setNote(`${key} did not exist — created as available loan stock.`)
      }
      setLnb("")
      await onSaved()
    } catch (e) {
      setError(e.message?.includes("duplicate") || e.code === "23505"
        ? `${key} already exists on another device row.`
        : (e.message || "Could not add that laptop"))
    } finally { setBusy(false) }
  }

  // Frees the laptop rather than deleting it. Also the only way back from a
  // typo, since an unknown LNB is created rather than rejected.
  const removeLaptop = async (d) => {
    setBusy(true); setError(""); setNote("")
    try {
      const { error: e } = await supabase.from("devices")
        .update({ trolley_id: null }).eq("id", d.id)
      if (e) throw e
      setNote(`${d.lnb} taken out of this trolley. The laptop itself is untouched.`)
      await onSaved()
    } catch (e) {
      setError(e.message || "Could not remove that laptop")
    } finally { setBusy(false) }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "create" ? "Add a trolley" : (trolley?.name || "Trolley")}
      wide={mode === "edit"}
    >
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            label="Name"
            value={form.name}
            onChange={v => setForm({ ...form, name: v })}
            placeholder="Trolley A"
            autoFocus={mode === "create"}
          />
          <Input
            label="Location"
            value={form.location}
            onChange={v => setForm({ ...form, location: v })}
            placeholder="Lab 2"
          />
        </div>

        {/* Close is always offered. Only Save is gated — a read-only viewer
            still needs a way out that is not the X or the backdrop. */}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {mode === "create" ? "Cancel" : "Close"}
          </Button>
          {canEdit && (
            <Button variant="primary" onClick={save} disabled={busy} className="flex-1">
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}Save
            </Button>
          )}
        </div>

        {mode === "edit" && (
          <div className="pt-2 border-t border-line space-y-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted">Laptops in this trolley</span>
              <span className="text-xs text-muted tabular-nums">
                {stillIn(stock)}<span className="text-muted/60">/{stock.length}</span> still in
              </span>
            </div>

            {stock.length === 0 ? (
              <p className="text-sm text-muted py-1">Nothing in this trolley yet.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto -mx-1 px-1">
                {stock.map(d => (
                  <div key={d.id} className="flex items-center gap-3 py-2 border-b border-line last:border-0">
                    <Laptop size={15} className="text-navy shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-ink tabular-nums">{d.lnb}</div>
                      {d.model && <div className="text-xs text-muted truncate">{d.model}</div>}
                    </div>
                    {statusBadge(d)}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => removeLaptop(d)}
                        disabled={busy}
                        title={`Take ${d.lnb} out of this trolley`}
                        className="p-1 -mr-1 text-muted hover:text-alert disabled:opacity-40"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {canEdit && (
              <>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input
                      label="Add a laptop by LNB"
                      value={lnb}
                      onChange={setLnb}
                      placeholder="LNB-B01"
                    />
                  </div>
                  <Button variant="accent" onClick={addLaptop} disabled={busy || !lnb.trim()}>
                    {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}Add
                  </Button>
                </div>
                <p className="text-[11px] text-muted">
                  An LNB we do not already hold is created as available loan stock. A laptop
                  already in another trolley is moved here — it can only be in one cart at a time.
                </p>
              </>
            )}
          </div>
        )}

        {note && <div className="text-sm text-ok">{note}</div>}
        {error && <div className="text-sm text-alert">{error}</div>}
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------

export default function Trolleys({ data, refresh }) {
  const [editing, setEditing] = useState(null)   // trolley row being opened
  const [creating, setCreating] = useState(false)

  // Cabin custodians read the carts but cannot change them — RLS rejects their
  // writes to both trolleys (0012) and devices (0008), so the UI never offers
  // one. They still get the stock view, which is the useful half.
  const canEdit = !data.cabin

  const trolleys = data.trolleys || []

  const rows = useMemo(() => trolleys.map(t => {
    const stock = stockOf(data.devices, t.id)
    return { trolley: t, present: stillIn(stock), total: stock.length }
  }), [trolleys, data.devices])

  // Keep the open modal pointed at the live row, so a rename shows in its own
  // title after saving rather than going stale until reopened.
  const openTrolley = editing ? trolleys.find(t => t.id === editing.id) || editing : null

  return (
    <div className="space-y-5 animate-fadeIn">
      <ScreenHeader eyebrow="IT Service Desk" title="Trolleys" />

      {trolleys.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No trolleys yet"
          description="A trolley is one of the carts loan laptops live in. Add one, give it a location, then put laptops in it."
          action={canEdit && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> Add a trolley
            </Button>
          )}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="px-5 py-2.5 border-b border-line bg-panel/60 flex items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted">Trolleys</span>
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} /> Add
              </Button>
            )}
          </div>

          {rows.map(({ trolley, present, total }) => (
            <button
              key={trolley.id}
              type="button"
              onClick={() => setEditing(trolley)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-panel border-b border-line last:border-0"
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink truncate">{trolley.name}</div>
                <div className="text-xs text-muted truncate">
                  Location: {trolley.location || "—"}
                </div>
              </div>
              <span className="text-sm text-ink tabular-nums shrink-0">
                {present}<span className="text-muted">/{total}</span>
              </span>
              <ChevronRight size={16} className="text-muted shrink-0" />
            </button>
          ))}
        </Card>
      )}

      {trolleys.length > 0 && (
        <p className="text-[11px] text-muted">
          The count is how many laptops are still in the cart over how many belong to it —
          <span className="text-ink"> 14/16</span> means two are out with students.
        </p>
      )}

      <TrolleyModal
        open={creating}
        mode="create"
        trolley={null}
        devices={data.devices}
        canEdit={canEdit}
        onClose={() => setCreating(false)}
        onSaved={refresh}
      />
      <TrolleyModal
        open={!!editing}
        mode="edit"
        trolley={openTrolley}
        devices={data.devices}
        canEdit={canEdit}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  )
}
