"use client";

import { useRef, useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase/config";
import { updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import * as htmlToImage from "html-to-image";
import { Download, CheckCircle2, Loader2 } from "lucide-react";

interface WelcomePosterProps {
  folio: string;
  name: string;
  eventName: string;
  category: string;
  photoUrl?: string;
  logoUrl?: string;
  posterTemplateUrl?: string;
  originState?: string;
  posterFontFamily?: string;
  posterColorFolio?: string;
  posterColorName?: string;
  posterColorState?: string;
  posterColorWelcome?: string;
  showFolioOnPoster?: boolean;
  gender?: string;
  registrationId?: string;
  eventId?: string;
  isPreview?: boolean;
}

export default function WelcomePoster({ folio, name, eventName, category, photoUrl, logoUrl, posterTemplateUrl, originState, posterFontFamily, posterColorFolio, posterColorName, posterColorState, posterColorWelcome, showFolioOnPoster, gender, registrationId, eventId, isPreview }: WelcomePosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [ready, setReady] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  // States for Dragging
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [bgPos, setBgPos] = useState({ x: 0, y: 0 });
  const [bgScale, setBgScale] = useState(1.5);
  
  // Logo States
  const [logoPos, setLogoPos] = useState({ x: 0, y: 0 });
  const [logoScale, setLogoScale] = useState(1);
  const [processedLogo, setProcessedLogo] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  
  const [welcomePos, setWelcomePos] = useState({ x: 0, y: 0 });
  const textDragRef = useRef({ isDragging: false, startX: 0, startY: 0 });
  const bgDragRef = useRef({ isDragging: false, startX: 0, startY: 0 });
  const logoDragRef = useRef({ isDragging: false, startX: 0, startY: 0 });
  const welcomeDragRef = useRef({ isDragging: false, startX: 0, startY: 0 });

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1500); // Give fonts & blobs a moment to paint
    return () => clearTimeout(timer);
  }, [photoUrl, logoUrl]);
  
  // Magic White Background Remover Toolkit
  useEffect(() => {
    if (!logoUrl) return;
    
    if (isRemovingBg) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        // Erase White/Near-White Pixels
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 220 && data[i+1] > 220 && data[i+2] > 220) {
            data[i+3] = 0; // Alpha Zero
          }
        }
        ctx.putImageData(imageData, 0, 0);
        setProcessedLogo(canvas.toDataURL("image/png"));
      };
      img.src = getProxyUrl(logoUrl);
    } else {
      setProcessedLogo(getProxyUrl(logoUrl));
    }
  }, [logoUrl, isRemovingBg]);

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    
    try {
      const dataUrl = await htmlToImage.toJpeg(posterRef.current, { 
        quality: 0.9, 
        pixelRatio: 2,
        backgroundColor: "#000"
      });
      
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Bienvenida-${folio}.jpg`;
      link.click();
    } catch (err) {
      console.error("Error generating static image", err);
      alert("Hubo un error al compilar la imagen.");
    } finally {
      setDownloading(false);
    }
  };

  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (textDragRef.current.isDragging) {
      setTextPos({
        x: clientX - textDragRef.current.startX,
        y: clientY - textDragRef.current.startY
      });
    } else if (welcomeDragRef.current.isDragging) {
      setWelcomePos({
        x: clientX - welcomeDragRef.current.startX,
        y: clientY - welcomeDragRef.current.startY
      });
    } else if (logoDragRef.current.isDragging) {
      setLogoPos({
        x: clientX - logoDragRef.current.startX,
        y: clientY - logoDragRef.current.startY
      });
    } else if (bgDragRef.current.isDragging) {
      setBgPos({
        x: clientX - bgDragRef.current.startX,
        y: clientY - bgDragRef.current.startY
      });
    }
  };

  const endDrag = () => {
    textDragRef.current.isDragging = false;
    logoDragRef.current.isDragging = false;
    welcomeDragRef.current.isDragging = false;
    bgDragRef.current.isDragging = false;
  };

  const handleFinalize = async () => {
    if (!posterRef.current) return;
    
    // Si la sesión de Next.js es vieja o no tiene ID de Firestore adjunto:
    if (!registrationId || !eventId) {
      alert("⚠️ Sesión Inválida o Caché: Para probar esta nueva función necesitas hacer un registro completito desde cero para que la Base de Datos reconozca el ID del documento y pueda adjuntarle la imagen hd.");
      setIsFinalized(true); // Fallback para que al menos puedan probar la UI
      return;
    }

    setFinalizing(true);
    
    try {
      const dataUrl = await htmlToImage.toJpeg(posterRef.current, { 
        quality: 0.9, 
        pixelRatio: 2,
        backgroundColor: "#000"
      });
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (!blob) throw new Error("Blob creation failed");
      
      const fileRef = ref(storage, `registrations/${eventId}/${folio}/poster_final.jpg`);
      await uploadBytes(fileRef, blob);
      const posterFinalUrl = await getDownloadURL(fileRef);

      await updateDoc(doc(db, "registrations", registrationId), {
        posterFinalUrl
      });
      
      setIsFinalized(true);
    } catch (err: any) {
      console.error("Error finalizing poster", err);
      alert(`Hubo un error al guardar tu diseño en el servidor. Inténtalo de nuevo. \n\nDetalle técnico: ${err.message || 'Error Desconocido'}`);
    } finally {
      setFinalizing(false);
    }
  };

  const handleNativeShare = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    
    try {
      const dataUrl = await htmlToImage.toJpeg(posterRef.current, { 
        quality: 0.9, 
        pixelRatio: 2,
        backgroundColor: "#000",
        cacheBust: true,
      });
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      if (!blob) throw new Error("Blob creation failed");
      
      const file = new File([blob], `Bienvenida-${folio}.jpg`, { type: 'image/jpeg' });
      const text = `¡Me he registrado exitosamente para ${eventName}! Mi número de operación es #${folio.slice(-3)}.`;
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Registro ${eventName}`,
          text: text,
        });
      } else {
        alert("Tu dispositivo actual no soporta el envío de imágenes directas a WhatsApp. Por favor selecciona el botón 'Descargar' y envía la foto manualmente.");
      }
    } catch (err) {
      console.error("Error sharing the image", err);
      if ((err as Error).name !== 'AbortError') {
        alert("Hubo un error al intentar compartir la imagen nativamente.");
      }
    } finally {
      setDownloading(false);
    }
  };

  const getProxyUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("blob:") || url.startsWith("data:")) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const safePhotoUrl = getProxyUrl(photoUrl);
  const safeTemplateUrl = getProxyUrl(posterTemplateUrl);

  return (
    <div className="flex flex-col items-center gap-6 w-full relative">
      {!isPreview && !isFinalized && (
        <div className="w-full space-y-4">
          <div className="bg-[#4b55f5]/10 border border-[#4b55f5]/30 text-[#00d2ff] text-[10px] uppercase font-bold tracking-widest px-4 py-2 rounded-lg text-center shadow-inner">
            Arrastra la foto de fondo, textos {logoUrl && 'y tu Logo '} libremente para acomodarlos.
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#171821] p-4 rounded-xl border border-[#ffffff10] shadow-inner flex items-center gap-4">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-400 whitespace-nowrap">Zoom Foto</span>
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.05" 
                value={bgScale} 
                onChange={(e) => setBgScale(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none bg-gray-700 outline-none accent-[#00d2ff] cursor-ew-resize"
              />
            </div>
            
            {logoUrl && (
              <div className="bg-[#171821] p-4 rounded-xl border border-[#ffffff10] shadow-inner flex flex-col gap-3">
                <div className="flex items-center gap-4">
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#884af0] whitespace-nowrap">Zoom Logo</span>
                  <input 
                    type="range" 
                    min="0.2" 
                    max="2" 
                    step="0.05" 
                    value={logoScale} 
                    onChange={(e) => setLogoScale(parseFloat(e.target.value))}
                    className="w-full h-2 rounded-lg appearance-none bg-gray-700 outline-none accent-[#884af0] cursor-ew-resize"
                  />
                </div>
                <button 
                  type="button"
                  onClick={() => setIsRemovingBg(!isRemovingBg)}
                  className={`w-full py-1.5 rounded text-[9px] uppercase tracking-widest font-bold transition-all border ${isRemovingBg ? 'bg-[#884af0] text-white border-[#884af0]' : 'bg-transparent text-gray-400 border-gray-600 hover:border-[#884af0] hover:text-[#884af0]'}`}
                >
                  {isRemovingBg ? 'Fondo Transparente Activado' : 'Quitar Fondo Blanco del Logo'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isFinalized && (
        <div className="bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] text-[10px] uppercase font-bold tracking-widest px-4 py-2 rounded-lg text-center shadow-inner w-full flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Diseño Guardado y Sellado Exitosamente
        </div>
      )}
      
      <div className="w-full max-w-sm mx-auto shadow-2xl rounded-2xl border border-gray-800 overflow-hidden relative">
        <div 
          ref={posterRef}  
          onMouseMove={isFinalized ? undefined : onDragMove}
          onTouchMove={isFinalized ? undefined : onDragMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchEnd={endDrag}
          onMouseDown={(e) => {
            if (isFinalized) return;
            if (!textDragRef.current.isDragging && !logoDragRef.current.isDragging && !welcomeDragRef.current.isDragging) {
              bgDragRef.current.isDragging = true;
              bgDragRef.current.startX = e.clientX - bgPos.x;
              bgDragRef.current.startY = e.clientY - bgPos.y;
            }
          }}
          onTouchStart={(e) => {
            if (isFinalized) return;
            if (!textDragRef.current.isDragging && !logoDragRef.current.isDragging && !welcomeDragRef.current.isDragging) {
              bgDragRef.current.isDragging = true;
              bgDragRef.current.startX = e.touches[0].clientX - bgPos.x;
              bgDragRef.current.startY = e.touches[0].clientY - bgPos.y;
            }
          }}
          className={`relative w-full aspect-[4/5] overflow-hidden bg-black text-white flex flex-col items-center justify-between z-10 select-none ${isFinalized || isPreview ? 'pointer-events-none' : 'cursor-move touch-none'} m-0`}
        >
        {/* Layer 1: Background Participant Photo (Draggable & Scaled) */}
        <div className="absolute inset-0 z-0 bg-black">
           <img 
             src={getProxyUrl(photoUrl)}
             crossOrigin="anonymous"
             alt="Background" 
             draggable={false}
             className="w-full h-full object-cover transition-transform duration-[50ms]" 
             style={{ 
               transform: `scale(${bgScale}) translate(${bgPos.x / bgScale}px, ${bgPos.y / bgScale}px)`
             }} 
           />
        </div>
        
        {/* Layer 2: Graphic Transparent Overlay Template (Admin's Upload) */}
        {posterTemplateUrl && (
          <img 
            src={getProxyUrl(posterTemplateUrl)} 
            crossOrigin="anonymous" 
            alt="Template" 
            className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" 
          />
        )}

        {/* Fallback Legacy Design if no Admin Template provided */}
        {!posterTemplateUrl && (
           <div className="absolute inset-0 z-10 bg-gradient-to-t from-black via-black/50 to-transparent flex flex-col items-center justify-between p-8">
             <div className="w-full text-center mt-2">
                <h2 className="text-xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-1 leading-tight">{eventName}</h2>
                <div className="h-0.5 w-12 bg-gray-500 mx-auto opacity-50" />
             </div>
             
             <div className="text-center bg-black/40 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/10 w-full">
                <h3 className="text-2xl font-bold tracking-tight truncate w-full">{name}</h3>
                <p className="text-blue-300 font-semibold text-sm mt-0.5 uppercase tracking-wider">{category}</p>
             </div>
           </div>
        )}
        
        {/* Layer 2.5: Team Logo Render */}
        {processedLogo && (
           <div 
             className={`absolute top-[60%] left-[30%] z-20 ${isFinalized || isPreview ? 'pointer-events-none' : 'cursor-move touch-none'}`}
             style={{ transform: `translate(${logoPos.x}px, ${logoPos.y}px)` }}
             onMouseDown={(e) => {
               if (isFinalized) return;
               e.stopPropagation();
               logoDragRef.current.isDragging = true;
               logoDragRef.current.startX = e.clientX - logoPos.x;
               logoDragRef.current.startY = e.clientY - logoPos.y;
             }}
             onTouchStart={(e) => {
               if (isFinalized) return;
               e.stopPropagation();
               logoDragRef.current.isDragging = true;
               logoDragRef.current.startX = e.touches[0].clientX - logoPos.x;
               logoDragRef.current.startY = e.touches[0].clientY - logoPos.y;
             }}
           >
             <img 
               src={processedLogo} 
               alt="Team Logo" 
               {...(!processedLogo.startsWith('data:') ? { crossOrigin: "anonymous" } : {})}
               draggable={false}
               className="object-contain pointer-events-none select-none"
               style={{ width: `${150 * logoScale}px` }} 
             />
           </div>
        )}

        {/* Layer 3: Dynamic Data Rendering targeted for Template Overlays */}
        {posterTemplateUrl && (
          <>
            {/* Dynamic Welcome Text */}
            <div 
              className={`absolute top-[40%] left-0 w-full px-8 z-30 flex flex-col items-start ${isFinalized || isPreview ? 'pointer-events-none' : 'cursor-move touch-none'}`}
              style={{ transform: `translate(${welcomePos.x}px, ${welcomePos.y}px)` }}
              onMouseDown={(e) => {
                if (isFinalized) return;
                e.stopPropagation();
                welcomeDragRef.current.isDragging = true;
                welcomeDragRef.current.startX = e.clientX - welcomePos.x;
                welcomeDragRef.current.startY = e.clientY - welcomePos.y;
              }}
              onTouchStart={(e) => {
                if (isFinalized) return;
                e.stopPropagation();
                welcomeDragRef.current.isDragging = true;
                welcomeDragRef.current.startX = e.touches[0].clientX - welcomePos.x;
                welcomeDragRef.current.startY = e.touches[0].clientY - welcomePos.y;
              }}
            >
              <h1 
                className="text-4xl italic font-black uppercase tracking-widest leading-none drop-shadow-2xl"
                style={{ 
                  fontFamily: posterFontFamily || 'Impact, sans-serif',
                  color: posterColorWelcome || '#ffffff',
                  WebkitTextStroke: '1px black', 
                  textShadow: '3px 3px 0px rgba(0,0,0,0.8)' 
                }}
              >
                {gender === 'FEMALE' ? 'BIENVENIDA' : 'BIENVENIDO'}
              </h1>
            </div>

            <div 
              className={`absolute top-[48%] left-0 w-full px-8 z-30 flex flex-col items-start ${isFinalized || isPreview ? 'pointer-events-none' : 'cursor-move touch-none'}`}
             style={{ transform: `translate(${textPos.x}px, ${textPos.y}px)` }}
             onMouseDown={(e) => {
               if (isFinalized) return;
               e.stopPropagation();
               textDragRef.current.isDragging = true;
               textDragRef.current.startX = e.clientX - textPos.x;
               textDragRef.current.startY = e.clientY - textPos.y;
             }}
             onTouchStart={(e) => {
               if (isFinalized) return;
               e.stopPropagation();
               textDragRef.current.isDragging = true;
               textDragRef.current.startX = e.touches[0].clientX - textPos.x;
               textDragRef.current.startY = e.touches[0].clientY - textPos.y;
             }}
           >
              {showFolioOnPoster !== false && (
                <span 
                  className="text-4xl italic tracking-tighter leading-none mb-1 shadow-lg"
                  style={{ 
                    fontFamily: posterFontFamily || 'Impact, sans-serif',
                    color: posterColorFolio || '#00ffcc',
                    WebkitTextStroke: '1px black', 
                    textShadow: '3px 3px 0px rgba(0,0,0,0.8)' 
                  }}
                >
                  #{folio.slice(-3)}
                </span>
              )}
              <h2  
                className="text-2xl italic tracking-tighter uppercase leading-none break-words w-full text-left"
                style={{ 
                  fontFamily: posterFontFamily || 'Impact, sans-serif',
                  color: posterColorName || '#ffffff',
                  WebkitTextStroke: '1px black', 
                  textShadow: '3px 3px 0px rgba(0,0,0,0.8)' 
                }}
              >
                {name}
              </h2>
              <span 
                className="text-2xl italic tracking-tighter leading-none mt-1"
                style={{ 
                  fontFamily: posterFontFamily || 'Impact, sans-serif',
                  color: posterColorState || '#ccff00',
                  WebkitTextStroke: '1px black', 
                  textShadow: '3px 3px 0px rgba(0,0,0,0.8)' 
                }}
              >
                DE: {originState || "SEDE"}
              </span>
           </div>
          </>
        )}

        </div>
      </div>

      {!isPreview && !isFinalized && (
        <button 
          onClick={handleFinalize}
          disabled={finalizing || !ready}
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-xl font-black shadow-[0_0_20px_rgba(75,85,245,0.4)] hover:shadow-[0_0_30px_rgba(75,85,245,0.6)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest text-[12px] mt-2 relative overflow-hidden"
        >
          {finalizing && (
            <div className="absolute inset-0 w-full h-full bg-white/20 animate-pulse" />
          )}
          {finalizing ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando en Servidor...</> : <><CheckCircle2 className="w-5 h-5" /> Finalizar Diseño HD</>}
        </button>
      )}

      {!isPreview && (
        <div className="flex flex-col gap-4 w-full mt-2">
           <div className="flex flex-col sm:flex-row gap-4 w-full">
             <button 
               onClick={() => {
                 if(!isFinalized) return alert("⚠️ ¡Ocultando imagen! \n\nPrimero debes terminar y guardar tu diseño haciendo clic en 'Finalizar Diseño HD'.");
                 handleNativeShare();
               }}
               disabled={downloading || !ready}
               className={`flex-1 bg-gradient-to-r from-[#25D366] to-[#1DA851] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 uppercase tracking-widest text-[11px] transition-all ${!isFinalized ? 'opacity-50 grayscale cursor-allowed' : 'shadow-[0_0_20px_rgba(37,211,102,0.4)] hover:shadow-[0_0_30px_rgba(37,211,102,0.6)]'}`}
             >
               {downloading ? 'Compilando JPG...' : 'Compartir WhatsApp'}
             </button>

             <button 
               onClick={() => {
                 if(!isFinalized) return alert("⚠️ ¡Aún no guardas el diseño! \n\nPrimero debes terminar y guardar tu diseño haciendo clic en 'Finalizar Diseño HD'.");
                 alert("Simulación: Correo enviado a tu email a través de Resend API. Contiene Folio y Adjuntos.");
               }}
               className={`flex-1 bg-[#171821] text-[#00d2ff] py-3.5 rounded-xl font-bold flex items-center justify-center gap-3 border border-[#00d2ff]/30 uppercase tracking-widest text-[11px] transition-all ${!isFinalized ? 'opacity-50 cursor-allowed text-gray-400 border-[#ffffff10]' : 'hover:bg-[#25283d] shadow-sm'}`}
             >
               Copia por Correo
             </button>
           </div>
           
           <button 
             onClick={() => {
               if(!isFinalized) return alert("⚠️ ¡Diseño no guardado! \n\nPrimero finaliza tu diseño arrastrando y acomodando la foto, y haciendo clic en 'Finalizar Diseño HD'.");
               handleDownload();
             }}
             disabled={downloading || !ready}
             className={`w-full bg-[#171821] text-gray-300 py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-3 border border-[#ffffff10] uppercase tracking-widest text-[11px] ${!isFinalized ? 'opacity-50 hidden' : 'hover:text-white hover:border-[#ffffff20] mt-4'}`}
           >
             <Download className="w-4 h-4 text-[#00d2ff]" /> 
             Descargar en mi Equipo
           </button>
        </div>
      )}
    </div>
  );
}
