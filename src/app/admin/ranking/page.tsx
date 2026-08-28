"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/admin/AuthProvider";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Timer, Trophy, Medal, Users, User, ArrowRight, Loader2, CalendarClock, EyeOff } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function RankingPage() {
  const { role, assignedEventId } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  
  const [activeTab, setActiveTab] = useState<"general" | "male" | "female">("general");
  const [loading, setLoading] = useState(false);
  const [rankings, setRankings] = useState<any[]>([]);
  
  const [isReady, setIsReady] = useState(false);
  const [isSimplePrint, setIsSimplePrint] = useState(false);

  useEffect(() => {
    setIsReady(true);
    if (assignedEventId) {
       setSelectedEventId(assignedEventId);
    }
  }, [assignedEventId]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsSnap = await getDocs(collection(db, "events"));
        const evts: any[] = [];
        eventsSnap.forEach(doc => {
          evts.push({ id: doc.id, ...doc.data() });
        });
        setEvents(evts);
        if (evts.length > 0 && !assignedEventId) {
          setSelectedEventId(evts[0].id);
        }
      } catch (e) {
        console.error("Error al cargar eventos", e);
      }
    };
    if (role === "SUPERADMIN") {
      fetchEvents();
    }
  }, [role, assignedEventId]);

  const generateRanking = async () => {
    if (!selectedEventId) return alert("Selecciona un evento primero.");
    if (!startTime) return alert("Debes indicar la hora de arranque oficial.");

    setLoading(true);
    try {
      const q = query(
        collection(db, "registrations"),
        where("eventId", "==", selectedEventId),
        where("status", "==", "APPROVED")
      );
      
      const snap = await getDocs(q);
      const startMs = new Date(startTime).getTime();
      
      const results: any[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        if (data.finishedAt) {
           const finishMs = new Date(data.finishedAt).getTime();
           const diffMs = finishMs - startMs;
           
           if (diffMs > 0) { // Solo si llegaron después de que arrancó
             results.push({
                id: doc.id,
                ...data,
                elapsedMs: diffMs
             });
           }
        }
      });
      
      // Ordenar por tiempo (menor a mayor)
      results.sort((a, b) => a.elapsedMs - b.elapsedMs);
      
      if (results.length === 0) {
        alert("No se encontraron atletas que hayan llegado DESPUÉS de la hora de arranque indicada. Por favor, verifica que la hora de disparo sea correcta.");
      }
      
      setRankings(results);
    } catch (error) {
      console.error(error);
      alert("Hubo un error calculando los tiempos.");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0')
    ].join(':');
  };

  const omitParticipant = (id: string) => {
    setRankings(prev => prev.filter(r => r.id !== id));
  };

  const filteredRankings = rankings.filter(r => {
    if (activeTab === "general") return true;
    if (activeTab === "male") return r.gender === "MALE";
    if (activeTab === "female") return r.gender === "FEMALE";
    return true;
  });

  if (!isReady) return null;

  return (
    <div className="h-full print:h-auto overflow-y-auto print:overflow-visible custom-scrollbar bg-[#1b1c27] print:bg-white text-white print:text-black p-6 pb-20 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#ffffff10] print:border-black/10 pb-6 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-[#00d2ff] to-[#4b55f5] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(75,85,245,0.4)] print:shadow-none print:border print:border-black">
              <Trophy className="w-6 h-6 text-white print:text-black" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-light tracking-tight">Ranking de <span className="font-bold text-[#00d2ff] print:text-black">Tiempos</span></h1>
              <p className="text-gray-400 print:text-gray-600 text-xs sm:text-sm font-medium mt-1 uppercase tracking-widest">Tiempos oficiales calculados al cruzar la meta</p>
            </div>
          </div>
        </header>

        {/* CONFIGURACIÓN Y CONTROLES */}
        <div className="bg-[#171821] p-6 sm:p-8 rounded-3xl border border-[#ffffff0a] shadow-inner relative overflow-hidden print:hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#4b55f5]/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              
              {/* Selector de Evento */}
              <div className="space-y-2">
                 <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">1. Selecciona Evento</label>
                 {role === "SUPERADMIN" ? (
                   <select 
                     value={selectedEventId} 
                     onChange={e => setSelectedEventId(e.target.value)}
                     className="w-full bg-[#242636] border border-[#ffffff10] text-white rounded-xl py-3 px-4 text-sm font-medium focus:outline-none focus:border-[#00d2ff] appearance-none custom-select shadow-inner"
                   >
                     {events.map(ev => (
                       <option key={ev.id} value={ev.id}>{ev.name || ev.id}</option>
                     ))}
                   </select>
                 ) : (
                   <div className="w-full bg-[#242636] border border-[#ffffff10] text-gray-400 rounded-xl py-3 px-4 text-sm font-medium shadow-inner opacity-70">
                     {assignedEventId}
                   </div>
                 )}
              </div>

              {/* Selector de Hora */}
              <div className="space-y-2">
                 <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest flex items-center gap-2">
                    2. Hora de Arranque (Disparo) <CalendarClock className="w-3 h-3 text-[#ffc371]" />
                 </label>
                 <input 
                   type="datetime-local" 
                   value={startTime}
                   onChange={e => setStartTime(e.target.value)}
                   className="w-full bg-[#242636] border border-[#ffffff10] text-white rounded-xl py-3 px-4 text-sm font-medium focus:outline-none focus:border-[#00d2ff] shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]"
                 />
              </div>
              
              {/* Botón de Cálculo */}
              <div className="space-y-2 flex flex-col justify-end">
                 <button 
                   onClick={generateRanking}
                   disabled={loading}
                   className="w-full bg-gradient-to-r from-[#00d2ff] to-[#4b55f5] hover:scale-105 disabled:hover:scale-100 disabled:opacity-50 text-white rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest shadow-[0_0_20px_rgba(75,85,245,0.4)] transition-all flex items-center justify-center gap-2 h-[46px]"
                 >
                   {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Timer className="w-5 h-5" /> Calcular Ranking</>}
                 </button>
              </div>

           </div>
        </div>
        
        {/* PESTAÑAS Y RESULTADOS */}
        {rankings.length > 0 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500 mt-8">
             
             {/* Controles y Exportar */}
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
               {/* Tabs */}
               <div className="flex p-1 bg-[#171821] border border-[#ffffff0a] rounded-2xl w-max">
                  <button 
                     onClick={() => setActiveTab("general")}
                     className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'general' ? 'bg-[#242636] text-[#00d2ff] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                  >
                     <Users className="w-4 h-4" /> General
                  </button>
                  <button 
                     onClick={() => setActiveTab("male")}
                     className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'male' ? 'bg-[#242636] text-[#4b55f5] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                  >
                     <User className="w-4 h-4" /> Varonil
                  </button>
                  <button 
                     onClick={() => setActiveTab("female")}
                     className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'female' ? 'bg-[#242636] text-[#ff5f6d] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                  >
                     <User className="w-4 h-4" /> Femenil
                  </button>
               </div>
               
               <div className="flex gap-2">
                 <button 
                   onClick={() => { setIsSimplePrint(false); setTimeout(() => window.print(), 100); }}
                   className="bg-gray-100 hover:bg-white text-gray-900 border border-transparent hover:border-gray-300 transition-all px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg"
                 >
                   📄 PDF Completo
                 </button>
                 <button 
                   onClick={() => { setIsSimplePrint(true); setTimeout(() => window.print(), 100); }}
                   className="bg-[#242636] hover:bg-[#2a2d3d] text-[#00d2ff] border border-[#ffffff10] hover:border-[#00d2ff]/50 transition-all px-4 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg"
                 >
                   📄 PDF Solo Nombres
                 </button>
               </div>
             </div>

             {/* Título solo para impresión */}
             <div className="hidden print:block mb-4">
               <h2 className="text-xl font-bold uppercase tracking-widest text-black">
                 Resultados - Categoría {activeTab === "general" ? "General" : activeTab === "male" ? "Varonil" : "Femenil"}
               </h2>
               <p className="text-sm text-gray-600">Evento: {selectedEventId} | Arranque: {new Date(startTime).toLocaleString('es-MX')}</p>
             </div>
             
             {/* Gráfica de Tiempos (Top 15) */}
             {filteredRankings.length > 0 && (
               <div className="bg-[#171821] p-6 sm:p-8 rounded-3xl border border-[#ffffff0a] mb-8 print:hidden shadow-inner">
                 <h3 className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-6 flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-[#00d2ff] animate-pulse"></div>
                   Top 15 Tiempos Oficiales
                 </h3>
                 <div className="h-[300px] w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={filteredRankings.slice(0, 15)} margin={{ top: 10, right: 10, left: -20, bottom: 40 }}>
                       <XAxis 
                         dataKey="firstName" 
                         tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 'bold' }} 
                         tickLine={false} 
                         axisLine={false}
                         angle={-45}
                         textAnchor="end"
                         dy={10}
                       />
                       <YAxis 
                         tick={{ fill: '#6b7280', fontSize: 10 }} 
                         tickLine={false} 
                         axisLine={false} 
                         tickFormatter={(val) => Math.floor(val/60000) + 'm'}
                       />
                       <Tooltip 
                         cursor={{ fill: '#ffffff05' }}
                         contentStyle={{ backgroundColor: '#242636', border: '1px solid #ffffff10', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                         formatter={(value: any) => {
                           return [<span className="font-mono text-[#00d2ff]">{formatTime(value)}</span>, <span className="text-gray-400 text-[10px] uppercase tracking-widest">Tiempo Oficial</span>];
                         }}
                         labelStyle={{ fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.1em' }}
                       />
                       <Bar dataKey="elapsedMs" radius={[6, 6, 0, 0]} animationDuration={1500}>
                         {
                           filteredRankings.slice(0, 15).map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={index === 0 ? '#ffc371' : index === 1 ? '#e2e8f0' : index === 2 ? '#cd7f32' : '#00d2ff'} />
                           ))
                         }
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                 </div>
               </div>
             )}
             
             {/* Tabla de Resultados */}
             <div className="bg-[#242636]/60 print:bg-white print:border-black/20 backdrop-blur-md rounded-3xl border border-[#ffffff0a] shadow-[0_10px_40px_rgba(0,0,0,0.3)] print:shadow-none overflow-hidden print:overflow-visible print:rounded-none">
                <div className="overflow-x-auto print:overflow-visible">
                   <table className="w-full text-left border-collapse print:text-black">
                      <thead>
                         <tr className="bg-[#171821] print:bg-gray-100 border-b border-[#ffffff10] print:border-black/30">
                            <th className={`px-6 py-5 text-[10px] font-black text-gray-500 print:text-black uppercase tracking-[0.2em] w-24 text-center ${isSimplePrint ? 'print:hidden' : ''}`}>Posición</th>
                            <th className={`px-6 py-5 text-[10px] font-black text-gray-500 print:text-black uppercase tracking-[0.2em] ${isSimplePrint ? 'print:hidden' : ''}`}>Folio</th>
                            <th className="px-6 py-5 text-[10px] font-black text-gray-500 print:text-black uppercase tracking-[0.2em]">Atleta</th>
                            <th className={`px-6 py-5 text-[10px] font-black text-gray-500 print:text-black uppercase tracking-[0.2em] ${isSimplePrint ? 'print:hidden' : ''}`}>Categoría / Edad</th>
                            <th className="px-6 py-5 text-[10px] font-black text-[#00d2ff] print:text-black uppercase tracking-[0.2em] text-right">Tiempo Oficial</th>
                            <th className="px-6 py-5 text-[10px] font-black text-gray-500 print:hidden uppercase tracking-[0.2em] text-center w-16">Omitir</th>
                         </tr>
                      </thead>
                      <tbody>
                         {filteredRankings.length === 0 ? (
                           <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-gray-500 print:text-black text-sm font-medium">No hay llegadas registradas en esta categoría.</td>
                           </tr>
                         ) : (
                           filteredRankings.map((participant, index) => {
                             const position = index + 1;
                             let rowStyle = "hover:bg-[#ffffff05] border-b border-[#ffffff05] print:border-black/10 transition-colors";
                             let posBadge = <span className="text-gray-400 print:text-black font-bold">{position}</span>;
                             
                             if (position === 1) posBadge = <span className="bg-[#ffc371]/20 print:bg-transparent text-[#ffc371] print:text-black border border-[#ffc371]/30 print:border-black w-8 h-8 flex items-center justify-center rounded-full font-black mx-auto shadow-[0_0_15px_rgba(255,195,113,0.3)] print:shadow-none">1</span>;
                             else if (position === 2) posBadge = <span className="bg-[#d1d5db]/20 print:bg-transparent text-[#d1d5db] print:text-black border border-[#d1d5db]/30 print:border-black w-8 h-8 flex items-center justify-center rounded-full font-black mx-auto">2</span>;
                             else if (position === 3) posBadge = <span className="bg-[#cd7f32]/20 print:bg-transparent text-[#cd7f32] print:text-black border border-[#cd7f32]/30 print:border-black w-8 h-8 flex items-center justify-center rounded-full font-black mx-auto">3</span>;

                             return (
                               <tr key={participant.id} className={rowStyle}>
                                 <td className={`px-6 py-4 text-center ${isSimplePrint ? 'print:hidden' : ''}`}>{posBadge}</td>
                                 <td className={`px-6 py-4 font-mono text-sm text-[#00d2ff] print:text-black font-bold ${isSimplePrint ? 'print:hidden' : ''}`}>{participant.folio}</td>
                                 <td className="px-6 py-4">
                                    <div className="font-bold text-white print:text-black text-sm">{participant.firstName} {participant.lastName}</div>
                                 </td>
                                 <td className={`px-6 py-4 ${isSimplePrint ? 'print:hidden' : ''}`}>
                                    <div className="text-xs text-gray-400 print:text-black font-bold uppercase tracking-widest flex items-center gap-2">
                                       {participant.gender === 'MALE' ? 'Varonil' : 'Femenil'} <span className="w-1 h-1 bg-gray-600 print:bg-black rounded-full"></span> {participant.age} Años
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-right">
                                    <div className="inline-block bg-[#171821] print:bg-transparent print:border-none border border-[#ffffff10] px-4 py-1.5 rounded-lg text-[#00ff88] print:text-black font-mono font-bold text-sm tracking-widest shadow-inner print:shadow-none">
                                       {formatTime(participant.elapsedMs)}
                                    </div>
                                 </td>
                                 <td className="px-6 py-4 text-center print:hidden">
                                    <button 
                                      onClick={() => omitParticipant(participant.id)}
                                      title="Omitir del reporte"
                                      className="text-gray-500 hover:text-[#ff5f6d] hover:bg-[#ff5f6d]/10 p-2 rounded-lg transition-colors"
                                    >
                                      <EyeOff className="w-4 h-4" />
                                    </button>
                                 </td>
                               </tr>
                             );
                           })
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}
        
      </div>
    </div>
  );
}
