"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Users, Settings, LogOut, Target, Tag, Shirt, Briefcase, KeyRound, Award, Menu, X, MapPin, Zap, Timer } from "lucide-react";
import { auth } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { useAuth } from "@/components/admin/AuthProvider";
import { useState } from "react";

const navItems = [
  { name: "Dashboard", href: "/admin", icon: Activity, roles: ["SUPERADMIN", "ORGANIZER"] },
  { name: "Eventos", href: "/admin/events", icon: Settings, roles: ["SUPERADMIN", "ORGANIZER"] },
  { name: "Registros", href: "/admin/registrations", icon: Users, roles: ["SUPERADMIN", "ORGANIZER"] },
  { name: "Audit. Mesa (Scan)", href: "/admin/scanner", icon: Target, roles: ["SUPERADMIN", "ORGANIZER", "STAFF"] },
  { name: "Monitoreo Ruta", href: "/admin/route", icon: MapPin, roles: ["SUPERADMIN", "ORGANIZER"] },
  { name: "Meta / Medallas", href: "/admin/medals", icon: Award, roles: ["SUPERADMIN", "ORGANIZER", "STAFF"] },
  { name: "Ranking Tiempos", href: "/admin/ranking", icon: Timer, roles: ["SUPERADMIN", "ORGANIZER", "STAFF"] },
  { name: "Dorsales", href: "/admin/bibs", icon: Tag, roles: ["SUPERADMIN", "ORGANIZER"] },
  { name: "Kits / Textiles", href: "/admin/kits", icon: Shirt, roles: ["SUPERADMIN", "ORGANIZER"] },
  { name: "Organizadores", href: "/admin/organizers", icon: Briefcase, roles: ["SUPERADMIN"] },
  { name: "Códigos Staff", href: "/admin/staff", icon: KeyRound, roles: ["SUPERADMIN", "ORGANIZER"] },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { role, assignedEventId } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const dynamicNavItems = [...navItems];
  if (assignedEventId) {
    dynamicNavItems.push({ name: "Registro Express", href: `/register/${assignedEventId}/express`, icon: Zap, roles: ["SUPERADMIN", "ORGANIZER", "STAFF"] });
  }

  // Si no hay rol todavía (cargando) o no tiene permisos, mostramos sidebar vacío o limitado
  const visibleItems = dynamicNavItems.filter(item => role && item.roles.includes(role));

  return (
    <>
      {/* Botón Hamburguesa para Móviles */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="md:hidden print:hidden fixed top-4 right-4 z-[60] bg-[#242636] p-3 rounded-xl border border-[#ffffff10] shadow-xl text-white"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay Oscuro para Móviles */}
      {isOpen && (
        <div 
          className="md:hidden print:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[40]" 
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Principal */}
      <aside className={`fixed inset-y-0 left-0 z-[50] w-[220px] bg-[#171821] border-r border-[#ffffff0a] flex flex-col justify-between text-gray-400 shrink-0 transform transition-transform duration-300 ${isOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0 print:hidden`}>
        <div>
          <div className="flex h-[80px] items-center px-6">
            <span className="text-[15px] font-black tracking-[0.15em] text-white uppercase flex items-center gap-2.5">
              <div className="w-4 h-4 bg-[#4b55f5] rounded-sm shadow-[0_0_15px_rgba(75,85,245,0.6)]"></div>
              DASHBOARD
            </span>
          </div>
          <div className="px-6 mt-1 mb-3">
            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
              {role === "SUPERADMIN" ? "Administrador" : role === "ORGANIZER" ? "Organizador" : "Staff"}
            </span>
          </div>
          <nav className="px-5 space-y-2 overflow-y-auto custom-scrollbar max-h-[calc(100vh-160px)]">
            {visibleItems.map((item) => {
              const isActive = pathname === item.href || (item.name !== "Dashboard" && pathname.startsWith(item.href + '/'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
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
        <div className="p-6 shrink-0 bg-[#171821]">
          <button 
            onClick={() => signOut(auth)}
            className="flex w-full items-center gap-3 px-4 py-3 text-[13px] font-bold tracking-wide text-gray-500 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
