"use client";

import { useRef, useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase/config";
import { updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Download, CheckCircle2, Loader2, MessageCircle } from "lucide-react";

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
    const timer = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(timer);
  }, [photoUrl, logoUrl]);
  
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
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 220 && data[i+1] > 220 && data[i+2] > 220) {
            data[i+3] = 0;
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

  const getProxyUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("blob:") || url.startsWith("data:")) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const buildStaticPosterCanvas = async (): Promise<string | null> => {
    if (!posterRef.current) return null;

    const container = posterRef.current;
    const rect = container.getBoundingClientRect();
    const W = 1080; 
    const H = 1350; 
    const scaleFactor = W / rect.width;

    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const loadImage = (src: string): Promise<HTMLImageElement | null> => {
      return new Promise((resolve) => {
        if (!src) return resolve(null);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    };

    const [bgImg, templateImg, logoImg] = await Promise.all([
      loadImage(getProxyUrl(photoUrl)),
      loadImage(getProxyUrl(posterTemplateUrl)),
      loadImage(processedLogo ? processedLogo : "")
    ]);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    if (bgImg) {
      const bw = W * bgScale;
      const aspect = bgImg.height / bgImg.width;
      const bh = bw * aspect;
      
      const bx = bgPos.x * scaleFactor;
      const by = bgPos.y * scaleFactor;
      
      const dx = (W - bw) / 2 + bx;
      const dy = (H - bh) / 2 + by;
      
      ctx.drawImage(bgImg, dx, dy, bw, bh);
    }

    if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, W, H);
    }

    if (logoImg) {
      const lw = (150 * logoScale) * scaleFactor;
      const lh = (logoImg.height * lw / logoImg.width);
      
      const uiStartX = rect.width * 0.3;
      const uiStartY = rect.height * 0.6;
      
      const finalX = (uiStartX * scaleFactor) + (logoPos.x * scaleFactor);
      const finalY = (uiStartY * scaleFactor) + (logoPos.y * scaleFactor);
      
      ctx.drawImage(logoImg, finalX, finalY, lw, lh);
    }

    const drawStyledText = (text: string, xPercent: number, yPercent: number, offsetX: number, offsetY: number, fontSize: number, color: string) => {
      const fs = fontSize * scaleFactor;
      ctx.font = `italic 900 ${fs}px ${posterFontFamily || 'Impact, sans-serif'}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      
      const tx = (rect.width * xPercent * scaleFactor) + (offsetX * scaleFactor);
      const ty = (rect.height * yPercent * scaleFactor) + (offsetY * scaleFactor);

      ctx.strokeStyle = "black";
      ctx.lineWidth = 1.5 * scaleFactor;
      ctx.strokeText(text.toUpperCase(), tx, ty);
      
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillText(text.toUpperCase(), tx + (3 * scaleFactor), ty + (3 * scaleFactor));
      
      ctx.fillStyle = color;
      ctx.fillText(text.toUpperCase(), tx, ty);
    };

    if (posterTemplateUrl) {
      drawStyledText(gender === 'FEMALE' ? 'BIENVENIDA' : 'BIENVENIDO', 0, 0.4, 32 + welcomePos.x, welcomePos.y, 36, posterColorWelcome || '#ffffff');
      
      if (showFolioOnPoster !== false) {
        drawStyledText(`#${folio.slice(-3)}`, 0, 0.48, 32 + textPos.x, textPos.y, 36, posterColorFolio || '#00ffcc');
      }
      
      drawStyledText(name, 0, 0.48, 32 + textPos.x, textPos.y + 40, 24, posterColorName || '#ffffff');
      drawStyledText(`DE: ${originState || "SEDE"}`, 0, 0.48, 32 + textPos.x, textPos.y + 70, 24, posterColorState || '#ccff00');
    }

    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const dataUrl = await buildStaticPosterCanvas();
      if (!dataUrl) return;
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `Bienvenida-${folio}.jpg`;
      link.click();
    } catch (err) {
      alert("Error al descargar.");
    } finally {
      setDownloading(false);
    }
  };

  const handleFinalize = async () => {
    if (!registrationId || !eventId) {
      alert("Sesión Inválida. Haz un registro nuevo.");
      setIsFinalized(true);
      return;
    }

    setFinalizing(true);
    try {
      const dataUrl = await buildStaticPosterCanvas();
      if (!dataUrl) throw new Error("Canvas Error");
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      
      const fileRef = ref(storage, `registrations/${eventId}/${folio}/poster_final.jpg`);
      await uploadBytes(fileRef, blob);
      const posterFinalUrl = await getDownloadURL(fileRef);

      await updateDoc(doc(db, "registrations", registrationId), {
        posterFinalUrl
      });
      
      setIsFinalized(true);
    } catch (err: any) {
      alert(`Error al guardar diseño.`);
    } finally {
      setFinalizing(false);
    }
  };

  const handleNativeShare = async () => {
    setDownloading(true);
    try {
      const dataUrl = await buildStaticPosterCanvas();
      if (!dataUrl) throw new Error("Canvas Error");
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      
      const file = new File([blob], `Bienvenida-${folio}.jpg`, { type: 'image/jpeg' });
      const text = `¡Me he registrado exitosamente para ${eventName}! Mi número de operación es #${folio.slice(-3)}.`;
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Registro ${eventName}`,
          text: text,
        });
      } else {
        alert("Dispositivo no soporta envío directo. Descárgala manualmente.");
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        alert("Error al compartir.");
      }
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
        
        {posterTemplateUrl && (
          <img 
            src={getProxyUrl(posterTemplateUrl)} 
            crossOrigin="anonymous" 
            alt="Template" 
            className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none" 
          />
        )}

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

        {posterTemplateUrl && (
          <>
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
           <div className="flex flex-col gap-4 w-full">
               <button 
                 onClick={() => {
                   if(!isFinalized) return alert("⚠️ ¡Ocultando imagen! \n\nPrimero debes terminar y guardar tu diseño haciendo clic en 'Finalizar Diseño HD'.");
                   handleNativeShare();
                 }}
                 disabled={downloading || !ready}
                 className={`w-full bg-gradient-to-r from-[#25D366] to-[#1DA851] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-3 uppercase tracking-widest text-[11px] transition-all ${!isFinalized ? 'opacity-50 grayscale cursor-allowed' : 'shadow-[0_0_20px_rgba(37,211,102,0.4)] hover:shadow-[0_0_30px_rgba(37,211,102,0.6)] animate-pulse'}`}
               >
                 <MessageCircle className="w-5 h-5 fill-white/20" />
                 {downloading ? 'Compilando JPG...' : 'Compartir por WhatsApp'}
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
