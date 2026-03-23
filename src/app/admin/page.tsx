"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { useAuth } from "@/components/admin/AuthProvider";
import { Clock, Activity as ActivityIcon } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    total: 0,
    daily: [] as { name: string; count: number }[],
    munis: [] as { name: string; count: number; fullState: string; muni: string }[],
  });
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const isSuperAdmin = user?.email === "eder.beltran.acosta@gmail.com";

  // 1. Obtener Eventos para el selector
  useEffect(() => {
    if (!user) return;
    let q;
    if (isSuperAdmin) {
      q = collection(db, "events");
    } else {
      q = query(collection(db, "events"), where("organizerEmail", "==", user.email));
    }
    const unsub = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, isSuperAdmin]);

  // 2. Obtener Estadísticas Filtradas
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    let q;
    
    // Construir consulta base
    const baseColl = collection(db, "registrations");
    
    if (selectedEventId === "ALL") {
      // Como SuperAdmin ve todo, como organizador solo sus eventos (filtrado en cliente para simplicidad de dashboards dinamicos)
      q = query(baseColl, orderBy("createdAt", "asc"));
    } else {
      q = query(baseColl, where("eventId", "==", selectedEventId), orderBy("createdAt", "asc"));
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const allDocs: any[] = [];
      const daysCount: Record<string, number> = {};
      const munisCount: Record<string, number> = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // SEGURIDAD: Si no es SuperAdmin, filtrar por pertenencia a sus eventos
        if (!isSuperAdmin) {
          const belongsToOwnEvent = events.some(e => e.id === data.eventId);
          if (!belongsToOwnEvent) return;
        }

        allDocs.push({ id: doc.id, ...data });
        
        if (data.createdAt) {
           const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
           const day = date.toLocaleDateString("es-MX", { day: '2-digit', month: 'short' });
           daysCount[day] = (daysCount[day] || 0) + 1;
        }

        if (data.muni) {
           const stateFull = data.state || 'Dato Antiguo';
           const stateAbbr = data.state ? data.state.substring(0, 3).toUpperCase() : '';
           const muniDisplay = `${data.muni} ${stateAbbr ? `(${stateAbbr})` : ''}`;
           const shortenedName = muniDisplay.length > 25 ? muniDisplay.substring(0, 25) + '...' : muniDisplay;
           
           if (!munisCount[shortenedName]) {
              munisCount[shortenedName] = { count: 1, name: shortenedName, fullState: stateFull, muni: data.muni } as any;
           } else {
              (munisCount[shortenedName] as any).count++;
           }
        }
      });

      const dailyArr = Object.keys(daysCount).map(k => ({ name: k, count: daysCount[k] }));
      const munisArr = (Object.values(munisCount) as any[])
        .sort((a,b) => b.count - a.count)
        .slice(0, 6);

      setStats({
        total: allDocs.length,
        daily: dailyArr,
        munis: munisArr,
      });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, selectedEventId, events, isSuperAdmin]);

  return (
    <div className="flex h-full w-full bg-[#1b1c27] text-white">
      {/* Left Main Content */}
      <div className="flex-1 p-10 lg:pl-12 flex flex-col overflow-y-auto custom-scrollbar">
        {/* Custom Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8 mb-10">
          <div className="flex-1">
            <h2 className="text-[11px] font-black tracking-[0.3em] text-[#4b55f5] uppercase mb-2">Monitor Estratégico</h2>
            <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">
               Kardex <span className="text-[#00d2ff]">Central</span>
            </h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
             <select 
               value={selectedEventId} 
               onChange={(e) => setSelectedEventId(e.target.value)}
               className="w-full sm:w-[320px] bg-[#171821] border border-[#ffffff10] text-gray-200 rounded-2xl text-[11px] px-6 py-4 font-black uppercase tracking-widest focus:border-[#4b55f5] transition-all cursor-pointer hover:bg-white/5 appearance-none"
               style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234b55f5' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center' }}
             >
                {isSuperAdmin && <option value="ALL">Vista Global: TODOS LOS EVENTOS 🌍</option>}
                {!isSuperAdmin && <option value="ALL" disabled>SELECCIONAR EVENTO 👇</option>}
                {events.map((ev) => (
                   <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
             </select>

             <Link href="/admin/events" className="w-full sm:w-auto bg-gradient-to-r from-[#4b55f5] to-[#884af0] text-white text-[10px] font-black px-8 py-4 rounded-2xl shadow-[0_0_20px_rgba(75,85,245,0.4)] transition-all uppercase tracking-widest text-center hover:scale-105 active:scale-95">
               Eventos
             </Link>
          </div>
        </div>

        {/* 1. Total Enrolled */}
        <div className="bg-gradient-to-br from-[#171821] to-[#242636] rounded-3xl p-8 lg:p-12 relative overflow-hidden flex items-center justify-between border border-white/5 shadow-[0_15px_40px_rgba(0,0,0,0.5)] mb-10 group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#00d2ff]/5 rounded-full blur-3xl -mr-20 -mt-20 group-hover:bg-[#00d2ff]/10 transition-colors duration-700"></div>
          
          <div className="relative z-10">
            <h3 className="text-[11px] font-bold tracking-[0.2em] text-[#00d2ff] uppercase mb-4 flex items-center gap-3">
               <ActivityIcon className="w-4 h-4" /> Flujo Total Global
            </h3>
            <div className="flex items-baseline gap-4">
               <span className="text-7xl lg:text-8xl font-light text-white tracking-tight">{loading ? "0" : stats.total}</span>
               <span className="text-gray-500 font-medium tracking-widest uppercase text-xs">Atletas<br/>Inscritos</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
           {/* 2. Registrations by Day (Vertical Bars) */}
           <div className="bg-[#242636]/40 rounded-3xl p-8 border border-[#ffffff0a] flex flex-col h-full min-h-[400px]">
             <h3 className="text-[11px] font-bold tracking-[0.2em] text-gray-500 uppercase mb-8">Comportamiento por Día</h3>
             
             <div className="flex-1 flex items-end justify-between gap-2 mt-auto relative pt-10">
               {/* Background Grid Lines */}
               <div className="absolute inset-0 flex flex-col justify-between py-6 pointer-events-none opacity-5">
                 <div className="border-b border-white w-full h-px"></div>
                 <div className="border-b border-white w-full h-px"></div>
                 <div className="border-b border-white w-full h-px"></div>
                 <div className="border-b border-white w-full h-px"></div>
               </div>

               {loading ? (
                 <p className="w-full text-center text-gray-600 font-mono text-sm py-20">Calculando espectro...</p>
               ) : stats.daily.length === 0 ? (
                 <p className="w-full text-center text-gray-600 font-mono text-sm py-20">Aún no hay registros en la línea de tiempo.</p>
               ) : (
                 stats.daily.map((day, idx) => {
                   const maxCount = Math.max(...stats.daily.map(d => d.count), 1);
                   const heightPercent = (day.count / maxCount) * 100;
                   return (
                     <div key={idx} className="flex flex-col items-center flex-1 group relative z-10">
                       <span className="text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity absolute -top-6 bg-[#4b55f5] px-2 py-1 rounded shadow-lg">{day.count}</span>
                       <div className="w-full max-w-[40px] bg-[#171821] rounded-t-xl overflow-hidden flex items-end justify-center relative border border-white/5 border-b-0">
                         <div 
                           className="w-full bg-gradient-to-t from-[#4b55f5] to-[#00d2ff] rounded-t-lg transition-all duration-1000 ease-out group-hover:brightness-125"
                           style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                         ></div>
                       </div>
                       <span className="text-[9px] font-medium text-gray-500 mt-3 rotate-[-45deg] origin-top-left translate-y-2 whitespace-nowrap">{day.name}</span>
                     </div>
                   );
                 })
               )}
             </div>
           </div>

           {/* 3. Registrations by Municipality (Pie Chart) */}
           <div className="bg-[#242636]/40 rounded-3xl p-8 border border-[#ffffff0a] flex flex-col h-full min-h-[400px]">
             <h3 className="text-[11px] font-bold tracking-[0.2em] text-gray-500 uppercase mb-8">Concentración Geográfica (Municipios)</h3>
             
             <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-10">
               {loading ? (
                 <p className="w-full text-center text-gray-600 font-mono text-sm py-10">Procesando terreno...</p>
               ) : stats.munis.length === 0 ? (
                 <p className="w-full text-center text-gray-600 font-mono text-sm py-10">Zonas no ubicadas.</p>
               ) : (() => {
                 const totalMunis = stats.munis.reduce((sum, m) => sum + m.count, 0);
                 const colors = ["#00d2ff", "#4b55f5", "#884af0", "#ff5f6d", "#1DA851", "#f0ad4e"];
                 let cumulativePercent = 0;
                 
                 const getCoords = (percent: number) => {
                   const x = Math.cos(2 * Math.PI * percent);
                   const y = Math.sin(2 * Math.PI * percent);
                   return [x, y];
                 };

                 const svgSlices = stats.munis.map((muni, idx) => {
                   const percent = muni.count / totalMunis;
                   if (percent === 1) {
                     return (
                       <circle cx="0" cy="0" r="1" fill={colors[idx % colors.length]} key={idx}>
                         <title>Municipio: {muni.muni}&#10;Estado: {muni.fullState}&#10;Atletas: {muni.count}</title>
                       </circle>
                     );
                   }
                   
                   const [startX, startY] = getCoords(cumulativePercent);
                   cumulativePercent += percent;
                   const [endX, endY] = getCoords(cumulativePercent);
                   const largeArcFlag = percent > 0.5 ? 1 : 0;
                   const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

                   return (
                     <path d={pathData} fill={colors[idx % colors.length]} key={idx} className="hover:opacity-80 transition-opacity cursor-pointer">
                       <title>Municipio: {muni.muni}&#10;Estado: {muni.fullState}&#10;Atletas: {muni.count}</title>
                     </path>
                   );
                 });

                 return (
                   <>
                     {/* Circular SVG Pie Chart con Interactividad */}
                     <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-full border-4 border-[#1b1c27] flex items-center justify-center overflow-hidden">
                        <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
                          {svgSlices}
                        </svg>
                        <div className="absolute inset-0 rounded-full border-2 border-white/5 pointer-events-none mix-blend-overlay"></div>
                        {/* Donut Hole */}
                        <div className="absolute w-24 h-24 sm:w-28 sm:h-28 bg-[#1b1c27] rounded-full shadow-inner flex items-center justify-center flex-col z-10 pointer-events-none">
                           <span className="text-white text-2xl font-light">{totalMunis}</span>
                           <span className="text-[#00d2ff] text-[9px] uppercase tracking-widest font-bold">Total</span>
                        </div>
                     </div>
                     
                     {/* Color Legend List */}
                     <div className="flex-1 flex flex-col gap-3 w-full">
                       {stats.munis.map((muni, idx) => {
                         const percent = ((muni.count / totalMunis) * 100).toFixed(1);
                         return (
                           <div key={idx} className="flex items-center gap-3 bg-[#171821] p-3 rounded-xl border border-white/5 hover:bg-[#2a2d3d] transition-colors group relative cursor-pointer" title={`Estado: ${muni.fullState}`}>
                             <div className="w-3 h-3 rounded-full shrink-0 shadow-md" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                             <div className="flex flex-col flex-1 overflow-hidden">
                               <span className="text-gray-300 text-[11px] font-bold uppercase tracking-wider truncate">
                                 {muni.name}
                               </span>
                             </div>
                             <div className="flex flex-col items-end">
                               <span className="text-white font-mono text-xs font-bold">{muni.count}</span>
                               <span className="text-gray-500 text-[9px] font-bold">{percent}%</span>
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </>
                 );
               })()}
             </div>
           </div>
        </div>
      </div>

      {/* Right Sidebar eliminada a petición */}
    </div>
  );
}
