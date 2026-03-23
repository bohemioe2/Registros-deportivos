"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { MapPin, Trophy, Calendar, ClipboardCheck } from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

export default function FinishRegistrationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const eventId = params.eventId as string;
  const firstName = searchParams.get("name") || "Corredor";
  
  const [eventData, setEventData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const d = await getDoc(doc(db, "events", eventId));
        if (d.exists()) setEventData(d.data());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1b1c27] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#4b55f5]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1b1c27] text-white p-4 py-8 flex flex-col items-center">
      <div className="max-w-md w-full space-y-8 animate-in fade-in zoom-in duration-700">
        
        {/* Header Triunfal */}
        <div className="text-center space-y-4">
           <div className="w-24 h-24 mx-auto bg-gradient-to-tr from-yellow-400 via-orange-500 to-red-500 rounded-full flex items-center justify-center p-1 shadow-[0_0_50px_rgba(245,158,11,0.3)]">
              <div className="w-full h-full bg-[#1b1c27] rounded-full flex items-center justify-center">
                 <Trophy className="w-12 h-12 text-yellow-400" />
              </div>
           </div>
           <h1 className="text-3xl font-black uppercase tracking-tighter leading-none italic">
              ¡ÉXITO EN EL EVENTO, <span className="text-yellow-400 block mt-2">{firstName}</span>!
           </h1>
           <div className="h-1 w-20 bg-yellow-400 mx-auto rounded-full" />
        </div>

        {/* Card de Logística */}
        <div className="bg-[#242636]/60 backdrop-blur-xl border border-[#ffffff0a] rounded-3xl p-6 shadow-2xl space-y-8">
           
           {/* Ubicación */}
           <div className="space-y-4">
              <div className="flex items-center gap-3 text-[#00d2ff]">
                 <MapPin className="w-5 h-5" />
                 <h3 className="text-xs font-black uppercase tracking-widest">Ubicación del Evento</h3>
              </div>
              <div className="bg-[#171821] p-4 rounded-2xl border border-[#ffffff05]">
                 <p className="text-sm text-gray-300 font-medium leading-relaxed mb-4">
                    {eventData?.locationText || "La ubicación exacta será compartida próximamente por el comité organizador."}
                 </p>
                 {eventData?.locationUrl && (
                    <a 
                      href={eventData.locationUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[#00d2ff] hover:bg-[#00b2dd] text-[#1b1c27] px-6 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-lg w-full justify-center"
                    >
                      <MapPin className="w-4 h-4" /> Abrir en Google Maps
                    </a>
                 )}
              </div>
           </div>

           {/* Detalles Finales */}
           <div className="space-y-4">
              <div className="flex items-center gap-3 text-[#bb86fc]">
                 <ClipboardCheck className="w-5 h-5" />
                 <h3 className="text-xs font-black uppercase tracking-widest">Recomendaciones Finales</h3>
              </div>
              <div className="bg-[#171821] p-5 rounded-2xl border border-[#ffffff05]">
                 <p className="text-sm text-gray-400 leading-relaxed font-medium whitespace-pre-wrap">
                    {eventData?.finalInstructions || "No olvides llevar tu QR digital en tu celular para la mesa de registro el día del evento."}
                 </p>
              </div>
           </div>

           {/* Fecha */}
           <div className="flex items-center justify-center gap-3 text-gray-500 pt-4 border-t border-[#ffffff0a]">
              <Calendar className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Mundo Deportivo 2026</span>
           </div>

        </div>

        <button 
           onClick={() => router.push('/')}
           className="w-full text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-colors py-4"
        >
           ← Volver al Inicio
        </button>

      </div>
    </div>
  );
}
