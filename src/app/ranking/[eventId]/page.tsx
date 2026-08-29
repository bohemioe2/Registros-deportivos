"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Timer, Trophy, Users, User, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function PublicRankingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  
  const eventId = params.eventId as string;
  const startTimeMsStr = searchParams.get('start');
  
  const [eventName, setEventName] = useState<string>("Cargando evento...");
  const [activeTab, setActiveTab] = useState<"general" | "male" | "female">("general");
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!eventId || !startTimeMsStr) {
      setErrorMsg("Enlace inválido o incompleto.");
      setLoading(false);
      return;
    }

    const fetchRankingData = async () => {
      try {
        // Cargar nombre del evento
        const eventDoc = await getDoc(doc(db, "events", eventId));
        if (eventDoc.exists()) {
          setEventName(eventDoc.data().name || eventId);
        } else {
          setEventName(eventId);
        }

        const startMs = parseInt(startTimeMsStr);
        if (isNaN(startMs)) throw new Error("Tiempo de inicio inválido");

        const q = query(
          collection(db, "registrations"),
          where("eventId", "==", eventId),
          where("status", "==", "APPROVED")
        );
        
        const snap = await getDocs(q);
        
        const results: any[] = [];
        snap.forEach(document => {
          const data = document.data();
          if (data.finishedAt) {
             const finishMs = new Date(data.finishedAt).getTime();
             const diffMs = finishMs - startMs;
             
             if (diffMs > 0 && !data.excludedFromRanking) { // Solo si llegaron después de que arrancó y no están omitidos
               results.push({
                  id: document.id,
                  ...data,
                  elapsedMs: diffMs
               });
             }
          }
        });
        
        // Ordenar por tiempo (menor a mayor)
        results.sort((a, b) => a.elapsedMs - b.elapsedMs);
        
        setRankings(results);
      } catch (error) {
        console.error(error);
        setErrorMsg("Hubo un error cargando los resultados.");
      } finally {
        setLoading(false);
      }
    };

    fetchRankingData();
  }, [eventId, startTimeMsStr]);

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

  const filteredRankings = rankings.filter(r => {
    if (activeTab === "general") return true;
    if (activeTab === "male") return r.gender === "MALE";
    if (activeTab === "female") return r.gender === "FEMALE";
    return true;
  });

  if (loading) {
     return (
        <div className="min-h-screen bg-[#1b1c27] flex flex-col items-center justify-center text-white space-y-4">
           <Loader2 className="w-12 h-12 text-[#00d2ff] animate-spin" />
           <p className="text-gray-400 font-bold uppercase tracking-widest text-sm animate-pulse">Cargando Resultados...</p>
        </div>
     );
  }

  if (errorMsg) {
     return (
        <div className="min-h-screen bg-[#1b1c27] flex flex-col items-center justify-center text-white">
           <div className="bg-[#ff5f6d]/10 p-8 rounded-3xl border border-[#ff5f6d]/20 text-center space-y-4 max-w-md mx-4">
              <Trophy className="w-12 h-12 text-[#ff5f6d] mx-auto opacity-50" />
              <h2 className="text-xl font-bold text-[#ff5f6d]">{errorMsg}</h2>
              <p className="text-gray-400 text-sm">Por favor solicita un nuevo enlace válido a la organización del evento.</p>
           </div>
        </div>
     );
  }

  return (
    <div className="min-h-screen bg-[#1b1c27] text-white p-4 sm:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* HEADER PUBLICO */}
        <header className="flex flex-col sm:flex-row items-center sm:items-end justify-between border-b border-[#ffffff10] pb-6 gap-6 text-center sm:text-left mt-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-16 h-16 sm:w-12 sm:h-12 bg-gradient-to-tr from-[#00d2ff] to-[#4b55f5] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(75,85,245,0.4)]">
              <Trophy className="w-8 h-8 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-3xl font-light tracking-tight mt-2 sm:mt-0">Resultados <span className="font-bold text-[#00d2ff]">En Vivo</span></h1>
              <p className="text-gray-400 text-xs sm:text-sm font-bold mt-2 uppercase tracking-widest">{eventName}</p>
            </div>
          </div>
        </header>

        {/* PESTAÑAS Y RESULTADOS */}
        {rankings.length === 0 ? (
           <div className="bg-[#171821] p-12 rounded-3xl border border-[#ffffff0a] text-center space-y-4 shadow-inner">
             <Timer className="w-12 h-12 text-gray-600 mx-auto" />
             <h3 className="text-xl font-bold text-gray-400">Aún no hay resultados</h3>
             <p className="text-gray-500 text-sm">Nadie ha cruzado la meta todavía, o los resultados están siendo calculados.</p>
           </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
             
             {/* Tabs Publicos */}
             <div className="flex justify-center sm:justify-start">
               <div className="flex p-1 bg-[#171821] border border-[#ffffff0a] rounded-2xl w-max">
                  <button 
                     onClick={() => setActiveTab("general")}
                     className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'general' ? 'bg-[#242636] text-[#00d2ff] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                  >
                     <Users className="w-4 h-4" /> General
                  </button>
                  <button 
                     onClick={() => setActiveTab("male")}
                     className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'male' ? 'bg-[#242636] text-[#4b55f5] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                  >
                     <User className="w-4 h-4" /> Varonil
                  </button>
                  <button 
                     onClick={() => setActiveTab("female")}
                     className={`flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold uppercase tracking-widest transition-all ${activeTab === 'female' ? 'bg-[#242636] text-[#ff5f6d] shadow-sm' : 'text-gray-500 hover:text-white'}`}
                  >
                     <User className="w-4 h-4" /> Femenil
                  </button>
               </div>
             </div>

             {/* Gráfica de Tiempos Pública */}
             {filteredRankings.length > 0 && (
               <div className="bg-[#171821] p-4 sm:p-8 rounded-3xl border border-[#ffffff0a] shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
                 <h3 className="text-xs uppercase tracking-widest font-bold text-gray-500 mb-6 flex items-center justify-center sm:justify-start gap-2">
                   <div className="w-2 h-2 rounded-full bg-[#00d2ff] animate-pulse"></div>
                   Gráfica de Tiempos
                 </h3>
                 <div className="w-full overflow-y-auto custom-scrollbar pr-2" style={{ maxHeight: '400px' }}>
                   <div style={{ height: `${Math.max(250, filteredRankings.length * 35)}px`, width: '100%' }}>
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={filteredRankings} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                       <XAxis 
                         type="number" 
                         tick={{ fill: '#6b7280', fontSize: 10 }} 
                         tickLine={false} 
                         axisLine={false}
                         tickFormatter={(val) => Math.floor(val/60000) + 'm'}
                       />
                       <YAxis 
                         type="category" 
                         dataKey="firstName" 
                         tick={{ fill: '#6b7280', fontSize: 10, fontWeight: 'bold' }} 
                         tickLine={false} 
                         axisLine={false} 
                         width={80}
                       />
                       <Tooltip 
                         cursor={{ fill: '#ffffff05' }}
                         contentStyle={{ backgroundColor: '#242636', border: '1px solid #ffffff10', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
                         formatter={(value: any, name: any, props: any) => {
                           return [<span className="font-mono text-[#00d2ff]">{formatTime(value)}</span>, <span className="text-gray-400 text-[10px] uppercase tracking-widest">{props.payload.age} Años - Tiempo Oficial</span>];
                         }}
                         labelStyle={{ fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.1em' }}
                       />
                       <Bar dataKey="elapsedMs" radius={[0, 6, 6, 0]} animationDuration={1500} barSize={16}>
                         {
                           filteredRankings.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={index === 0 ? '#ffc371' : index === 1 ? '#e2e8f0' : index === 2 ? '#cd7f32' : '#00d2ff'} />
                           ))
                         }
                       </Bar>
                     </BarChart>
                   </ResponsiveContainer>
                   </div>
                 </div>
               </div>
             )}
             
             {/* Tabla de Resultados Pública */}
             <div className="bg-[#242636]/60 backdrop-blur-md rounded-3xl border border-[#ffffff0a] shadow-[0_10px_40px_rgba(0,0,0,0.3)] overflow-hidden">
                 <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                       <thead>
                          <tr className="bg-[#171821] border-b border-[#ffffff10]">
                             <th className="px-4 sm:px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] w-16 sm:w-24 text-center">Pos</th>
                             <th className="px-4 sm:px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Folio</th>
                             <th className="px-4 sm:px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Atleta</th>
                             <th className="px-4 sm:px-6 py-5 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Edad</th>
                             <th className="px-4 sm:px-6 py-5 text-[10px] font-black text-[#00d2ff] uppercase tracking-[0.2em] text-right">Tiempo</th>
                          </tr>
                       </thead>
                       <tbody>
                          {filteredRankings.length === 0 ? (
                            <tr>
                               <td colSpan={5} className="px-6 py-12 text-center text-gray-500 text-sm font-medium">No hay llegadas en esta categoría.</td>
                            </tr>
                          ) : (
                            filteredRankings.map((participant, index) => {
                              const position = index + 1;
                              let rowStyle = "hover:bg-[#ffffff05] border-b border-[#ffffff05] transition-colors";
                              let posBadge = <span className="text-gray-400 font-bold">{position}</span>;
                              
                              if (position === 1) posBadge = <span className="bg-[#ffc371]/20 text-[#ffc371] border border-[#ffc371]/30 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full font-black mx-auto shadow-[0_0_15px_rgba(255,195,113,0.3)]">1</span>;
                              else if (position === 2) posBadge = <span className="bg-[#d1d5db]/20 text-[#d1d5db] border border-[#d1d5db]/30 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full font-black mx-auto">2</span>;
                              else if (position === 3) posBadge = <span className="bg-[#cd7f32]/20 text-[#cd7f32] border border-[#cd7f32]/30 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full font-black mx-auto">3</span>;

                              return (
                                <tr key={participant.id} className={rowStyle}>
                                  <td className="px-4 sm:px-6 py-4 text-center">{posBadge}</td>
                                  <td className="px-4 sm:px-6 py-4 font-mono text-xs sm:text-sm text-[#00d2ff] font-bold">{participant.folio}</td>
                                  <td className="px-4 sm:px-6 py-4">
                                     <div className="font-bold text-white text-xs sm:text-sm">{participant.firstName} {participant.lastName}</div>
                                  </td>
                                  <td className="px-4 sm:px-6 py-4">
                                     <div className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1 sm:gap-2">
                                        {participant.age} Años
                                     </div>
                                  </td>
                                  <td className="px-4 sm:px-6 py-4 text-right">
                                     <div className="inline-block bg-[#171821] border border-[#ffffff10] px-3 sm:px-4 py-1.5 rounded-lg text-[#00ff88] font-mono font-bold text-xs sm:text-sm tracking-widest shadow-inner">
                                        {formatTime(participant.elapsedMs)}
                                     </div>
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
