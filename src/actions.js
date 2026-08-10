import { supabase } from "./supabase"
import { addDays, LOAN_DAYS } from "./lib"

// Issue a laptop: create an active loan + mark the device on_loan.
// The DB partial unique indexes also guard against a double-issue race.
// `userId` is the logged-in account; `handedOverBy` is the named cabin
// custodian who physically passed the laptop over.
export async function issueLoan({ studentId, deviceId, userId, handedOverBy, notes }) {
  const issued_at = new Date().toISOString()
  const due_at = addDays(new Date(), LOAN_DAYS).toISOString()
  const { data: loan, error } = await supabase
    .from("loans")
    .insert({
      student_id: studentId,
      device_id: deviceId,
      issued_by: userId || null,
      handed_over_by: handedOverBy || null,
      issued_at,
      due_at,
      status: "active",
      notes: notes || null,
    })
    .select()
    .single()
  if (error) throw error
  const { error: e2 } = await supabase.from("devices").update({ status: "on_loan" }).eq("id", deviceId)
  if (e2) throw e2
  return loan
}

// Return a laptop: close the loan + free the device. Records who did it.
export async function returnLoan(loan, userId) {
  const { data: updated, error } = await supabase
    .from("loans")
    .update({ status: "returned", returned_at: new Date().toISOString(), returned_by: userId || null })
    .eq("id", loan.id)
    .select()
    .single()
  if (error) throw error
  const { error: e2 } = await supabase.from("devices").update({ status: "available" }).eq("id", loan.device_id)
  if (e2) throw e2
  return updated
}

// Renew: extend the due date by another 10-day provision period. Records who did it.
export async function renewLoan(loan, userId) {
  const due_at = addDays(new Date(), LOAN_DAYS).toISOString()
  const { data: updated, error } = await supabase
    .from("loans")
    .update({ due_at, renewed_count: (loan.renewed_count || 0) + 1, reminder_sent_at: null, renewed_by: userId || null })
    .eq("id", loan.id)
    .select()
    .single()
  if (error) throw error
  return updated
}

// Archive a device (reversible soft-delete) — keeps loan history intact.
export async function setDeviceArchived(deviceId, archived) {
  const { error } = await supabase.from("devices").update({ archived }).eq("id", deviceId)
  if (error) throw error
}
