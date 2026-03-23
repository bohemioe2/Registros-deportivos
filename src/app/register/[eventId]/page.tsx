"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { UploadCloud, CheckCircle2, Loader2, Award, QrCode, Download, Printer, Share2, ArrowRight } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useParams, useRouter } from "next/navigation";
import WelcomePoster from "@/components/public/WelcomePoster";
import { db, storage } from "@/lib/firebase/config";
import { collection, addDoc, serverTimestamp, doc, getDoc, getCountFromServer, query, where } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import mexicoDataRaw from "@/lib/mexico.json";

const mexicoData = mexicoDataRaw as Record<string, string[]>;

export default function RegisterFormPage() {
  const params = useParams();
  const eventId = (params?.eventId as string) || "Evento-Test";
  const [showQrStep, setShowQrStep] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const getQrDataUrl = (): string | null => {
    if (!qrCanvasRef.current) return null;
    return qrCanvasRef.current.toDataURL("image/png");
  };

  const buildGafeteCanvas = async (): Promise<string | null> => {
    const qrUrl = getQrDataUrl();
    if (!qrUrl) return null;
    if (!registrationData) return null;

    const W = 600, H = 750;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return null;

    // Background
    ctx.fillStyle = "#171821";
    ctx.roundRect(0, 0, W, H, 28);
    ctx.fill();

    // Top accent bar
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#00d2ff");
    grad.addColorStop(1, "#4b55f5");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 5);

    // Event name
    ctx.fillStyle = "#888";
    ctx.font = "bold 13px 'Helvetica Neue', Arial, sans-serif";
    ctx.letterSpacing = "4px";
    ctx.textAlign = "center";
    ctx.fillText((eventData?.name || "EVENTO").toUpperCase(), W / 2, 52);

    // Divider
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40, 70); ctx.lineTo(W - 40, 70); ctx.stroke();

    // QR image
    const qrImg = new Image();
    await new Promise<void>(res => { qrImg.onload = () => res(); qrImg.src = qrUrl; });
    const qrSize = 260;
    const qrX = (W - qrSize) / 2;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.roundRect(qrX - 16, 90, qrSize + 32, qrSize + 32, 20); ctx.fill();
    ctx.drawImage(qrImg, qrX, 106, qrSize, qrSize);

    // Folio
    ctx.fillStyle = "#00d2ff";
    ctx.font = "bold 36px 'Helvetica Neue', Arial, sans-serif";
    ctx.letterSpacing = "6px";
    ctx.textAlign = "center";
    ctx.fillText((registrationData.folio || "").toUpperCase(), W / 2, 430);

    // Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px 'Helvetica Neue', Arial, sans-serif";
    ctx.letterSpacing = "2px";
    ctx.fillText(`${registrationData.firstName} ${registrationData.lastName}`.toUpperCase(), W / 2, 472);

    // Kit badge
    if (registrationData.kitName) {
      const badge = (registrationData.kitName as string).toUpperCase();
      ctx.font = "bold 13px 'Helvetica Neue', Arial, sans-serif";
      ctx.letterSpacing = "2px";
      const tw = ctx.measureText(badge).width + 48;
      const bx = (W - tw) / 2;
      ctx.fillStyle = "#4b55f5";
      ctx.beginPath(); ctx.roundRect(bx, 496, tw, 36, 10); ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(badge, W / 2, 520);
    }

    // Footer hint
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "bold 11px 'Helvetica Neue', Arial, sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillText("MUESTRA ESTE C\u00d3DIGO EN MESA DE REGISTRO", W / 2, H - 32);

    return c.toDataURL("image/png");
  };

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<any>({
    defaultValues: {
      acceptTerms: false
    }
  });
  const [registrationData, setRegistrationData] = useState<Record<string, any> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eventData, setEventData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const docRef = doc(db, "events", eventId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setEventData(docSnap.data());
        }
      } catch (e) {
        console.error("No se pudo obtener la info del evento para el poster:", e);
      }
    };
    if (eventId && eventId !== "Evento-Test") {
      fetchEvent();
    }
  }, [eventId]);

  const selectedState = watch("state");
  const municipalities = selectedState ? mexicoData[selectedState] || [] : [];
  
  const selectedKitName = watch("kitSelection");
  const selectedKitDef = eventData?.kits?.find((k:any) => k.name === selectedKitName);

  useEffect(() => {
    setValue("muni", "");
  }, [selectedState, setValue]);

  const onSubmit = async (data: Record<string, any>) => {
    if (!data.acceptTerms) {
      alert("Es obligatorio aceptar los términos y condiciones de la responsiva para continuar.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Cálculo del Folio Secuencial
      const queryFolio = query(collection(db, "registrations"), where("eventId", "==", eventId));
      const folioSnapshot = await getCountFromServer(queryFolio);
      const folioNumber = folioSnapshot.data().count + 1;
      const folio = `FOL-${String(folioNumber).padStart(3, '0')}`;
      
      // Función con límite de tiempo para evitar cuellos de botella infinitos en Firebase Storage
      const safeUpload = async (uploadPromise: Promise<any>, errorMsg: string) => {
        return Promise.race([
          uploadPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${errorMsg}`)), 15000))
        ]);
      };

      const uploadFileContent = async (fileList: any[], path: string) => {
        if (!fileList || !fileList[0]) return null;
        const fileRef = ref(storage, path);
        await safeUpload(uploadBytes(fileRef, fileList[0]), "El archivo es muy pesado o el Storage está inactivo.");
        return await getDownloadURL(fileRef);
      };

      const paymentUrl = await uploadFileContent(data.docs_payment, `registrations/${eventId}/${folio}/payment`);
      const photoUrl = await uploadFileContent(data.docs_photo, `registrations/${eventId}/${folio}/photo`);
      const logoUrl = await uploadFileContent(data.docs_logo, `registrations/${eventId}/${folio}/logo`);
      const idUrl = await uploadFileContent(data.docs_id, `registrations/${eventId}/${folio}/id_document`);

      const {
        docs_payment,
        docs_photo,
        docs_logo,
        docs_id,
        ...restData
      } = data;

      const docData = {
        ...restData,
        eventId,
        folio,
        folioNumber,
        paymentUrl,
        photoUrl,
        logoUrl,
        idUrl,
        kitName: eventData?.kitsEnabled && data.kitSelection ? data.kitSelection : "Plan Base",
        kitPricePaid: eventData?.kitsEnabled && selectedKitDef ? (selectedKitDef.price || 0) : 0,
        jerseyType: eventData?.kitsEnabled && selectedKitDef?.includesJersey ? (data.jerseyType || "N/A") : "N/A",
        jerseySize: eventData?.kitsEnabled && selectedKitDef?.includesJersey ? (data.jerseySize || "N/A") : "N/A",
        status: "PENDING", 
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "registrations"), docData);

      setRegistrationData({...docData, id: docRef.id});
    } catch (error: any) {
      console.error("Error al guardar el registro:", error);
      alert(`Error crítico de carga: ${error?.message || "Revisa si activaste Firebase Storage en tu consola de Firebase."}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (registrationData) {
    return (
      <div className={`min-h-screen bg-[#1b1c27] flex flex-col items-center justify-center p-4 py-6 text-white`}>
         <div className={`bg-[#242636]/60 backdrop-blur-md max-w-lg w-full rounded-3xl p-4 sm:p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-[#ffffff0a] mb-6 text-center transition-all duration-300`}>
             {!showQrStep ? (
             <div className="animate-in fade-in zoom-in duration-500">
               <WelcomePoster 
                 folio={registrationData.folio}
                 name={`${registrationData.firstName} ${registrationData.lastName}`}
                 eventName={eventData?.name || eventId.replace(/-/g, ' ')}
                 category={registrationData.gender === 'MALE' ? 'Varonil' : 'Femenil'} 
                 photoUrl={registrationData.photoUrl}
                 logoUrl={registrationData.logoUrl}
                 posterTemplateUrl={eventData?.posterTemplateUrl}
                 originState={registrationData.state}
                 posterFontFamily={eventData?.posterFontFamily}
                 posterColorFolio={eventData?.posterColorFolio}
                 posterColorName={eventData?.posterColorName}
                 posterColorState={eventData?.posterColorState}
                 posterColorWelcome={eventData?.posterColorWelcome}
                 showFolioOnPoster={eventData?.showFolioOnPoster !== false}
                 gender={registrationData.gender}
                 registrationId={registrationData.id}
                 eventId={eventId}
               />
               
               <button 
                  onClick={() => setShowQrStep(true)} 
                  className="w-full mt-8 bg-gradient-to-r from-[#00d2ff] to-[#4b55f5] text-white font-bold text-sm tracking-widest uppercase py-5 rounded-2xl hover:scale-105 transition-transform shadow-[0_0_30px_rgba(75,85,245,0.4)] flex items-center justify-center gap-3 animate-pulse"
               >
                  Ver Código QR de Acceso <ArrowRight className="w-5 h-5" />
               </button>
             </div>
           ) : (
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
                 <p className="text-gray-200 font-bold uppercase tracking-widest text-lg">{registrationData.firstName} {registrationData.lastName}</p>
                 
                 {registrationData.kitName && (
                   <div className="mt-6 bg-[#242636] border border-[#ffffff0a] rounded-xl p-4 inline-flex flex-col sm:flex-row items-center gap-2 max-w-full overflow-hidden">
                     <span className="bg-[#4b55f5] text-white px-3 py-1 rounded text-[10px] font-bold uppercase tracking-widest shrink-0">PAQUETE ADQUIRIDO</span>
                     <span className="text-gray-300 font-bold text-sm uppercase tracking-wider truncate">{registrationData.kitName}</span>
                   </div>
                 )}
               </div>
               
               {/* ACTION BUTTONS GRID */}
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                 
                 {/* === DESCARGAR === */}
                 <button onClick={async () => {
                   const url = await buildGafeteCanvas();
                   if (!url) return alert("QR aún cargando, intenta en un segundo.");
                   const a = document.createElement("a");
                   a.href = url;
                   a.download = `Gafete-${registrationData.folio}.png`;
                   a.click();
                 }} className="bg-[#242636] hover:bg-[#2c2f42] border border-[#ffffff10] py-4 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all text-[#00d2ff]">
                    <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] uppercase font-bold tracking-widest font-mono">Descargar Imagen</span>
                 </button>
                 
                 {/* === COMPARTIR === */}
                 <button onClick={async () => {
                   const url = getQrDataUrl();
                   if (!url) return alert("QR aún cargando, intenta en un segundo.");
                   try {
                     const res = await fetch(url);
                     const blob = await res.blob();
                     const file = new File([blob], `QR-${registrationData.folio}.png`, { type: "image/png" });
                     if (navigator.share && navigator.canShare({ files: [file] })) {
                       await navigator.share({ title: "Mi Boleto de Acceso", text: "Aquí está mi QR de acceso oficial.", files: [file] });
                     } else {
                       const a = document.createElement("a");
                       a.href = url;
                       a.download = `QR-${registrationData.folio}.png`;
                       a.click();
                       alert("Tu navegador no soporta compartir directo. La imagen se descargó — envíala por WhatsApp manualmente.");
                     }
                   } catch(e) {}
                 }} className="bg-[#242636] hover:bg-[#2c2f42] border border-[#ffffff10] py-4 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all text-[#00ff88]">
                    <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] uppercase font-bold tracking-widest font-mono">Compartir WhatsApp</span>
                 </button>
                 
                 {/* === IMPRIMIR === */}
                 <button onClick={() => {
                   const url = getQrDataUrl();
                   if (!url) return alert("QR aún cargando, intenta en un segundo.");
                   const kitBadge = registrationData.kitName ? `<div style="margin-top:12px;background:#4b55f5;color:white;display:inline-block;padding:6px 14px;border-radius:8px;font-size:11px;font-weight:800;letter-spacing:0.15em;text-transform:uppercase">${registrationData.kitName}</div>` : "";
                   const newWin = window.open("", "_blank");
                   newWin?.document.write(`
                     <html><head><title>Gafete QR — ${registrationData.folio}</title>
                     <style>@page{margin:10mm} body{font-family:'Helvetica Neue',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;min-height:100vh;margin:0;padding:20px;color:#111;text-align:center}</style></head>
                     <body>
                       <div style="border:2px solid #000;border-radius:20px;padding:30px 40px;max-width:360px;width:100%">
                         <p style="font-size:10px;font-weight:800;letter-spacing:0.3em;text-transform:uppercase;color:#666;margin:0 0 12px">${eventData?.name || "Evento"}</p>
                         <img src="${url}" style="width:220px;height:220px;display:block;margin:0 auto 16px" />
                         <p style="font-size:26px;font-weight:900;letter-spacing:0.15em;color:#000;margin:0">${registrationData.folio}</p>
                         <p style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#333;margin:8px 0 0">${registrationData.firstName} ${registrationData.lastName}</p>
                         ${kitBadge}
                       </div>
                       <script>window.onload=()=>{setTimeout(()=>{window.print();window.close()},300)}<\/script>
                     </body></html>
                   `);
                   newWin?.document.close();
                 }} className="bg-[#242636] hover:bg-[#2c2f42] border border-[#ffffff10] py-4 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all text-white">
                    <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] uppercase font-bold tracking-widest font-mono">Imprimir Gafete</span>
                 </button>
               </div>
                              
                {/* BACK DISCREET BUTTON */}
                <div className="mt-8 pt-6 border-t border-[#ffffff0a]">
                  <button 
                    onClick={() => setShowQrStep(false)}
                    className="text-gray-500 hover:text-white text-[11px] uppercase font-bold tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
                  >
                    ← Volver a mi Póster de Bienvenida
                  </button>
                </div>
              </div>
            )}
          </div>
         
         <button onClick={() => router.push('/')} className="text-gray-500 text-[11px] uppercase tracking-[0.2em] font-bold hover:text-white transition-colors px-6 py-2 mt-4 flex items-center gap-2">
           Volver al Panel Central
         </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1b1c27] py-12 px-4 sm:px-6 font-sans text-white">
      <div className="w-full max-w-[1400px] mx-auto space-y-10">
        
        {/* Contenedor Principal Absoluto */}
        <div className="bg-[#242636]/90 backdrop-blur-md rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-[#ffffff0a] overflow-hidden">
          
          {/* Header Hero Section Exclusiva */}
          <div className="relative overflow-hidden flex flex-col justify-end min-h-[400px]">
            {/* Arte Fotográfico Embebido */}
            <div className="absolute inset-0 z-0">
               <img src="/emtb-hero.png" alt="Specialized E-MTB Preview" className="w-full h-full object-cover mix-blend-screen opacity-60 scale-105" />
               <div className="absolute inset-0 bg-gradient-to-t from-[#242636]/90 via-[#242636]/40 to-transparent"></div>
            </div>
            
            <div className="p-8 sm:p-12 sm:pt-40 relative z-10 w-full h-full">
              <span className="bg-[#4b55f5]/20 border border-[#4b55f5]/50 text-[#00d2ff] text-[11px] lg:text-sm font-bold px-4 py-1.5 rounded-full uppercase tracking-widest mb-6 inline-block shadow-[0_0_15px_rgba(75,85,245,0.4)]">
                <span className="inline-block w-2 h-2 bg-[#00d2ff] rounded-full mr-2 animate-pulse"></span>
                Inscripción Abierta
              </span>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-light tracking-tight mb-4 leading-tight">Portal de <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] to-[#4b55f5]">Registro</span></h1>
              <p className="text-gray-300 max-w-2xl text-[12px] sm:text-sm lg:text-base uppercase tracking-widest font-bold">Iniciando protocolo de suscripción: {eventId}</p>
            </div>
          </div>
          
          {/* Instrucciones de Pago */}
          <div className="relative z-20 bg-[#171821] border-y border-[#ffffff0a] p-6 sm:px-12 flex flex-col sm:flex-row gap-6 items-start">
            <div className="bg-[#4b55f5]/10 p-3.5 rounded-full shrink-0 shadow-inner border border-[#4b55f5]/30">
               <Award className="w-5 h-5 text-[#4b55f5]" />
            </div>
            <div>
              <h3 className="font-bold text-white tracking-widest uppercase text-sm lg:text-base mb-3">Instrucciones de Pago</h3>
              <p className="text-sm lg:text-base text-gray-400 leading-relaxed font-medium">
                Realiza el pago de tu inscripción a la cuenta CLABE: <strong className="text-[#00d2ff] bg-[#00d2ff]/10 px-3 py-1 pb-1.5 rounded tracking-widest text-base lg:text-lg">01234567890123</strong>. 
                Conserva tu recibo de pago, ya que lo necesitarás para subirlo a la plataforma en la sección de anexos.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="relative z-20 p-8 sm:p-12 space-y-14 bg-[#242636]/90">
            
            <section className="space-y-8">
              <h2 className="text-base lg:text-lg font-bold border-b border-[#ffffff10] pb-5 text-white uppercase tracking-widest flex items-center gap-4">
                <span className="bg-gradient-to-br from-[#4b55f5] to-[#884af0] text-white w-8 h-8 rounded-md flex items-center justify-center text-sm shadow-[0_0_15px_rgba(75,85,245,0.4)]">1</span> 
                Identificación Personal
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                {[
                  { id: "firstName", label: "Nombre(s)", type: "text", ph: "Tu nombre oficial" },
                  { id: "lastName", label: "Apellidos", type: "text", ph: "Ambos apellidos" },
                  { id: "email", label: "Correo Electrónico", type: "email", ph: "Recepción de folio y comprobantes", colSpan: 2 },
                  { id: "age", label: "Edad", type: "number", ph: "Años cumplidos" },
                  { id: "phone1", label: "Teléfono", type: "tel", ph: "10 dígitos" },
                  { id: "phone2", label: "Teléfono Adicional", type: "tel", ph: "Emergencias" },
                ].map((input) => (
                  <div key={input.id} className={`space-y-3 ${input.colSpan ? 'md:col-span-2' : ''}`}>
                    <label className="text-xs lg:text-sm uppercase tracking-widest font-bold text-gray-500">{input.label} <span className="text-[#ff5f6d]">*</span></label>
                    <input type={input.type} {...register(input.id)} required className="w-full bg-[#171821] border-[#ffffff10] text-gray-200 placeholder-gray-600 rounded-xl p-4 border focus:ring-1 focus:ring-[#00d2ff] focus:border-[#00d2ff] text-base font-medium transition-all shadow-inner" placeholder={input.ph} />
                  </div>
                ))}

                <div className="space-y-3">
                  <label className="text-xs lg:text-sm uppercase tracking-widest font-bold text-gray-500">Sexo <span className="text-[#ff5f6d]">*</span></label>
                  <select {...register("gender")} className="w-full bg-[#171821] border-[#ffffff10] text-gray-200 rounded-xl p-4 border focus:ring-1 focus:ring-[#00d2ff] focus:border-[#00d2ff] text-base font-medium transition-all shadow-inner appearance-none custom-select">
                    <option value="FEMALE">Mujer</option>
                    <option value="MALE">Hombre</option>
                  </select>
                </div>
                
                <div className="space-y-3">
                  <label className="text-xs lg:text-sm uppercase tracking-widest font-bold text-gray-500">Riesgo / Sangre <span className="text-[#ff5f6d]">*</span></label>
                  <select {...register("bloodType")} className="w-full bg-[#171821] border-[#ffffff10] text-gray-200 rounded-xl p-4 border focus:ring-1 focus:ring-[#00d2ff] focus:border-[#00d2ff] text-base font-medium transition-all shadow-inner appearance-none custom-select">
                    <option>O+</option><option>O-</option><option>A+</option><option>A-</option>
                    <option>B+</option><option>B-</option><option>AB+</option><option>AB-</option>
                  </select>
                </div>
                
                <div className="space-y-3">
                  <label className="text-xs lg:text-sm uppercase tracking-widest font-bold text-gray-500">Estado de Procedencia <span className="text-[#ff5f6d]">*</span></label>
                  <select {...register("state")} required className="w-full bg-[#171821] border-[#ffffff10] text-gray-200 rounded-xl p-4 border focus:ring-1 focus:ring-[#00d2ff] focus:border-[#00d2ff] text-base font-medium transition-all shadow-inner appearance-none custom-select">
                    <option value="">Selección Requerida...</option>
                    {Object.keys(mexicoData).map(estado => (
                      <option key={estado} value={estado}>{estado}</option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-3 md:col-span-2">
                  <label className="text-xs lg:text-sm uppercase tracking-widest font-bold text-gray-500">Municipio <span className="text-[#ff5f6d]">*</span></label>
                  <select {...register("muni")} required disabled={!selectedState} className="w-full bg-[#171821] border-[#ffffff10] text-gray-200 rounded-xl p-4 border focus:ring-1 focus:ring-[#00d2ff] focus:border-[#00d2ff] text-base font-medium transition-all shadow-inner disabled:cursor-not-allowed disabled:bg-[#1b1c27] disabled:text-gray-600 appearance-none custom-select">
                    <option value="">{selectedState ? "Desplegar Sectores..." : "Esperando Sede State..."}</option>
                    {municipalities.map((muni: string) => (
                      <option key={muni} value={muni}>{muni}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* --- SECCIÓN INTEGRADA PARA MONETIZACIÓN KITS Y UPSALES --- */}
            {eventData?.kitsEnabled && eventData?.kits && eventData.kits.length > 0 && (
               <section className="space-y-8 bg-black/20 p-6 sm:p-10 -mx-6 sm:-mx-10 rounded-3xl border-y border-[#ffffff0a] shadow-inner relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[#00d2ff]/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                 <h2 className="text-base lg:text-lg font-bold border-b border-[#ffffff10] pb-5 text-white uppercase tracking-widest flex items-center gap-4 relative z-10">
                   <span className="bg-gradient-to-br from-[#00d2ff] to-[#4b55f5] text-white w-8 h-8 rounded-md flex items-center justify-center text-sm shadow-[0_0_15px_rgba(0,210,255,0.4)]">2</span> 
                   Selección de Paquete (Kit)
                 </h2>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                   {eventData.kits.map((kit: any, idx: number) => {
                     const isSelected = selectedKitName === kit.name;
                     return (
                     <label key={idx} className={`relative rounded-2xl border cursor-pointer transition-all flex flex-col group overflow-hidden ${isSelected ? 'border-[#00d2ff] bg-[#00d2ff]/10 shadow-[0_0_30px_rgba(0,210,255,0.15)]' : 'border-[#ffffff10] bg-[#1a1c23] hover:border-[#ffffff30] hover:bg-[#242636]'}`}>
                       
                       {kit.imageUrl && (
                         <div className="w-full relative overflow-hidden bg-[#171821] border-b border-[#ffffff10] shrink-0 flex justify-center py-6">
                           <img src={kit.imageUrl} alt={kit.name} className="w-1/2 h-auto object-contain group-hover:scale-110 transition-transform duration-500 filter drop-shadow-2xl" />
                           <div className="absolute inset-0 bg-gradient-to-t from-[#1a1c23] via-transparent to-transparent pointer-events-none"></div>
                         </div>
                       )}
                       
                       <div className="p-6 flex-1 flex flex-col relative z-10">
                         {isSelected && <div className="absolute top-0 right-0 w-16 h-16 bg-[#00d2ff]/20 blur-xl pointer-events-none rounded-bl-full"></div>}
                         <div className="flex justify-between items-start mb-4">
                           <div className="flex items-center gap-3">
                             <input type="radio" value={kit.name} {...register("kitSelection", { required: true })} className="w-5 h-5 accent-[#00d2ff] bg-black border-[#ffffff30]" />
                             <h3 className={`text-xl font-bold tracking-tight uppercase ${isSelected ? 'text-white' : 'text-gray-300'}`}>{kit.name}</h3>
                           </div>
                           <div className={`px-4 py-1.5 rounded-full text-xs font-bold font-mono ${isSelected ? 'bg-[#00d2ff] text-black shadow-lg' : 'bg-black text-[#00d2ff] border border-[#00d2ff]/30'}`}>
                             {kit.price > 0 ? `$${kit.price} MXN` : 'GRATUITO'}
                           </div>
                         </div>
                         <p className={`text-xs ml-8 font-medium leading-relaxed ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>{kit.description}</p>
                       </div>
                     </label>
                   )})}
                 </div>

                 {selectedKitDef?.includesJersey && (
                   <div className="mt-8 bg-[#171821] border border-[#ffffff10] rounded-2xl p-6 sm:p-8 relative z-10 shadow-inner">
                     <div className="mb-6 flex items-center gap-3">
                       <Award className="w-5 h-5 text-[#ff5f6d]" />
                       <h3 className="text-sm uppercase tracking-[0.2em] font-bold text-white">Configuración Textil Oficial</h3>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                        <div className="space-y-3">
                          <label className="text-xs uppercase tracking-widest font-bold text-gray-500 block">Tipo/Diseño de Jersey <span className="text-[#ff5f6d]">*</span></label>
                          <select {...register("jerseyType", { required: true })} className="w-full bg-[#242636] border border-[#ffffff10] text-gray-200 rounded-xl p-4 text-xs font-bold uppercase tracking-widest focus:ring-1 focus:ring-[#ff5f6d] focus:border-[#ff5f6d] appearance-none custom-select shadow-inner transition-colors">
                            <option value="">-- Elige el Diseño --</option>
                            {(Array.isArray(eventData.jerseyTypes) ? eventData.jerseyTypes : (eventData.jerseyTypes || "").split(",").map((t: string) => t.trim()).filter((t:string) => t !== "")).map((type: string) => (
                               <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs uppercase tracking-widest font-bold text-gray-500 block">Talla Física <span className="text-[#ff5f6d]">*</span></label>
                          <select {...register("jerseySize", { required: true })} className="w-full bg-[#242636] border border-[#ffffff10] text-gray-200 rounded-xl p-4 text-xs font-bold uppercase tracking-widest focus:ring-1 focus:ring-[#ff5f6d] focus:border-[#ff5f6d] appearance-none custom-select shadow-inner transition-colors">
                            <option value="">-- Elige tu Talla --</option>
                            {(Array.isArray(eventData.jerseySizes) ? eventData.jerseySizes : (eventData.jerseySizes || "").split(",").map((s: string) => s.trim()).filter((s:string) => s !== "")).map((size: string) => (
                               <option key={size} value={size}>{size}</option>
                            ))}
                          </select>
                        </div>
                     </div>
                   </div>
                 )}
               </section>
            )}

            <section className="space-y-8">
              <h2 className="text-base lg:text-lg font-bold border-b border-[#ffffff10] pb-5 text-white uppercase tracking-widest flex items-center gap-4">
                <span className="bg-gradient-to-br from-[#4b55f5] to-[#884af0] text-white w-8 h-8 rounded-md flex items-center justify-center text-sm shadow-[0_0_15px_rgba(75,85,245,0.4)]">{eventData?.kitsEnabled ? '3' : '2'}</span> 
                Sube la Información Requerida
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { id: "payment", label: "Comprobante de pago o captura de Transferencia", desc: "Ticket o Transfer (PDF/Img)", req: true, color: "text-[#00d2ff]", bg: "bg-[#00d2ff]/10", border: "border-[#00d2ff]/30", hover: "hover:border-[#00d2ff]" },
                  { id: "photo", label: "Fotografía del participante", desc: "Para darte la bienvenida", req: true, color: "text-[#4b55f5]", bg: "bg-[#4b55f5]/10", border: "border-[#4b55f5]/30", hover: "hover:border-[#4b55f5]" },
                  { id: "logo", label: "Logo de tu equipo (Opcional)", desc: "(Recomendado p/ Equipos)", req: false, color: "text-[#884af0]", bg: "bg-[#884af0]/10", border: "border-[#884af0]/20", hover: "hover:border-[#884af0]" },
                  { id: "id", label: "Identificación Oficial", desc: "Foto y Firma legible (INE)", req: true, color: "text-[#ff5f6d]", bg: "bg-[#ff5f6d]/10", border: "border-[#ff5f6d]/30", hover: "hover:border-[#ff5f6d]" }
                ].filter(doc => (eventData?.enabledDocs || ["payment", "photo", "logo", "id"]).includes(doc.id)).map((doc) => {
                  const fileData = watch(`docs_${doc.id}`);
                  const isUploaded = fileData && fileData.length > 0;
                  
                  let previewUrl = null;
                  let isImage = false;
                  
                  if (isUploaded) {
                     const file = fileData[0];
                     isImage = file.type.startsWith('image/');
                     // Protect object URL creation memory leaks by safely casting strings
                     try { previewUrl = URL.createObjectURL(file); } catch(e){}
                  }
                  
                  return (
                    <div key={doc.id} className={`border border-dashed p-7 rounded-2xl text-center transition-all relative group shadow-inner ${isUploaded ? 'bg-[#1b2a24] border-[#00ff88]/50 shadow-[0_0_15px_rgba(0,255,136,0.1)]' : `bg-[#171821] hover:bg-[#1b1d2e] ${doc.border} ${doc.hover}`}`}>
                      <input type="file" {...register(`docs_${doc.id}`, { required: doc.req })} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50" title={isUploaded ? "Cambiar archivo" : "Seleccionar archivo"} accept={doc.id === 'photo' || doc.id === 'logo' ? "image/*" : "image/*,application/pdf"} />
                      
                      {/* Generación Dinámica de Miniatura */}
                      <div className={`w-16 h-16 mx-auto mb-5 rounded-xl flex items-center justify-center transition-transform overflow-hidden relative ${isUploaded && !isImage ? 'bg-[#00ff88]/20 scale-110' : !isImage ? `group-hover:scale-110 ${doc.bg}` : 'shadow-lg ring-2 ring-[#00ff88]/50 ring-offset-2 ring-offset-[#1b2a24] scale-110'}`}>
                         {isImage && previewUrl ? (
                           <img src={previewUrl} alt="Predisualización" className="w-full h-full object-cover" />
                         ) : isUploaded ? (
                           <CheckCircle2 className="w-10 h-10 text-[#00ff88]" />
                         ) : (
                           <UploadCloud className={`w-7 h-7 ${doc.color}`} />
                         )}
                      </div>
                      
                      <p className={`text-base font-bold transition-colors ${isUploaded ? 'text-[#00ff88]' : 'text-gray-200 group-hover:text-white'}`}>{doc.label} {doc.req && !isUploaded && <span className="text-[#ff5f6d]">*</span>}</p>
                      
                      {isUploaded ? (
                        <p className="text-xs text-[#00ff88]/70 mt-3 font-mono truncate px-4">
                          {fileData[0].name}
                          <span className="block mt-1.5 font-bold tracking-widest uppercase text-[10px] opacity-80">
                             ({(fileData[0].size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs lg:text-sm text-gray-500 mt-2 font-medium">{doc.desc}</p>
                      )}
                      
                      <div className={`mt-6 text-[11px] lg:text-xs font-bold tracking-widest uppercase transition-all shadow-sm border py-2.5 px-6 rounded-lg inline-block ${isUploaded ? 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/30 hover:bg-[#00ff88]/20' : 'text-gray-400 border-gray-700 group-hover:bg-white group-hover:border-white group-hover:text-black'}`}>
                        {isUploaded ? 'Reemplazar Archivo' : 'Anexar Carga'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-8">
              <h2 className="text-[13px] font-bold border-b border-[#ffffff10] pb-4 text-white uppercase tracking-widest flex items-center gap-4">
                <span className="bg-gradient-to-br from-[#4b55f5] to-[#884af0] text-white w-7 h-7 rounded-sm flex items-center justify-center text-xs shadow-[0_0_15px_rgba(75,85,245,0.4)]">{eventData?.kitsEnabled ? '4' : '3'}</span> 
                Responsiva Legal
              </h2>
              <div className="bg-[#171821] p-6 sm:p-8 rounded-2xl text-[11px] sm:text-xs leading-relaxed text-gray-400 h-56 overflow-y-auto font-mono border border-[#ffffff0a] shadow-inner custom-scrollbar relative">
                <p className="text-[#00d2ff] font-bold mb-4">/* DECLARACIÓN_LEGAL_Y_EXONERACIÓN */</p>
                Por medio del presente documento, declaro y doy fehaciencia de que conozco los riesgos mecánicos y orgánicos inherentes a la participación en esta estructura competitiva. Libero totalmente de responsabilidad civil, administrativa o imputación a los Operadores, Patrocinadores y Creadores de la Plataforma frente a cualquier fallo, alteración o impacto directo hacia mi integridad.<br/><br/>
                Confirmo que mis métricas de salud vital son estables y óptimas para la prueba. Al aceptar esta responsiva legal, confirmo mi aceptación incondicional de los términos operativos del evento {eventId}.
              </div>
              <label className="bg-[#171821] p-6 sm:p-8 rounded-2xl border border-[#ffffff0a] shadow-sm mt-6 flex items-start gap-4 cursor-pointer hover:bg-[#1b1c28] transition-colors group">
                 <div className="flex items-center h-6 mt-0.5">
                   <input type="checkbox" {...register("acceptTerms", { required: true })} className="w-5 h-5 rounded border-[#ffffff20] bg-[#242636] text-[#4b55f5] focus:ring-[#4b55f5] cursor-pointer shadow-inner" />
                 </div>
                 <div>
                   <p className="text-[12px] font-bold text-white uppercase tracking-widest leading-relaxed group-hover:text-[#00d2ff] transition-colors">
                     Acepto Términos y Condiciones <span className="text-[#ff5f6d]">*</span>
                   </p>
                   <p className="text-[11px] text-gray-500 mt-2 font-medium leading-relaxed">He leído y acepto la carta responsiva, y autorizo el uso de mis datos proporcionados. Si el participante es menor de edad, el padre o tutor legal asume esta y toda autorización.</p>
                 </div>
              </label>
            </section>

            <div className="pt-10 border-t border-[#ffffff10] flex flex-col items-center sm:items-end gap-3 mt-4">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-[#4b55f5] to-[#884af0] hover:from-[#5a64ff] hover:to-[#995bff] text-white font-bold py-6 rounded-2xl transition-all shadow-[0_15px_30px_rgba(75,85,245,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 text-base lg:text-lg group"
              >
                {isSubmitting ? (
                  <>Sincronizando Expediente <Loader2 className="w-6 h-6 animate-spin text-white" /></>
                ) : (
                  <>Finalizar <CheckCircle2 className="w-6 h-6 group-hover:scale-110 transition-transform" /></>
                )}
              </button>
              <p className="text-[11px] lg:text-xs text-gray-500 text-center sm:text-right w-full mt-3 font-bold uppercase tracking-widest">Protocolo Seguro. Datos encriptados y cifrados en Firebase.</p>
            </div>
          </form>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234b55f5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 1rem center;
        }
      `}} />
    </div>
  );
}
