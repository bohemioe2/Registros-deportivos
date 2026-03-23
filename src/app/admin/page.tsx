"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { useAuth } from "@/components/admin/AuthProvider";
import { Clock, Activity as ActivityIcon, Target, Award, MapPin, TrendingUp, Sparkles, Filter } from "lucide-react";
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
    const baseColl = collection(db, "registrations");
    
    if (selectedEventId === "ALL") {
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
    <div className="flex h-full w-full bg-[#0d0e14] text-white overflow-hidden relative selection:bg-[#4b55f5] selection:text-white">
      
      {/* BACKGROUND AMBIANCE */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-[#4b55f5]/5 rounded-full blur-[120px] animate-pulse"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#00d2ff]/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="flex-1 p-8 lg:p-12 flex flex-col overflow-y-auto custom-scrollbar relative z-10">
        
        {/* DESIGNER HEADER */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-10 mb-14">
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-white/5 border border-white/10 w-fit px-4 py-1.5 rounded-full shadow-lg backdrop-blur-md">
               <Sparkles className="w-3.5 h-3.5 text-[#4b55f5] animate-pulse" />
               <h2 className="text-[10px] font-black tracking-[0.3em] text-gray-400 uppercase">Monitor de Élite Ops</h2>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase leading-none italic">
               Kardex <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] to-[#4b55f5]">Central</span>
            </h1>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 w-full xl:w-auto">
             <div className="relative w-full sm:w-[380px] group">
               <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[#4b55f5] group-focus-within:text-[#00d2ff] transition-colors">
                  <Filter className="w-4 h-4" />
               </div>
               <select 
                 value={selectedEventId} 
                 onChange={(e) => setSelectedEventId(e.target.value)}
                 className="w-full bg-[#1b1c27]/60 backdrop-blur-xl border border-white/5 text-white rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] pl-14 pr-10 py-5 focus:outline-none focus:border-[#4b55f5]/50 transition-all cursor-pointer hover:bg-white/5 appearance-none shadow-2xl"
                 style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234b55f5' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center' }}
               >
                  {isSuperAdmin && <option value="ALL">Vista Global: TODOS LOS EVENTOS 🌍</option>}
                  {!isSuperAdmin && <option value="ALL" disabled>SELECCIONAR EVENTO 👇</option>}
                  {events.map((ev) => (
                     <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
               </select>
             </div>

             <Link href="/admin/events" className="w-full sm:w-auto bg-white text-black text-[10px] font-black px-10 py-5 rounded-2xl shadow-[0_15px_40px_rgba(255,255,255,0.1)] transition-all uppercase tracking-[0.3em] text-center hover:bg-[#4b55f5] hover:text-white hover:-translate-y-1 active:scale-95">
               Eventos
             </Link>
          </div>
        </div>

        {/* 1. HERO STATS (GLASSMORPHISM) */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-12 mb-12">
            <div className="group relative bg-[#171821]/60 backdrop-blur-3xl rounded-[40px] p-10 lg:p-14 border border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-700 hover:border-[#4b55f5]/50">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-[#4b55f5]/5 to-transparent rounded-full blur-[100px] pointer-events-none -mr-40 -mt-40"></div>
              
              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-10">
                <div className="space-y-6 text-center sm:text-left">
                  <h3 className="text-[10px] font-black tracking-[0.4em] text-[#00d2ff] uppercase flex items-center gap-4 justify-center sm:justify-start">
                     <span className="w-1.5 h-1.5 rounded-full bg-[#00d2ff] animate-ping"></span>
                     FLUJO DE OPERACIONES ACTUAL
                  </h3>
                  <div className="flex flex-col sm:flex-row items-baseline gap-6 justify-center sm:justify-start">
                     <span className="text-8xl lg:text-[140px] font-black text-white tracking-tighter leading-none italic select-none">
                        {loading ? "..." : stats.total}
                     </span>
                     <div className="text-gray-500 font-extrabold uppercase text-[12px] tracking-[0.3em] leading-relaxed">
                        Atletas <br/> <span className="text-white/40">Inscritos</span>
                     </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 w-full sm:w-auto">
                    <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center">
                       <TrendingUp className="w-5 h-5 text-[#00ff88] mx-auto mb-3" />
                       <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">+12% SEMANAL</p>
                    </div>
                    <div className="bg-white/5 rounded-3xl p-6 border border-white/10 text-center">
                       <Award className="w-5 h-5 text-yellow-400 mx-auto mb-3" />
                       <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest">TOP CATEGORÍA</p>
                    </div>
                </div>
              </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
           {/* 2. CHRT: COMPORTAMIENTO POR DÍA */}
           <div className="bg-[#171821]/40 backdrop-blur-2xl rounded-[40px] p-10 border border-white/5 flex flex-col min-h-[480px] transition-all duration-700 hover:border-[#00d2ff]/30">
             <div className="flex items-center justify-between mb-12">
                <h3 className="text-[11px] font-black tracking-[0.35em] text-gray-500 uppercase">Crecimiento Logístico</h3>
                <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10">
                   <Clock className="w-3.5 h-3.5 text-[#00d2ff]" />
                </div>
             </div>
             
             <div className="flex-1 flex items-end justify-between gap-4 mt-auto relative pt-12">
                {/* Visual Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between py-10 pointer-events-none opacity-[0.03]">
                  {[1,2,3,4].map(l => <div key={l} className="border-b border-white w-full h-px"></div>)}
                </div>

                {loading ? (
                  <p className="w-full text-center text-gray-600 font-black text-[10px] uppercase tracking-widest py-20">Analizando espectro...</p>
                ) : stats.daily.length === 0 ? (
                  <p className="w-full text-center text-gray-600 font-black text-[10px] uppercase tracking-widest py-20 italic underline decoration-[#4b55f5]">Línea de tiempo inactiva</p>
                ) : (
                  stats.daily.map((day, idx) => {
                    const maxCount = Math.max(...stats.daily.map(d => d.count), 1);
                    const heightPercent = (day.count / maxCount) * 100;
                    return (
                      <div key={idx} className="flex flex-col items-center flex-1 group relative z-10 transition-all">
                        <span className="text-[#1b1c27] text-[10px] font-black opacity-0 group-hover:opacity-100 transition-all absolute -top-10 bg-[#00d2ff] px-3 py-1.5 rounded-xl shadow-2xl scale-75 group-hover:scale-100">{day.count} pts</span>
                        <div className="w-full max-w-[50px] bg-white/5 rounded-t-[20px] overflow-hidden flex items-end justify-center relative border border-white/5 border-b-0 transition-all duration-500 group-hover:bg-white/10">
                          <div 
                            className="w-full bg-gradient-to-t from-[#4b55f5] via-[#00d2ff] to-[#00ff88] rounded-t-[18px] transition-all duration-[1500ms] group-hover:brightness-125 shadow-[0_0_20px_rgba(0,210,255,0.2)]"
                            style={{ height: `${heightPercent}%`, minHeight: '6px' }}
                          ></div>
                        </div>
                        <span className="text-[9px] font-black text-gray-600 mt-6 rotate-[-45deg] origin-top-left translate-y-2 whitespace-nowrap uppercase tracking-widest group-hover:text-white transition-colors">
                           {day.name}
                        </span>
                      </div>
                    );
                  })
                )}
             </div>
           </div>

           {/* 3. CHART: CONCENTRACIÓN GEOGRÁFICA */}
           <div className="bg-[#171821]/40 backdrop-blur-2xl rounded-[40px] p-10 border border-white/5 flex flex-col min-h-[480px] transition-all duration-700 hover:border-[#884af0]/30">
             <div className="flex items-center justify-between mb-12">
                <h3 className="text-[11px] font-black tracking-[0.35em] text-gray-500 uppercase">Impacto Territorial</h3>
                <div className="bg-white/5 px-4 py-2 rounded-full border border-white/10">
                   <MapPin className="w-3.5 h-3.5 text-[#884af0]" />
                </div>
             </div>
             
             <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-14">
                {loading ? (
                  <p className="w-full text-center text-gray-600 font-black text-[10px] uppercase tracking-widest py-10">Procesando terreno...</p>
                ) : stats.munis.length === 0 ? (
                  <p className="w-full text-center text-gray-600 font-black text-[10px] uppercase tracking-widest py-10 italic">Zonas no ubicadas</p>
                ) : (() => {
                  const totalMunis = stats.munis.reduce((sum, m) => sum + m.count, 0);
                  const colors = ["#00d2ff", "#4b55f5", "#884af0", "#ff5f6d", "#00ff88", "#f0ad4e"];
                  let cumulativePercent = 0;
                  const getCoords = (percent: number) => [Math.cos(2 * Math.PI * percent), Math.sin(2 * Math.PI * percent)];

                  return (
                    <>
                      <div className="relative w-56 h-56 sm:w-64 sm:h-64 shrink-0 shadow-[0_40px_80px_rgba(0,0,0,0.6)] rounded-full border-8 border-[#0d0e14] flex items-center justify-center overflow-hidden transition-transform duration-700 hover:scale-105">
                         <svg viewBox="-1 -1 2 2" className="w-full h-full transform -rotate-90">
                           {stats.munis.map((muni, idx) => {
                             const percent = muni.count / totalMunis;
                             const [startX, startY] = getCoords(cumulativePercent);
                             cumulativePercent += percent;
                             const [endX, endY] = getCoords(cumulativePercent);
                             const largeArcFlag = percent > 0.5 ? 1 : 0;
                             const pathData = percent === 1 ? "" : `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
                             return percent === 1 ? <circle cx="0" cy="0" r="1" fill={colors[0]} key={idx} /> : (
                               <path d={pathData} fill={colors[idx % colors.length]} key={idx} className="hover:brightness-125 transition-all cursor-pointer">
                                 <title>{muni.muni}: {muni.count}</title>
                               </path>
                             );
                           })}
                         </svg>
                         <div className="absolute inset-4 bg-[#0d0e14]/90 rounded-full flex flex-col items-center justify-center border border-white/5 backdrop-blur-sm">
                            <Target className="w-6 h-6 text-white/50 mb-1" />
                            <span className="text-xl font-black text-white">{stats.total}</span>
                            <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest">Atletas</span>
                         </div>
                      </div>

                      <div className="flex-1 w-full space-y-5">
                         {stats.munis.map((muni, idx) => (
                           <div key={idx} className="flex items-center justify-between group cursor-default">
                             <div className="flex items-center gap-4">
                               <div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-transform group-hover:scale-125" style={{ backgroundColor: colors[idx % colors.length] }}></div>
                               <span className="text-[10px] font-black uppercase text-gray-300 tracking-widest group-hover:text-white transition-colors truncate max-w-[120px]">{muni.muni}</span>
                             </div>
                             <div className="flex items-center gap-4">
                                <span className="bg-white/5 px-3 py-1 rounded-full text-[9px] font-black text-[#00d2ff] border border-white/5 group-hover:border-[#00d2ff]/40 transition-all">{((muni.count/totalMunis)*100).toFixed(0)}%</span>
                                <span className="text-sm font-black text-white group-hover:text-[#00d2ff] transition-colors">{muni.count}</span>
                             </div>
                           </div>
                         ))}
                      </div>
                    </>
                  );
                })()}
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
