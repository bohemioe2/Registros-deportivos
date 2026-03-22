"use client";

import Link from "next/link";
import { Calendar, ArrowRight, Zap, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export default function Home() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchar solo los eventos que tu como Admin dejes como "ABIERTO"
    const q = query(collection(db, "events"), where("status", "==", "ABIERTO"));
    const unsub = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-[#1b1c27] font-sans text-white selection:bg-[#00d2ff] selection:text-black">
      {/* Navbar Minimalista */}
      <nav className="absolute top-0 w-full p-8 flex justify-between items-center z-20">
         <div className="flex items-center gap-3">
           <div className="w-6 h-6 bg-[#4b55f5] rounded-sm shadow-[0_0_15px_rgba(75,85,245,0.6)]"></div>
           <span className="text-2xl font-black tracking-[0.2em] uppercase">Mundo Deportivo</span>
         </div>
         <Link href="/admin" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors border border-gray-800 px-4 py-2 rounded-full hover:bg-white/5">
           Acceso Organizador
         </Link>
      </nav>

      {/* Hero Header Estilo Dashboard */}
      <header className="relative pt-40 pb-24 px-6 text-center overflow-hidden border-b border-[#ffffff0a]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#4b55f5]/10 to-transparent z-0"></div>
        {/* Glow Effects */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00d2ff]/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-20 left-1/4 w-80 h-80 bg-[#884af0]/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <span className="bg-[#4b55f5]/20 border border-[#4b55f5]/50 text-[#00d2ff] text-xs font-bold px-6 py-2 rounded-full uppercase tracking-[0.2em] mb-8 inline-block shadow-[0_0_15px_rgba(75,85,245,0.4)]">
             <span className="inline-block w-3 h-3 bg-[#00d2ff] rounded-full mr-2 animate-pulse"></span>
             Temporada Operativa Activa
          </span>
          <h1 className="text-7xl sm:text-8xl lg:text-9xl font-black tracking-tighter mb-6 text-white leading-none uppercase text-center w-full">
             Mundo <br/>
             <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] to-[#4b55f5]">Deportivo</span>
          </h1>
          <p className="mt-4 text-base sm:text-xl text-gray-400 font-medium tracking-wide max-w-2xl mx-auto leading-relaxed">
            Encuentra tu próximo desafío estratégico. Inscribe tus datos biométricos en la matriz y recibe tu ID de operátiva y póster oficial instantáneamente.
          </p>
        </div>
      </header>

      {/* Grid Principal */}
      <main className="max-w-5xl mx-auto px-6 mt-16 pb-24 relative z-10">
        <div className="flex items-end justify-between border-b border-[#ffffff10] pb-6 mb-12">
           <h2 className="text-xl font-light tracking-tight text-white flex items-center gap-3">
             <Target className="w-5 h-5 text-[#884af0]" />
             <span className="font-bold text-[#884af0]">Cartelera</span> de Operaciones
           </h2>
           <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Mostrando Eventos En Vivo</span>
        </div>
        
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
          {loading ? (
             <div className="col-span-full text-center py-20 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-t-2 border-r-2 border-[#4b55f5] rounded-full animate-spin mb-4"></div>
                <span className="text-[#00d2ff] font-bold text-[10px] uppercase tracking-widest animate-pulse">Sincronizando Base de Datos...</span>
             </div>
          ) : events.length === 0 ? (
             <div className="col-span-full text-center py-32 bg-[#242636]/40 backdrop-blur-md rounded-3xl border border-[#ffffff0a] flex flex-col items-center justify-center shadow-inner">
               <Zap className="w-10 h-10 text-gray-700 mb-4" />
               <span className="text-gray-400 font-medium block text-lg mb-2">No hay Operaciones activas en el radar.</span>
               <span className="text-gray-500 text-xs font-bold uppercase tracking-widest block">Mantén tu transmisor abierto para futuras fechas.</span>
             </div>
          ) : events.map((evt) => (
            <div key={evt.id} className="group bg-[#242636]/60 backdrop-blur-md rounded-3xl border border-[#ffffff0a] flex flex-col justify-between hover:-translate-y-2 transition-transform duration-300 shadow-[0_10px_40px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_50px_rgba(75,85,245,0.2)] hover:border-[#4b55f5]/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-[#4b55f5]/10 transition-colors pointer-events-none"></div>
              
              {/* Event Cover Banner */}
              <div className="w-full h-48 sm:h-64 overflow-hidden relative border-b border-[#ffffff10]">
                <img src={evt.eventBannerUrl || '/default-event.jpg'} alt={evt.name} className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#242636] to-transparent z-10"></div>
              </div>

              <div className="p-8 relative z-20 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <span className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-sm flex items-center gap-2`}>
                     <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></span>
                     Inscripción Abierta
                  </span>
                  <div className="w-12 h-12 bg-[#1b1c27] rounded-xl flex items-center justify-center shadow-inner border border-white/5">
                    <Calendar className="w-6 h-6 text-gray-500 group-hover:text-white transition-colors" />
                  </div>
                </div>
                
                <h3 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight uppercase leading-none">{evt.name}</h3>
                <p className="text-gray-400 text-base sm:text-lg font-medium leading-relaxed line-clamp-3 mb-8 flex-1">{evt.description}</p>
                
                <Link 
                  href={`/register/${evt.id}`}
                  className="w-full flex items-center justify-between bg-[#171821] text-white py-5 px-8 rounded-2xl text-sm uppercase tracking-widest font-black hover:bg-gradient-to-r hover:from-[#4b55f5] hover:to-[#884af0] transition-all shadow-inner group/btn border border-white/5"
                >
                  Inscribirme Ahora
                  <ArrowRight className="w-5 h-5 text-gray-500 group-hover/btn:text-white group-hover/btn:translate-x-2 transition-all" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="w-full text-center py-10 border-t border-[#ffffff0a] text-gray-600 text-[10px] font-bold uppercase tracking-widest">
        Plataforma Deportiva © 2026. Todos los derechos reservados.
      </footer>
    </div>
  );
}
