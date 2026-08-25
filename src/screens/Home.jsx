import React from "react"
import { GraduationCap, Layers, Users, ClipboardList, Upload, Network, ChevronRight } from "lucide-react"

function ActionCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-line bg-white p-5 flex items-center gap-4 transition-all active:scale-[0.99] hover:border-navy/30"
    >
      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-panel">
        <Icon size={24} className="text-navy" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-serif text-lg text-navy">{title}</div>
        <div className="text-xs mt-0.5 text-muted">{desc}</div>
      </div>
      <ChevronRight size={18} className="text-muted" />
    </button>
  )
}

export default function Home({ data, setTab }) {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div>
        <h1 className="font-serif text-3xl sm:text-4xl text-navy leading-tight uppercase tracking-wide">IT Service Desk</h1>
      </div>

      <div className="space-y-3">
        <ActionCard icon={GraduationCap} title="Student Devices" desc="Look up a student and their assigned device" onClick={() => setTab("studentDevices")} />
        {/* Hidden for cabin custodians for the same reason App.jsx hides the
            tab: RLS leaves them nothing to see there. */}
        {!data.cabin && (
          <ActionCard icon={Layers} title="Device Class Details" desc="List a whole class with their laptops and enrolment" onClick={() => setTab("deviceClass")} />
        )}
        <ActionCard icon={Users} title="Staff Devices" desc="Staff device register" onClick={() => setTab("staffDevices")} />
        <ActionCard icon={ClipboardList} title="Loan Portal" desc="Issue, return and view a student's loan history" onClick={() => setTab("loanPortal")} />
        <ActionCard icon={Upload} title="Import" desc="Load students & devices from CSV" onClick={() => setTab("import")} />
        <ActionCard icon={Network} title="Project Structure" desc="Tables, fields and how a loan moves" onClick={() => setTab("structure")} />
      </div>
    </div>
  )
}
