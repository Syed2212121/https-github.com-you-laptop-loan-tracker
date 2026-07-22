import React, { useState } from "react"
import { Lock, AlertCircle, Loader2 } from "lucide-react"
import { supabase } from "./supabase"
import { Button, Input, Card } from "./ui"

export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setErr("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-panel flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center overflow-hidden rounded-xl bg-white border border-line">
            <img src="/logo.jpg" alt="Al-Taqwa College" className="w-full h-full object-contain" />
          </div>
          <h1 className="font-serif text-2xl text-navy">Al-Taqwa College</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-navy-accent mt-1">Laptop Loan Tracker</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@altaqwa.vic.edu.au" />
            <Input label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
            {err && (
              <div className="text-xs text-alert flex items-start gap-1.5">
                <AlertCircle size={14} className="shrink-0 mt-0.5" /><span>{err}</span>
              </div>
            )}
            <Button type="submit" variant="primary" disabled={loading} className="w-full">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 pt-4 border-t border-line text-xs text-muted text-center">
            Accounts are created by the admin. Contact IT if you need access.
          </p>
        </Card>
      </div>
    </div>
  )
}
