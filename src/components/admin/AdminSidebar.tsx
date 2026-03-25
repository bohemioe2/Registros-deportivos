"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Users, Settings, LogOut, FileText, Target } from "lucide-react";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";

const navItems = [
  { name: "Dashboard", href: "/admin", icon: Activity },
  { name: "Registros", href: "/admin/registrations", icon: Users },
  { name: "Audit. Mesa (Scan)", href: "/admin/scanner", icon: Target },
  { name: "Eventos", href: "/admin/events", icon: Settings },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] bg-[#171821] border-r border-[#ffffff0a] flex flex-col justify-between text-gray-400 shrink-0">
      <div>
        <div className="flex h-[80px] items-center px-6">
          <span className="text-[15px] font-black tracking-[0.15em] text-white uppercase flex items-center gap-2.5">
            <div className="w-4 h-4 bg-[#4b55f5] rounded-sm shadow-[0_0_15px_rgba(75,85,245,0.6)]"></div>
            DASHBOARD
          </span>
        </div>
        <div className="px-6 mt-1 mb-3">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Principal</span>
        </div>
        <nav className="px-5 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.name !== "Dashboard" && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all relative ${
                  isActive 
                  ? "bg-[#25283d] text-[#00d2ff] shadow-sm font-bold" 
                  : "text-gray-400 hover:text-white hover:bg-[#1c1d29] font-medium"
                }`}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-[#00d2ff] rounded-r-md shadow-[0_0_12px_rgba(0,210,255,0.8)]"></div>}
                <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-[#00d2ff]' : 'opacity-70'}`} />
                <span className="text-[13px] tracking-wide relative z-10">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-6">
        <button 
          onClick={() => signOut(auth)}
          className="flex w-full items-center gap-3 px-4 py-3 text-[13px] font-bold tracking-wide text-gray-500 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-[18px] h-[18px]" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
