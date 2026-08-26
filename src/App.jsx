import React, { useState, useEffect, useCallback, useMemo } from "react"
import { GraduationCap, Layers, Users, ClipboardList, Boxes, Upload, Network, LogOut, Loader2 } from "lucide-react"
import { supabase, fetchAll } from "./supabase"
import LoginScreen from "./LoginScreen"
import BottomNav from "./BottomNav"
import { loanState, cabinByKey } from "./lib"
import Home from "./screens/Home"
import StudentDevices from "./screens/StudentDevices"
import DeviceClassDetails from "./screens/DeviceClassDetails"
import Trolleys from "./screens/Trolleys"
import StaffDevices from "./screens/StaffDevices"
import LoanPortal from "./screens/LoanPortal"
import Import from "./screens/Import"
import ProjectStructure from "./screens/ProjectStructure"

// ============================================================
// DATA LAYER — loads students / devices / loans, optimistic patches
// ============================================================
function useAppData(session) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({ students: [], devices: [], loans: [], trolleys: [], isAdmin: false, cabin: null })

  const load = useCallback(async () => {
    if (!session) return
    // staff table may not exist until migration 0002 is run — the query just
    // returns an error we ignore, so the app keeps working (everyone non-admin).
    // students and devices are paged — both are well past PostgREST's 1000-row
    // response cap since the SIMS import, and it truncates without saying so.
    const [students, devices, loans, trolleys, staff] = await Promise.all([
      fetchAll(q => q.select("*").order("student_id"), "students"),
      fetchAll(q => q.select("*").order("host_name"), "devices"),
      supabase.from("loans").select("*").order("issued_at", { ascending: false }),
      // Five rows, not five thousand — nowhere near the paging cap, so this is
      // a plain select like loans and staff rather than a fetchAll.
      supabase.from("trolleys").select("*").order("name"),
      supabase.from("staff").select("*"),
    ])
    const me = (staff.data || []).find(s => s.id === session.user.id)
    setData({
      students: students.data || [],
      devices: devices.data || [],
      trolleys: trolleys.data || [],
      loans: loans.data || [],
      isAdmin: me?.is_admin || false,
      // Cabin custodians are scoped to one cupboard: read-only inventory, and
      // they may only lend the laptops in their own cabin. Null = full staff.
      cabin: me?.cabin || null,
    })
    setLoading(false)
  }, [session])

  useEffect(() => { load() }, [load])

  const patchLocal = useCallback((key, updater) => {
    setData(prev => ({ ...prev, [key]: typeof updater === "function" ? updater(prev[key]) : updater }))
  }, [])

  return { data, loading, refresh: load, patchLocal }
}

// ============================================================
// APP SHELL
// ============================================================
export default function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [tab, setTab] = useState("home")

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const app = useAppData(session)

  const overdueCount = useMemo(
    () => app.data.loans.filter(l => l.status === "active" && loanState(l).state === "overdue").length,
    [app.data.loans]
  )

  if (!authReady) {
    return <div className="min-h-screen bg-panel flex items-center justify-center"><Loader2 className="animate-spin text-navy" /></div>
  }
  if (!session) return <LoginScreen />

  // Cabin custodians have read-only inventory, so the importers would only
  // fail against RLS. Hide them rather than offer a button that errors.
  const myCabin = cabinByKey(app.data.cabin)

  const navItems = [
    { key: "studentDevices", label: "Students", icon: GraduationCap },
    // Device Class Details reads the student SL fleet and both export mirrors,
    // all of which RLS keeps away from cabin custodians (0008, 0009) — for them
    // the screen could only ever render an empty table.
    ...(myCabin ? [] : [{ key: "deviceClass", label: "Classes", icon: Layers }]),
    { key: "staffDevices", label: "Staff", icon: Users },
    { key: "loanPortal", label: "Loan", icon: ClipboardList },
    // Not guarded on myCabin, unlike Classes: a custodian can read every LNB
    // laptop already, so the carts are a genuine read-only stock view for them.
    { key: "trolleys", label: "Trolley", icon: Boxes },
  ]
  // Import and Structure are setup/reference screens — desktop header only,
  // so the mobile bottom bar stays on the daily tasks.
  const topNav = [
    ...navItems,
    ...(myCabin ? [] : [{ key: "import", label: "Import", icon: Upload }]),
    { key: "structure", label: "Structure", icon: Network },
  ]

  const signOut = () => supabase.auth.signOut()

  const screenProps = { data: app.data, refresh: app.refresh, patchLocal: app.patchLocal, session, setTab, overdueCount }

  return (
    <div className="min-h-screen bg-panel text-ink">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-navy text-white">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => setTab("home")} className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="" className="h-9 w-auto rounded-md object-contain bg-white px-1.5 py-1" />
            <div className="text-left leading-tight">
              <div className="font-serif text-[15px]">Al-Taqwa College</div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-white/60">Laptop Loans</div>
            </div>
          </button>

          {/* Desktop tabs */}
          <nav className="hidden md:flex items-center gap-1">
            {topNav.map(({ key, label, icon: Icon, badge }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`relative px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
                  tab === key ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon size={15} />{label}
                {badge > 0 && <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-alert text-white text-[10px] font-bold flex items-center justify-center">{badge}</span>}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Which cupboard this account looks after — the one thing that
                explains why the laptop list is shorter than they expect. */}
            {myCabin && (
              <span className="hidden sm:inline text-[10px] uppercase tracking-[0.15em] text-white/70 border border-white/25 rounded-full px-2.5 py-1">
                {myCabin.label}
              </span>
            )}
            <button onClick={signOut} className="text-white/70 hover:text-white p-2 -mr-2" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-5 pb-24 md:pb-8">
        {app.loading ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-navy" /></div>
        ) : (
          <>
            {tab === "home" && <Home {...screenProps} />}
            {tab === "studentDevices" && <StudentDevices {...screenProps} />}
            {tab === "deviceClass" && !myCabin && <DeviceClassDetails {...screenProps} />}
            {tab === "staffDevices" && <StaffDevices {...screenProps} />}
            {tab === "loanPortal" && <LoanPortal {...screenProps} />}
            {tab === "trolleys" && <Trolleys {...screenProps} />}
            {tab === "import" && !myCabin && <Import {...screenProps} />}
            {tab === "structure" && <ProjectStructure {...screenProps} />}
          </>
        )}
      </main>

      <BottomNav items={navItems} tab={tab} setTab={setTab} />
    </div>
  )
}
