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
          </div>
          <Link href="/admin" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors border border-gray-800 px-4 py-2 rounded-full hover:bg-white/5">
            Acceso Organizador
          </Link>
      </nav>

      {/* Hero Header Estilo Dashboard */}
      <header className="relative pt-24 pb-12 px-6 text-center overflow-hidden border-b border-[#ffffff0a]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#4b55f5]/10 to-transparent z-0"></div>
        {/* Glow Effects */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00d2ff]/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute top-20 left-1/4 w-80 h-80 bg-[#884af0]/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <span className="bg-[#4b55f5]/20 border border-[#4b55f5]/50 text-[#00d2ff] text-xs font-bold px-6 py-2 rounded-full uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(75,85,245,0.4)]">
             <span className="inline-block w-3 h-3 bg-[#00d2ff] rounded-full mr-2 animate-pulse"></span>
             Temporada Operativa Activa
          </span>
        </div>
      </header>

      {/* Grid Principal */}
      <main className="max-w-5xl mx-auto px-6 mt-16 pb-24 relative z-10">
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
            <div key={evt.id} className="group relative bg-[#242636]/40 backdrop-blur-md rounded-3xl border border-[#ffffff0a] overflow-hidden hover:border-[#4b55f5]/30 transition-all duration-500 shadow-xl flex flex-col">
              <div className="aspect-video w-full overflow-hidden relative">
                 <img src={evt.eventBannerUrl || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop"} alt={evt.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                 <div className="absolute inset-0 bg-gradient-to-t from-[#1b1c27] via-transparent to-transparent"></div>
              </div>
              
              <div className="p-8 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="w-4 h-4 text-[#00d2ff]" />
                  <span className="text-[10px] font-bold text-[#00d2ff] uppercase tracking-widest">{evt.date || "Sede por Definir"}</span>
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
