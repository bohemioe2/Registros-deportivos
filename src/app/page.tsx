"use client";

import Link from "next/link";
import { Calendar, ArrowRight, Zap, Target, Award, Sparkles, QrCode } from "lucide-react";
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
    <div className="min-h-screen bg-[#0d0e14] font-sans text-white selection:bg-[#4b55f5] selection:text-white overflow-x-hidden">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 z-0 opacity-40">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#4b55f5]/15 rounded-full blur-[140px] pointer-events-none"></div>
         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#884af0]/15 rounded-full blur-[140px] pointer-events-none"></div>
      </div>

      {/* Navbar Minimalista Premium */}
      <nav className="fixed top-0 w-full p-6 sm:px-12 flex justify-between items-center z-[100] backdrop-blur-md bg-black/20 border-b border-white/5">
          <div className="flex items-center gap-4 group">
            <div className="w-10 h-10 bg-gradient-to-tr from-[#4b55f5] to-[#884af0] rounded-xl shadow-[0_0_25px_rgba(75,85,245,0.4)] flex items-center justify-center p-2 group-hover:rotate-12 transition-transform duration-500">
               <Award className="w-full h-full text-white" />
            </div>
            <span className="text-sm font-black tracking-[0.2em] font-mono">PORTAL<span className="text-[#00d2ff]">DEPORTIVO</span></span>
          </div>
          <Link href="/admin" className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em] hover:text-white transition-all border border-white/10 px-6 py-2.5 rounded-full bg-white/5 hover:bg-white/10">
            Acceso Organizador
          </Link>
      </nav>

      {/* Hero Section - Elite MTB Style */}
      <header className="relative w-full min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden">
        {/* Banner Background */}
        <div className="absolute inset-0 z-0">
           <img 
            src="https://images.unsplash.com/photo-1444491741275-3747c03c99bd?q=80&w=2574&auto=format&fit=crop" 
            alt="MTB Mountain Sunset" 
            className="w-full h-full object-cover transform scale-105"
           />
           <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-[#0d0e14]"></div>
        </div>

        {/* Floating Featured Event Card (Glassmorphism) */}
        <div className="relative z-10 w-full max-w-5xl px-6 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            
            <div className="flex justify-center mb-8">
               <span className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 text-white/80 text-[10px] font-black px-6 py-2.5 rounded-full uppercase tracking-[0.3em] shadow-2xl">
                 <Sparkles className="w-4 h-4 text-[#00d2ff] animate-pulse" />
                 Bievenido, selecciona el evento de tu interés 🏁
               </span>
            </div>

            {/* Elite Glass Card */}
            <div className="bg-black/40 backdrop-blur-2xl rounded-[40px] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.7)] p-8 sm:p-12 overflow-hidden group">
               <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                  
                  {/* Event Info Left */}
                  <div className="lg:col-span-12 xl:col-span-7 space-y-8">
                     {events.length > 0 && (
                        <>
                          <div className="space-y-4">
                             <h2 className="text-4xl sm:text-7xl font-bold tracking-tighter text-white uppercase italic leading-[0.9] drop-shadow-2xl">
                                {events[0].name}
                             </h2>
                             <p className="text-[#00d2ff] font-mono text-sm tracking-[0.2em] font-bold uppercase opacity-80 decoration-[#00d2ff] underline underline-offset-8 decoration-2">PROFESSIONAL SPORTS EVENTS</p>
                          </div>

                          <div className="flex flex-wrap gap-10">
                             <div className="space-y-1">
                                <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Fecha / Mes</span>
                                <p className="text-3xl font-bold text-white font-mono">{events[0].date || "03 ABR"}</p>
                             </div>
                             <div className="space-y-1">
                                <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Arranque</span>
                                <p className="text-3xl font-bold text-white font-mono">05:00 <span className="text-sm font-normal text-[#00d2ff]">PM</span></p>
                             </div>
                             <div className="space-y-1">
                                <span className="text-[10px] text-white/40 font-black uppercase tracking-widest">Prueba Relevante</span>
                                <p className="text-3xl font-bold text-white font-mono">20 KM</p>
                             </div>
                          </div>

                          <div className="flex items-center gap-8 pt-6">
                            <Link 
                                href={`/register/${events[0].id}`}
                                className="bg-white text-black px-12 py-5 rounded-full text-xs font-black uppercase tracking-[0.2em] hover:bg-[#4b55f5] hover:text-white transition-all shadow-xl flex items-center gap-4 group/btn"
                            >
                                Inscribirme Ahora <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" />
                            </Link>
                            
                            <div className="bg-white p-2 rounded-xl hidden sm:block shadow-2xl">
                                <QrCode className="w-14 h-14 text-black" />
                            </div>
                          </div>
                        </>
                     )}
                  </div>

                  {/* Collage Right */}
                  <div className="lg:col-span-12 xl:col-span-5 grid grid-cols-2 gap-4 h-full min-h-[300px]">
                     <div className="bg-white/5 rounded-3xl overflow-hidden border border-white/5 group-hover:scale-[1.02] transition-transform duration-700">
                        <img src="https://images.unsplash.com/photo-1544191636-236b28906bd3?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Trail" />
                     </div>
                     <div className="bg-white/5 rounded-3xl overflow-hidden border border-white/5 mt-8 group-hover:scale-[1.02] transition-transform duration-700 delay-75">
                        <img src="https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop" className="w-full h-full object-cover" alt="Race" />
                     </div>
                  </div>

               </div>
            </div>
        </div>
      </header>

      {/* Grid de Próximos Eventos */}
      <main className="max-w-[1400px] mx-auto px-6 py-32 relative z-10 space-y-16">
        
        <div className="flex flex-col items-center">
           <h2 className="text-[17px] font-black tracking-[0.4em] text-white uppercase italic border-b-2 border-white mb-12 pb-2">Próximos Eventos</h2>
        </div>

        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-2">
          {events.slice(0).map((evt, index) => (
            <div 
              key={evt.id} 
              className="group relative bg-[#171821] rounded-[48px] border border-white/5 overflow-hidden transition-all duration-700 hover:border-[#4b55f5]/30 hover:shadow-[0_40px_80px_rgba(0,0,0,0.8)]" 
            >
              <div className={`${evt.eventBannerUrl ? 'h-auto min-h-[350px]' : 'aspect-[16/9]'} w-full overflow-hidden relative bg-[#0d0e14] flex items-center justify-center`}>
                 <img 
                    src={evt.eventBannerUrl || "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop"} 
                    alt={evt.name} 
                    className={`w-full h-full ${evt.eventBannerUrl ? 'object-contain' : 'object-cover group-hover:scale-110'} transition-transform duration-[2000ms]`} 
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-[#171821] via-[#171821]/10 to-transparent"></div>
              </div>
              
              <div className="p-10 space-y-8">
                <div className="flex flex-col gap-2">
                   <h3 className="text-3xl sm:text-5xl font-black text-white italic tracking-tighter uppercase leading-none group-hover:text-[#00d2ff] transition-colors">
                      {evt.name}
                   </h3>
                   <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">{evt.date || "Sábado, 03 ABRIL 2026"}</span>
                </div>
                
                <div className="flex gap-4">
                   <Link 
                     href={`/register/${evt.id}`}
                     className="bg-white text-black px-8 py-4 rounded-2xl text-[10px] uppercase tracking-widest font-black hover:bg-[#4b55f5] hover:text-white transition-all shadow-xl"
                   >
                     Inscripción Abierta
                   </Link>
                   <Link 
                     href={`/register/${evt.id}`}
                     className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-2xl text-[10px] uppercase tracking-widest font-black hover:bg-white/10 transition-all shadow-xl"
                   >
                     Más Información
                   </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Experimental Footer */}
      <footer className="w-full text-center py-32 border-t border-white/5 bg-black/40">
        <div className="flex justify-center mb-10">
           <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center">
              <Star className="w-6 h-6 text-[#00d2ff]" />
           </div>
        </div>
        <p className="text-gray-600 text-[11px] font-black uppercase tracking-[0.4em]">Plataforma Deportiva © 2026. <span className="text-white">Elite Ops.</span></p>
      </footer>
    </div>
  );
}

const Star = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L14.5 9H22.5L16 14L18.5 22L12 17L5.5 22L8 14L1.5 9H9.5L12 1Z" /></svg>
);
