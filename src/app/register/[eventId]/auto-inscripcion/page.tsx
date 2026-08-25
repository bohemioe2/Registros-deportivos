"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase/config";
import { collection, addDoc, serverTimestamp, doc, getDoc, getCountFromServer, query, where, runTransaction } from "firebase/firestore";

export default function AutoInscripcionPage() {
  const params = useParams();
  const eventId = (params?.eventId as string) || "Evento-Test";
  const [eventData, setEventData] = useState<any>(null);
  
  const { register, handleSubmit, formState: { errors }, watch, reset } = useForm<any>();
  const [registrationData, setRegistrationData] = useState<Record<string, any> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ageValue = watch("age");
  const isMinor = ageValue && parseInt(ageValue) < 18;

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const docRef = doc(db, "events", eventId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setEventData(docSnap.data());
        }
      } catch (e) {
        console.error("Error fetching event data", e);
      }
    };
    if (eventId && eventId !== "Evento-Test") {
      fetchEvent();
    }
  }, [eventId]);

  const responsivaText = eventData?.responsivaAutoInscripcion || "El comité organizador de la RODADA REMEDIOS 2026 no se hace responsable por ningún daño o perjuicio. Al aceptar, declaro que participo y ruedo bajo mi propia voluntad y riesgo.";

  const onSubmit = async (data: Record<string, any>) => {
    setIsSubmitting(true);
    try {
      // Transaction to get the next Folio
      const counterRef = doc(db, "eventCounters", eventId);
      let fallbackCount = 0;
      try {
         const counterSnap = await getDoc(counterRef);
         if (!counterSnap.exists()) {
             const queryFolio = query(collection(db, "registrations"), where("eventId", "==", eventId));
             const folioSnapshot = await getCountFromServer(queryFolio);
             fallbackCount = folioSnapshot.data().count;
         }
      } catch(e) {}

      const folioNumber = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let nextCount = 1;
        if (counterDoc.exists()) {
          nextCount = (counterDoc.data().count || 0) + 1;
        } else {
          nextCount = fallbackCount + 1;
        }
        transaction.set(counterRef, { count: nextCount }, { merge: true });
        return nextCount;
      });
      
      const folio = `${folioNumber}`; // Sin ceros a la izquierda

      const docData = {
        ...data,
        eventId,
        folio,
        folioNumber,
        firstName: data.fullName,
        lastName: "",
        kitName: "Registro Auto-inscripción",
        kitPricePaid: 0,
        jerseyType: "N/A",
        jerseySize: "N/A",
        status: "APPROVED",
        checkedInAt: new Date().toISOString(), // Automatically checked in
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "registrations"), docData);

      setRegistrationData({...docData, id: docRef.id});
    } catch (error: any) {
      console.error("Error al guardar el registro de auto-inscripción:", error);
      alert(`Error crítico de carga: ${error?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setRegistrationData(null);
    reset();
  };

  if (registrationData) {
    return (
      <div className="min-h-screen bg-[#1b1c27] flex flex-col items-center justify-center p-4 py-6 text-white font-sans selection:bg-[#00d2ff] selection:text-black">
         <div className="bg-[#242636]/80 backdrop-blur-md max-w-2xl w-full rounded-3xl p-10 sm:p-16 shadow-[0_20px_60px_rgba(0,0,0,0.6)] border border-[#ffffff0a] text-center flex flex-col items-center animate-in zoom-in-95 duration-500">
             <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(34,197,94,0.3)]">
                <CheckCircle2 className="w-12 h-12 text-green-400" />
             </div>
             
             <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight text-white mb-4">
               ¡REGISTRO EXITOSO!
             </h1>
             
             <p className="text-gray-400 text-lg uppercase tracking-widest font-bold mb-10">Pide en mesa de registro tu número de dorsal:</p>
             
             <div className="bg-[#171821] border border-[#ffffff10] rounded-3xl px-16 py-10 mb-12 shadow-inner">
               <span className="text-[120px] sm:text-[180px] font-black text-transparent bg-clip-text bg-gradient-to-br from-[#00d2ff] to-[#4b55f5] leading-none tracking-tighter">
                 {registrationData.folio}
               </span>
             </div>
             
             <button 
               onClick={handleReset}
               className="w-full sm:w-auto px-12 py-6 bg-gradient-to-r from-[#4b55f5] to-[#ff007f] hover:from-[#5b65f5] hover:to-[#ff1a8c] text-white rounded-2xl font-black text-xl sm:text-2xl uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(75,85,245,0.4)] hover:shadow-[0_0_50px_rgba(75,85,245,0.6)] hover:scale-105 active:scale-95 flex items-center justify-center gap-4"
             >
               <RotateCcw className="w-8 h-8" /> SIGUIENTE PARTICIPANTE
             </button>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1b1c27] flex items-center justify-center p-4 sm:p-8 font-sans text-white">
      <div className="w-full max-w-3xl space-y-8 animate-in fade-in duration-500">
        
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl sm:text-6xl font-black uppercase tracking-tight leading-tight">
            Auto <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] to-[#4b55f5]">Inscripción</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-lg uppercase tracking-[0.2em] font-bold">Bienvenido a {eventData?.name || "la rodada"}</p>
        </div>

        <div className="bg-[#242636]/90 backdrop-blur-md rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-[#ffffff0a] overflow-hidden">
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 sm:p-12 space-y-8">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm uppercase tracking-widest font-black text-gray-400">Nombre Completo <span className="text-[#ff5f6d]">*</span></label>
                <input 
                  type="text" 
                  {...register("fullName", { required: true })} 
                  className="w-full bg-[#171821] border border-[#ffffff10] text-white rounded-2xl p-5 sm:p-6 text-xl font-medium focus:ring-2 focus:ring-[#00d2ff] focus:border-[#00d2ff] transition-all shadow-inner" 
                  placeholder="Tu nombre y apellidos" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-sm uppercase tracking-widest font-black text-gray-400">Teléfono <span className="text-[#ff5f6d]">*</span></label>
                  <input 
                    type="tel" 
                    {...register("phone", { required: true })} 
                    className="w-full bg-[#171821] border border-[#ffffff10] text-white rounded-2xl p-5 sm:p-6 text-xl font-medium focus:ring-2 focus:ring-[#00d2ff] focus:border-[#00d2ff] transition-all shadow-inner" 
                    placeholder="10 dígitos" 
                  />
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm uppercase tracking-widest font-black text-gray-400">Edad <span className="text-[#ff5f6d]">*</span></label>
                  <input 
                    type="number" 
                    {...register("age", { required: true })} 
                    className="w-full bg-[#171821] border border-[#ffffff10] text-white rounded-2xl p-5 sm:p-6 text-xl font-medium focus:ring-2 focus:ring-[#00d2ff] focus:border-[#00d2ff] transition-all shadow-inner" 
                    placeholder="Años" 
                    min="1"
                    max="100"
                  />
                </div>
              </div>
              
              {isMinor && (
                <div className="p-6 sm:p-8 mt-6 bg-[#ff9500]/10 border border-[#ff9500]/30 rounded-2xl animate-in slide-in-from-top-4 duration-300">
                  <h3 className="text-[#ff9500] font-black uppercase tracking-widest mb-6 text-lg flex items-center gap-3">
                    <span className="bg-[#ff9500] text-black w-8 h-8 rounded-full flex items-center justify-center text-xl">!</span>
                    Datos de Adulto Responsable
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-sm uppercase tracking-widest font-black text-gray-400">Nombre del Adulto <span className="text-[#ff5f6d]">*</span></label>
                      <input 
                        type="text" 
                        {...register("adultName", { required: true })} 
                        className="w-full bg-[#171821] border border-[#ff9500]/30 text-white rounded-2xl p-5 text-lg font-medium focus:ring-2 focus:ring-[#ff9500] focus:border-[#ff9500] transition-all shadow-inner" 
                        placeholder="Nombre completo" 
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-sm uppercase tracking-widest font-black text-gray-400">Teléfono del Adulto <span className="text-[#ff5f6d]">*</span></label>
                      <input 
                        type="tel" 
                        {...register("adultPhone", { required: true })} 
                        className="w-full bg-[#171821] border border-[#ff9500]/30 text-white rounded-2xl p-5 text-lg font-medium focus:ring-2 focus:ring-[#ff9500] focus:border-[#ff9500] transition-all shadow-inner" 
                        placeholder="10 dígitos" 
                      />
                    </div>
                  </div>
                </div>
              )}
              
              <div className="pt-8 border-t border-white/5">
                <label className="flex items-start gap-4 p-6 sm:p-8 bg-[#171821] border border-[#ffffff10] hover:border-[#00d2ff]/50 rounded-2xl cursor-pointer transition-all group">
                  <div className="pt-1 shrink-0">
                    <input 
                      type="checkbox" 
                      {...register("responsivaAccepted", { required: true })}
                      className="w-8 h-8 sm:w-10 sm:h-10 accent-[#00d2ff] bg-[#242636] border-[#ffffff30] rounded-xl cursor-pointer" 
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-lg sm:text-xl font-black uppercase tracking-widest text-white group-hover:text-[#00d2ff] transition-colors">Aceptar Responsiva <span className="text-[#ff5f6d]">*</span></span>
                    <p className="text-sm sm:text-base text-gray-400 font-medium leading-relaxed">
                      {responsivaText}
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-4">
               <button 
                 disabled={isSubmitting}
                 type="submit"
                 className="w-full bg-gradient-to-r from-[#00d2ff] to-[#4b55f5] disabled:opacity-50 disabled:cursor-not-allowed text-white py-6 sm:py-8 rounded-2xl font-black text-xl sm:text-2xl uppercase tracking-[0.2em] transition-all shadow-[0_0_30px_rgba(75,85,245,0.4)] hover:shadow-[0_0_50px_rgba(75,85,245,0.6)] hover:scale-[1.02] flex items-center justify-center gap-4"
               >
                 {isSubmitting ? <Loader2 className="w-8 h-8 animate-spin" /> : <><CheckCircle2 className="w-8 h-8" /> INSCRIBIRME AHORA</>}
               </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
