"use client";

import Link from "next/link";
import { Calendar, ArrowRight, Zap, Target, Award, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export default function Home() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "events"), where("status", "==", "ABIERTO"));
    const unsub = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-[#0d0e14] font-sans text-white selection:bg-[#00d2ff] selection:text-black overflow-x-hidden">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 z-0">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00d2ff]/10 rounded-full blur-[120px] pointer-events-none"></div>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_transparent_0%,_#0d0e14_90%)] pointer-events-none opacity-50"></div>
      </div>

      {/* Navbar Minimalista Premium */}
      <nav className="fixed top-0 w-full p-6 sm:p-10 flex justify-between items-center z-[100] backdrop-blur-sm border-b border-white/5 bg-[#0d0e14]/40">
          <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 bg-gradient-to-tr from-[#4b55f5] to-[#884af0] rounded-xl shadow-[0_0_30px_rgba(75,85,245,0.4)] flex items-center justify-center p-2 group-hover:scale-110 transition-transform duration-500">
               <Award className="w-full h-full text-white" />
            </div>
          </div>
          <Link href="/admin" className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] hover:text-[#00d2ff] transition-all border border-white/10 px-6 py-2.5 rounded-full hover:bg-white/5 hover:border-[#00d2ff]/30 hover:shadow-[0_0_20px_rgba(0,210,255,0.1)]">
            Acceso Organizador
          </Link>
      </nav>

      {/* Hero Minimalist Spark */}
      <header className="relative pt-48 pb-16 px-6 text-center z-10">
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          <span className="flex items-center gap-3 bg-white/5 border border-white/10 text-[#00d2ff] text-[9px] sm:text-[10px] font-black px-6 py-2.5 rounded-full uppercase tracking-[0.3em] shadow-[0_10px_30px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-top duration-700">
             <Sparkles className="w-3.5 h-3.5 animate-pulse" />
             BIENVENIDO, SELECCIONA EL EVENTO DE TU INTERÉS 🏁
          </span>
        </div>
      </header>

      {/* Grid Principal Experimental */}
      <main className="max-w-6xl mx-auto px-6 pb-32 relative z-10">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-2">
          {loading ? (
             <div className="col-span-full text-center py-40 flex flex-col items-center justify-center">
                <div className="w-16 h-16 border-t-2 border-r-2 border-[#00d2ff] rounded-full animate-spin mb-6"></div>
                <span className="text-[#00d2ff] font-black text-[11px] uppercase tracking-[0.4em] animate-pulse">Sincronizando Matriz...</span>
             </div>
          ) : events.length === 0 ? (
             <div className="col-span-full py-40 bg-white/5 backdrop-blur-3xl rounded-[40px] border border-white/10 flex flex-col items-center justify-center shadow-inner animate-in fade-in zoom-in duration-1000">
               <Zap className="w-12 h-12 text-gray-700 mb-6" />
               <span className="text-gray-400 font-bold block text-xl mb-3">No hay Eventos disponibles</span>
               <span className="text-gray-600 text-[10px] font-black uppercase tracking-[0.3em] block">Transmisión de datos inactiva</span>
             </div>
          ) : events.map((evt, index) => (
            <div 
              key={evt.id} 
              className="group relative bg-gradient-to-b from-white/10 to-transparent backdrop-blur-2xl rounded-[48px] border border-white/10 p-4 transition-all duration-700 hover:border-[#4b55f5]/50 hover:shadow-[0_40px_80px_rgba(0,0,0,0.6)] hover:-translate-y-3 animate-in fade-in slide-in-from-bottom duration-700" 
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="aspect-[16/10] w-full overflow-hidden rounded-[40px] relative">
                 <img 
                    src={evt.eventBannerUrl || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop"} 
                    alt={evt.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1500ms]" 
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-[#0d0e14] via-transparent to-transparent opacity-90"></div>
                 
                 {/* Floating Info Overlay */}
                 <div className="absolute top-6 right-6">
                    <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2">
                       <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse"></div>
                       <span className="text-[10px] font-black uppercase tracking-widest text-white">Cupos Disponibles</span>
                    </div>
                 </div>
              </div>
              
              <div className="p-8 sm:p-10 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#4b55f5]/20 flex items-center justify-center border border-[#4b55f5]/30">
                     <Calendar className="w-5 h-5 text-[#4b55f5]" />
                  </div>
                  <span className="text-[11px] font-black text-[#00d2ff] uppercase tracking-[0.2em]">{evt.date || "Fecha por definir"}</span>
                </div>
                
                <h3 className="text-4xl sm:text-5xl font-black text-white mb-6 tracking-tighter uppercase leading-none italic group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-[#00d2ff] transition-all duration-500">
                   {evt.name}
                </h3>
                
                <p className="text-gray-400 text-sm sm:text-base font-medium leading-relaxed line-clamp-2 mb-10 flex-1 opacity-80 group-hover:opacity-100 transition-opacity">
                   {evt.description}
                </p>
                
                <Link 
                  href={`/register/${evt.id}`}
                  className="w-full flex items-center justify-between bg-white text-black py-6 px-10 rounded-[30px] text-[12px] uppercase tracking-[0.3em] font-black hover:bg-[#4b55f5] hover:text-white transition-all shadow-xl group/btn overflow-hidden relative"
                >
                  <span className="relative z-10 transition-colors">Inscribirme Ahora</span>
                  <ArrowRight className="w-6 h-6 z-10 transition-all group-hover/btn:translate-x-2" />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#4b55f5] to-[#884af0] opacity-0 group-hover/btn:opacity-100 transition-opacity"></div>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="w-full text-center py-20 border-t border-white/5 text-gray-700 text-[11px] font-black uppercase tracking-[0.4em] relative z-10">
        Plataforma Deportiva © 2026. <span className="text-gray-800">Elite Ops.</span>
      </footer>
    </div>
  );
}
