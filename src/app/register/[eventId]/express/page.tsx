"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, Loader2, QrCode, Download, Share2, ArrowRight } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase/config";
import { collection, addDoc, serverTimestamp, doc, getDoc, getCountFromServer, query, where, runTransaction } from "firebase/firestore";

export default function ExpressRegisterPage() {
  const params = useParams();
  const eventId = (params?.eventId as string) || "Evento-Test";
  const [eventData, setEventData] = useState<any>(null);
  
  const { register, handleSubmit, formState: { errors } } = useForm<any>();
  const [registrationData, setRegistrationData] = useState<Record<string, any> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

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
      
      const folio = `FOL-${String(folioNumber).padStart(3, '0')}`;

      const docData = {
        ...data,
        eventId,
        folio,
        folioNumber,
        kitName: "Registro Express (Sitio)",
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
      console.error("Error al guardar el registro express:", error);
      alert(`Error crítico de carga: ${error?.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getQrDataUrl = (): string | null => {
    if (!qrCanvasRef.current) return null;
    return qrCanvasRef.current.toDataURL("image/png");
  };

  if (registrationData) {
    return (
      <div className="min-h-screen bg-[#1b1c27] flex flex-col items-center justify-center p-4 py-6 text-white font-sans">
         <div className="bg-[#242636]/60 backdrop-blur-md max-w-lg w-full rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-[#ffffff0a] text-center">
             
             <div className="animate-in slide-in-from-bottom-8 duration-500">
               <div ref={qrRef} className="bg-[#171821] p-8 sm:p-10 rounded-3xl border border-[#ffffff10] shadow-[inset_0_5px_20px_rgba(0,0,0,0.5)] overflow-hidden relative group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff5f6d]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                 
                 <div className="flex justify-center items-center gap-3 mb-8 border-b border-[#ffffff0a] pb-4">
                     <QrCode className="w-5 h-5 text-[#ff5f6d]" />
                     <h3 className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#ff5f6d]">Identificador Oficial</h3>
                 </div>
                 
                 <div className="bg-white p-5 rounded-3xl w-max mx-auto mb-8 shadow-lg shadow-black/50">
                   <QRCodeCanvas 
                     ref={qrCanvasRef as any}
                     value={registrationData.id} 
                     size={220} 
                     bgColor={"#ffffff"} 
                     fgColor={"#000000"} 
                     level={"Q"}
                     includeMargin={false}
                   />
                 </div>
                 
                 <p className="text-[#00d2ff] text-3xl font-bold font-mono tracking-widest uppercase mb-2">{registrationData.folio}</p>
                 <p className="text-gray-200 font-bold uppercase tracking-widest text-lg mb-4">{registrationData.firstName} {registrationData.lastName}</p>
                 
                 <div className="mt-6 bg-[#242636] border border-[#ffffff0a] rounded-xl p-4 inline-flex flex-col sm:flex-row items-center gap-2 max-w-full overflow-hidden">
                   <span className="bg-[#4b55f5] text-white px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest shrink-0">PAQUETE ADQUIRIDO</span>
                   <span className="text-gray-300 font-bold text-sm uppercase tracking-wider truncate">{registrationData.kitName}</span>
                 </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                 <button onClick={() => {
                   const url = getQrDataUrl();
                   if (!url) return;
                   const a = document.createElement("a");
                   a.href = url;
                   a.download = `Gafete-Express-${registrationData.folio}.png`;
                   a.click();
                 }} className="bg-[#242636] hover:bg-[#2c2f42] border border-[#ffffff10] py-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-[#00d2ff]">
                    <Download className="w-5 h-5" />
                    <span className="text-[9px] uppercase font-bold tracking-widest font-mono">Descargar Imagen</span>
                 </button>
                 
                 <button onClick={async () => {
                   const url = getQrDataUrl();
                   if (!url) return;
                   try {
                     const res = await fetch(url);
                     const blob = await res.blob();
                     const file = new File([blob], `QR-${registrationData.folio}.png`, { type: "image/png" });
                     if (navigator.share && navigator.canShare({ files: [file] })) {
                       await navigator.share({ title: "Mi Boleto", files: [file] });
                     } else {
                       const a = document.createElement("a");
                       a.href = url;
                       a.download = `QR-${registrationData.folio}.png`;
                       a.click();
                     }
                   } catch(e) {}
                 }} className="bg-[#242636] hover:bg-[#2c2f42] border border-[#ffffff10] py-4 rounded-2xl flex flex-col items-center justify-center gap-2 text-[#00ff88]">
                    <Share2 className="w-5 h-5" />
                    <span className="text-[9px] uppercase font-bold tracking-widest font-mono">Compartir QR</span>
                 </button>
               </div>
               
                <div className="mt-12 py-8 border-t border-white/5 relative">
                   <button 
                     onClick={() => window.location.reload()}
                     className="w-full bg-gradient-to-r from-[#4b55f5] via-[#884af0] to-[#ff007f] text-white py-5 rounded-2xl font-black text-[13px] uppercase tracking-[0.3em] transition-all shadow-[0_0_40px_rgba(136,74,240,0.4)] hover:shadow-[0_0_60px_rgba(136,74,240,0.6)] hover:scale-[1.03] animate-pulse"
                   >
                     NUEVO REGISTRO EXPRESS
                   </button>
                </div>

             </div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1b1c27] py-12 px-4 sm:px-6 font-sans text-white">
      <div className="w-full max-w-4xl mx-auto space-y-10">
        
        <div className="bg-[#242636]/90 backdrop-blur-md rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-[#ffffff0a] overflow-hidden">
          
          <div className="relative overflow-hidden flex flex-col justify-end">
            <div className="p-8 sm:p-10 relative z-10 w-full h-full">
              <span className="bg-[#ff5f6d]/20 border border-[#ff5f6d]/50 text-[#ff5f6d] text-[11px] lg:text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest mb-6 inline-block shadow-[0_0_15px_rgba(255,95,109,0.4)]">
                <span className="inline-block w-2 h-2 bg-[#ff5f6d] rounded-full mr-2 animate-pulse"></span>
                Staff Only
              </span>
              <h1 className="text-4xl sm:text-5xl font-light tracking-tight mb-4 leading-tight">Registro <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#ff5f6d] to-[#ff9500]">Express en Sitio</span></h1>
              <p className="text-gray-300 max-w-2xl text-[12px] sm:text-sm uppercase tracking-widest font-bold">Alta rápida sin comprobantes</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="relative z-20 p-8 sm:p-12 space-y-10 bg-[#171821]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
              {[
                { id: "firstName", label: "Nombre(s)", type: "text", ph: "Oficial" },
                { id: "lastName", label: "Apellidos", type: "text", ph: "Apellidos" },
                { id: "phone1", label: "Teléfono", type: "tel", ph: "10 dígitos" },
                { id: "phone2", label: "Teléfono de Emergencia", type: "tel", ph: "Contacto" },
                { id: "age", label: "Edad", type: "number", ph: "Años" },
              ].map((input) => (
                <div key={input.id} className="space-y-3">
                  <label className="text-xs uppercase tracking-widest font-bold text-gray-500">{input.label} <span className="text-[#ff5f6d]">*</span></label>
                  <input type={input.type} {...register(input.id)} required className="w-full bg-[#242636] border-[#ffffff10] text-white rounded-xl p-4 border focus:ring-1 focus:ring-[#00d2ff] focus:border-[#00d2ff] font-medium shadow-inner" placeholder={input.ph} />
                </div>
              ))}

              <div className="space-y-3">
                <label className="text-xs uppercase tracking-widest font-bold text-gray-500">Sexo <span className="text-[#ff5f6d]">*</span></label>
                <select {...register("gender")} className="w-full bg-[#242636] border-[#ffffff10] text-white rounded-xl p-4 border focus:ring-1 focus:ring-[#00d2ff] focus:border-[#00d2ff] font-medium shadow-inner appearance-none custom-select">
                  <option value="FEMALE">Mujer</option>
                  <option value="MALE">Hombre</option>
                </select>
              </div>
              
              <div className="space-y-3">
                <label className="text-xs uppercase tracking-widest font-bold text-gray-500">Tipo de Sangre <span className="text-[#ff5f6d]">*</span></label>
                <select {...register("bloodType")} className="w-full bg-[#242636] border-[#ffffff10] text-white rounded-xl p-4 border focus:ring-1 focus:ring-[#00d2ff] focus:border-[#00d2ff] font-medium shadow-inner appearance-none custom-select">
                  <option>O+</option><option>O-</option><option>A+</option><option>A-</option>
                  <option>B+</option><option>B-</option><option>AB+</option><option>AB-</option>
                </select>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5">
               <button 
                 disabled={isSubmitting}
                 type="submit"
                 className="w-full bg-gradient-to-r from-[#00d2ff] to-[#4b55f5] text-white py-5 rounded-2xl font-black text-[13px] uppercase tracking-[0.3em] transition-all shadow-[0_0_30px_rgba(75,85,245,0.4)] hover:shadow-[0_0_50px_rgba(75,85,245,0.6)] flex items-center justify-center gap-3"
               >
                 {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> GUARDAR Y GENERAR FOLIO</>}
               </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
