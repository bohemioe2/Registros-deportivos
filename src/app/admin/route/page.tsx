"use client";

import { useEffect, useState } from "react";
import { Search, MapPin, Phone, AlertCircle, HeartPulse, Activity, UserCheck, Flag, Users } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/components/admin/AuthProvider";

export default function RouteMonitoringPage() {
  const { user, role, assignedEventId } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("ALL");
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const isSuperAdmin = role === "SUPERADMIN";

  // 1. Fetch Events
  useEffect(() => {
    if (!role) return;
    const unsub = onSnapshot(collection(db, "events"), (snapshot) => {
      let evs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (role === "ORGANIZER" && assignedEventId) {
        evs = evs.filter(e => e.id === assignedEventId);
      }
      setEvents(evs);
      if (role === "ORGANIZER" && assignedEventId && selectedEventId === "ALL") {
         setSelectedEventId(assignedEventId);
      }
    });
    return () => unsub();
  }, [role, assignedEventId, selectedEventId]);

  // 2. Fetch Registrations for the selected event
  useEffect(() => {
    if (!role) return;
    let q;
    const baseColl = collection(db, "registrations");

    if (isSuperAdmin && selectedEventId === "ALL") {
       q = baseColl;
    } else {
       const targetEventId = isSuperAdmin ? selectedEventId : assignedEventId;
       if (!targetEventId || targetEventId === "ALL") {
           setRegistrations([]);
           return;
       }
       q = query(baseColl, where("eventId", "==", targetEventId));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const regs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.status === "APPROVED");
      setRegistrations(regs);
    });

    return () => unsub();
  }, [selectedEventId, role, assignedEventId, isSuperAdmin]);

  // Derived Stats
  const totalInscritos = registrations.length;
  const totalAsistieron = registrations.filter(r => r.checkedInAt).length;
  const totalLlegaron = registrations.filter(r => r.finishedAt || r.medalDeliveredAt).length;
  const enRuta = registrations.filter(r => r.checkedInAt && !r.finishedAt && !r.medalDeliveredAt);
  
  // Filter search
  const filteredEnRuta = enRuta.filter(r => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
    const folioStr = (r.folio || "").toLowerCase();
    return fullName.includes(search) || folioStr.includes(search);
  });

  return (
    <div className="p-4 lg:p-8 flex flex-col h-full overflow-y-auto custom-scrollbar space-y-6 bg-[#1b1c27]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-[#ff5f6d] uppercase mb-1 flex items-center gap-2">
             <MapPin className="w-3 h-3" /> Monitoreo en Vivo
          </h2>
          <h1 className="text-2xl font-light text-white tracking-tight">Radar de <span className="font-bold text-[#ff5f6d]">Ruta</span></h1>
          <p className="text-gray-400 text-xs sm:text-sm font-medium mt-1 tracking-widest uppercase">Visualiza quién sigue en competencia</p>
        </div>
        
        <div className="w-full sm:w-auto">
          <select 
            value={selectedEventId} 
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full sm:w-[260px] bg-[#242636] border border-[#ffffff1a] text-white rounded-xl text-xs px-4 py-3 focus:outline-none focus:border-[#ff5f6d] font-semibold tracking-wide shadow-xl appearance-none cursor-pointer hover:bg-[#2a2d3d] transition-colors"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.8rem center' }}
          >
            {isSuperAdmin && <option value="ALL">Vista Global: TODOS</option>}
            {!isSuperAdmin && <option value="ALL" disabled>ELIGE UN EVENTO 👇</option>}
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#242636]/60 border border-[#ffffff0a] p-5 rounded-2xl flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
              <span className="text-[9px] uppercase font-bold tracking-widest text-gray-500">Inscritos</span>
              <Users className="w-4 h-4 text-gray-500" />
           </div>
           <p className="text-3xl font-mono text-white font-light">{totalInscritos}</p>
        </div>
        <div className="bg-[#00d2ff]/10 border border-[#00d2ff]/20 p-5 rounded-2xl flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
              <span className="text-[9px] uppercase font-bold tracking-widest text-[#00d2ff]">Asistieron (Check-in)</span>
              <UserCheck className="w-4 h-4 text-[#00d2ff]" />
           </div>
           <p className="text-3xl font-mono text-[#00d2ff] font-bold">{totalAsistieron}</p>
        </div>
        <div className="bg-[#4b55f5]/10 border border-[#4b55f5]/20 p-5 rounded-2xl flex flex-col justify-between">
           <div className="flex justify-between items-start mb-2">
              <span className="text-[9px] uppercase font-bold tracking-widest text-[#4b55f5]">Finalizaron (Meta)</span>
              <Flag className="w-4 h-4 text-[#4b55f5]" />
           </div>
           <p className="text-3xl font-mono text-[#4b55f5] font-bold">{totalLlegaron}</p>
        </div>
        <div className="bg-[#ff5f6d]/10 border border-[#ff5f6d]/30 p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden shadow-[0_0_15px_rgba(255,95,109,0.1)]">
           <div className="absolute top-0 right-0 w-16 h-16 bg-[#ff5f6d]/20 blur-xl rounded-full"></div>
           <div className="flex justify-between items-start mb-2 relative z-10">
              <span className="text-[10px] uppercase font-black tracking-widest text-[#ff5f6d]">AÚN EN RUTA</span>
              <Activity className="w-4 h-4 text-[#ff5f6d] animate-pulse" />
           </div>
           <p className="text-4xl font-mono text-[#ff5f6d] font-black relative z-10">{enRuta.length}</p>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#242636]/60 rounded-3xl border border-[#ffffff0a] shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-md overflow-hidden flex flex-col flex-1">
        
        {/* Search Bar */}
        <div className="p-6 border-b border-[#ffffff0a] flex items-center justify-between bg-[#1c1d29]/50">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-3 h-[18px] w-[18px] text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar corredor extraviado por folio o nombre..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 text-sm bg-[#171821] border border-[#ffffff10] text-gray-200 rounded-xl focus:outline-none focus:border-[#ff5f6d] focus:ring-1 focus:ring-[#ff5f6d] transition-all placeholder:text-gray-600" 
            />
          </div>
        </div>
        
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[#171821] text-gray-500 font-bold text-[9px] uppercase tracking-widest border-b border-[#ffffff0a] sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4">Folio / Participante</th>
                <th className="px-6 py-4">Hora de Salida (Check-in)</th>
                <th className="px-6 py-4">Datos Médicos</th>
                <th className="px-6 py-4 text-right">Contacto de Emergencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ffffff0a]">
              {filteredEnRuta.map((reg) => {
                const startTime = new Date(reg.checkedInAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
                return (
                <tr key={reg.id} className="hover:bg-[#ff5f6d]/5 transition-colors group">
                  <td className="px-6 py-4">
                     <span className="font-mono text-[12px] font-bold text-[#00d2ff] block mb-1">{reg.folio}</span>
                     <span className="font-bold text-gray-200 group-hover:text-white transition-colors text-[13px]">{reg.firstName} {reg.lastName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-gray-300 text-[11px] uppercase tracking-widest font-mono bg-[#171821] px-3 py-1.5 rounded-lg border border-[#ffffff05] flex inline-flex items-center gap-2">
                       <MapPin className="w-3 h-3 text-green-400" /> {startTime}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <span className="bg-[#171821] border border-[#ff5f6d]/30 text-[#ff5f6d] font-mono font-bold text-lg px-3 py-1 rounded-lg">
                          {reg.bloodType || "N/A"}
                       </span>
                       <div className="text-[9px] text-gray-500 uppercase font-bold">
                          Edad: <span className="text-gray-300">{reg.age}</span><br/>
                          Sexo: <span className="text-gray-300">{reg.gender === "MALE" ? "H" : "M"}</span>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                     <div className="flex flex-col items-end gap-2">
                       <a href={`tel:${reg.phone1}`} className="flex items-center justify-end gap-2 text-gray-300 hover:text-white bg-[#171821] hover:bg-[#25283d] px-3 py-1.5 rounded border border-[#ffffff10] transition-colors group/btn">
                         <Phone className="w-3 h-3 text-gray-500 group-hover/btn:text-white" />
                         <span className="font-mono tracking-widest text-[11px] font-bold">{reg.phone1 || "Sin teléfono"}</span>
                       </a>
                       {reg.phone2 && (
                         <a href={`tel:${reg.phone2}`} className="flex items-center justify-end gap-2 text-gray-500 hover:text-white bg-[#171821] hover:bg-[#25283d] px-3 py-1.5 rounded border border-[#ffffff10] transition-colors group/btn">
                           <AlertCircle className="w-3 h-3 text-gray-600 group-hover/btn:text-yellow-500" />
                           <span className="font-mono tracking-widest text-[10px] font-bold">{reg.phone2} (Auxiliar)</span>
                         </a>
                       )}
                     </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          {filteredEnRuta.length === 0 && (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#1c1d29] border border-[#ffffff0a] flex items-center justify-center mb-6 relative overflow-hidden">
                 <div className="absolute inset-0 bg-green-500/10 rounded-full animate-ping"></div>
                 <CheckCircle2 className="w-8 h-8 text-green-500 relative z-10" />
              </div>
              <h3 className="text-xl font-light text-white mb-2">¡Ruta Despejada!</h3>
              <p className="text-gray-400 font-medium text-sm max-w-md mx-auto">
                No hay ningún participante registrado en la ruta actualmente. Ya llegaron todos a la meta o no ha comenzado el evento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
