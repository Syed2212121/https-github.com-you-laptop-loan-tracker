import React from "react"

// Fixed bottom navigation for mobile. Hidden on desktop (md+).
// items: [{ key, label, icon: Icon, badge? }]
export default function BottomNav({ items, tab, setTab }) {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-line pb-safe">
      <div className="grid grid-cols-4">
        {items.map(({ key, label, icon: Icon, badge }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors ${
                active ? "text-navy" : "text-muted"
              }`}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-alert text-white text-[10px] font-bold flex items-center justify-center">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </span>
              <span className={`text-[10px] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
              {active && <span className="absolute top-0 inset-x-6 h-0.5 bg-navy rounded-full" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
