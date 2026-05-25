"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, storage } from "@/lib/firebase/config";
import { updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Download, CheckCircle2, Loader2, MessageCircle, Move, Expand, MousePointer2 } from "lucide-react";

interface WelcomePosterProps {
  folio: string;
  name: string;
  eventName: string;
  category: string;
  photoUrl?: string;
  logoUrl?: string;
  posterTemplateUrl?: string;
  originState?: string;
  originMuni?: string;
  posterFontFamily?: string;
  posterColorFolio?: string;
  posterColorName?: string;
  posterColorState?: string;
  posterColorWelcome?: string;
  showFolioOnPoster?: boolean;
  showStateOnPoster?: boolean;
  showMuniOnPoster?: boolean;
  gender?: string;
  registrationId?: string;
  eventId?: string;
  isPreview?: boolean;
  onFinalized?: () => void;
}

export default function WelcomePoster({ folio, name, eventName, category, photoUrl, logoUrl, posterTemplateUrl, originState, originMuni, posterFontFamily, posterColorFolio, posterColorName, posterColorState, posterColorWelcome, showFolioOnPoster, showStateOnPoster, showMuniOnPoster, gender, registrationId, eventId, isPreview, onFinalized }: WelcomePosterProps) {
  const posterRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [ready, setReady] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const router = useRouter();

  // States for Dragging
  const [activeElement, setActiveElement] = useState<string | null>(null);

  const [bgPos, setBgPos] = useState({ x: 0, y: 0 });
  const [bgScale, setBgScale] = useState(1.5);
  
  const [logoPos, setLogoPos] = useState({ x: 0, y: 0 });
  const [logoScale, setLogoScale] = useState(1);
  const [processedLogo, setProcessedLogo] = useState<string | null>(null);
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  const [welcomePos, setWelcomePos] = useState({ x: 0, y: 0 });
  const [welcomeScale, setWelcomeScale] = useState(1);

  const [folioPos, setFolioPos] = useState({ x: 0, y: 0 });
  const [folioScale, setFolioScale] = useState(1);

  const [namePos, setNamePos] = useState({ x: 0, y: 76 });
  const [nameScale, setNameScale] = useState(1);

  const [statePos, setStatePos] = useState({ x: 0, y: 162 });
  const [stateScale, setStateScale] = useState(1);

  const interactRef = useRef({
    isDragging: false,
    isResizing: false,
    corner: 'br',
    target: '',
    startX: 0,
    startY: 0,
    startScale: 1,
    originalPos: {x: 0, y: 0}
  });

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
        if (!src.startsWith('data:')) {
          img.crossOrigin = "anonymous";
        }
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
      const containerAspect = W / H;
      const imgAspect = bgImg.width / bgImg.height;
      
      let renderW, renderH;
      if (imgAspect > containerAspect) {
        // Image is wider than container
        renderH = H;
        renderW = H * imgAspect;
      } else {
        // Image is taller than container
        renderW = W;
        renderH = W / imgAspect;
      }

      const bw = renderW * bgScale;
      const bh = renderH * bgScale;
      
      const bx = bgPos.x * scaleFactor;
      const by = bgPos.y * scaleFactor;
      
      const dx = (W - bw) / 2 + bx;
      const dy = (H - bh) / 2 + by;
      
      ctx.drawImage(bgImg, dx, dy, bw, bh);
    }

    if (templateImg) {
      const containerAspect = W / H;
      const imgAspect = templateImg.width / templateImg.height;
      
      let renderW, renderH;
      if (imgAspect > containerAspect) {
        renderH = H;
        renderW = H * imgAspect;
      } else {
        renderW = W;
        renderH = W / imgAspect;
      }
      
      const dx = (W - renderW) / 2;
      const dy = (H - renderH) / 2;
      
      ctx.drawImage(templateImg, dx, dy, renderW, renderH);
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

    const drawStyledText = (text: string, xPercent: number, yPercent: number, offsetX: number, offsetY: number, fontSize: number, color: string, textScale: number = 1, fontWeight: string = 'normal', letterSpacing: string = '-0.05em', maxWidth?: number) => {
      const fs = (fontSize * textScale) * scaleFactor;
      
      ctx.font = `italic ${fontWeight} ${fs}px ${posterFontFamily || 'Impact, sans-serif'}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      
      const tx = (rect.width * xPercent * scaleFactor) + (offsetX * scaleFactor);
      const ty = (rect.height * yPercent * scaleFactor) + (offsetY * scaleFactor);

      // 1. Shadow
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      if (maxWidth) {
        ctx.fillText(text, tx + (3 * scaleFactor), ty + (3 * scaleFactor), maxWidth);
      } else {
        ctx.fillText(text, tx + (3 * scaleFactor), ty + (3 * scaleFactor));
      }
      
      // 2. Stroke (thicker to match DOM visibility when half is covered by fill)
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2.5 * scaleFactor;
      ctx.lineJoin = "round"; // Ensures sharp corners don't spike out
      if (maxWidth) {
        ctx.strokeText(text, tx, ty, maxWidth);
      } else {
        ctx.strokeText(text, tx, ty);
      }
      
      // 3. Fill
      ctx.fillStyle = color;
      if (maxWidth) {
        ctx.fillText(text, tx, ty, maxWidth);
      } else {
        ctx.fillText(text, tx, ty);
      }
    };

    if (posterTemplateUrl) {
      const getDOMWidth = (id: string, scale: number) => {
        const node = container.querySelector(`#${id}`) as HTMLElement;
        return node ? (node.offsetWidth * scale * scaleFactor) : undefined;
      };

      drawStyledText(gender === 'FEMALE' ? 'BIENVENIDA' : 'BIENVENIDO', 0, 0.4, 32 + welcomePos.x, welcomePos.y, 36, posterColorWelcome || '#ffffff', welcomeScale, '900', '0.1em', getDOMWidth('poster-welcome-text', welcomeScale));
      
      if (showFolioOnPoster !== false) {
        drawStyledText(`#${folio.slice(-3)}`, 0, 0.48, 32 + folioPos.x, folioPos.y, 36, posterColorFolio || '#00ffcc', folioScale, 'normal', '-0.05em', getDOMWidth('poster-folio-text', folioScale));
      }
      
      drawStyledText(name.toUpperCase(), 0, 0.48, 32 + namePos.x, namePos.y, 24, posterColorName || '#ffffff', nameScale, 'normal', '-0.05em', getDOMWidth('poster-name-text', nameScale));

      // Build location text based on flags
      const locationParts: string[] = [];
      if (showStateOnPoster !== false && originState) locationParts.push(originState);
      if (showMuniOnPoster && originMuni) locationParts.push(originMuni);
      if (locationParts.length > 0) {
        locationParts.forEach((part, index) => {
          drawStyledText(part, 0, 0.48, 32 + statePos.x, statePos.y + (index * 24 * stateScale), 24, posterColorState || '#ccff00', stateScale, 'normal', '-0.05em', getDOMWidth(`poster-state-text-${index}`, stateScale));
        });
      }
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
      if (!dataUrl) throw new Error("Generación de imagen falló (dataUrl nulo).");
      
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      
      const fileRef = ref(storage, `registrations/${eventId}/${folio}/poster_final.jpg`);
      await uploadBytes(fileRef, blob);
      const posterFinalUrl = await getDownloadURL(fileRef);

      await updateDoc(doc(db, "registrations", registrationId), {
        posterFinalUrl,
        // Si el admin guarda, forzamos que ESTA sea la nueva bienvenida oficial del usuario
        ...(isPreview ? { welcomeCardUrl: posterFinalUrl } : {})
      });
      
      setIsFinalized(true);
      onFinalized?.();
      if (isPreview) {
        alert("✅ Diseño guardado exitosamente. Los cambios ahora son oficiales para el usuario.");
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error al guardar diseño: ${err.message || err}`);
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

  const handleSelect = (e: React.MouseEvent | React.TouchEvent, id: string, pos: {x:number, y:number}, scale: number, isResize: boolean = false, corner: string = 'br') => {
    if (isFinalized) return;
    
    // Prevent native drag/drop or text selection from hijacking the mousemove events
    if (e.cancelable) {
       e.preventDefault();
    }

    setActiveElement(id);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    interactRef.current = {
      isDragging: !isResize,
      isResizing: isResize,
      corner,
      target: id,
      startX: clientX,
      startY: clientY,
      startScale: scale,
      originalPos: { ...pos }
    };
  };

  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isFinalized) return;
    const { isDragging, isResizing, target, startX, startY, startScale, originalPos } = interactRef.current;
    if (!isDragging && !isResizing) return;

    if (isResizing) {
       // Prevent default to prevent scrolling while drawing
       if(e.cancelable) e.preventDefault(); 
    }
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (isDragging) {
      const dx = clientX - startX;
      const dy = clientY - startY;
      const newPos = { x: originalPos.x + dx, y: originalPos.y + dy };
      
      if (target === 'bg') setBgPos(newPos);
      else if (target === 'logo') setLogoPos(newPos);
      else if (target === 'welcome') setWelcomePos(newPos);
      else if (target === 'folio') setFolioPos(newPos);
      else if (target === 'name') setNamePos(newPos);
      else if (target === 'state') setStatePos(newPos);
    } else if (isResizing) {
      const deltaX = clientX - startX;
      const deltaY = clientY - startY;
      
      let factor = 0;
      const { corner } = interactRef.current;
      if (corner === 'br') factor = (deltaX + deltaY) * 0.005;
      else if (corner === 'tl') factor = (-deltaX - deltaY) * 0.005;
      else if (corner === 'tr') factor = (deltaX - deltaY) * 0.005;
      else if (corner === 'bl') factor = (-deltaX + deltaY) * 0.005;
      
      let newScale = Math.max(0.1, startScale + factor);
      
      if (target === 'bg') { newScale = Math.max(0.5, startScale + factor); setBgScale(newScale); }
      else if (target === 'logo') setLogoScale(newScale);
      else if (target === 'welcome') setWelcomeScale(newScale);
      else if (target === 'folio') setFolioScale(newScale);
      else if (target === 'name') setNameScale(newScale);
      else if (target === 'state') setStateScale(newScale);
    }
  };

  const endDrag = () => {
    interactRef.current.isDragging = false;
    interactRef.current.isResizing = false;
  };

  const renderBoundingBox = (id: string, pos: {x:number, y:number}, scale: number, children: React.ReactNode, widthClasses: string = "w-max") => {
    const isActive = activeElement === id;
    return (
      <div 
        className={`absolute origin-top-left z-30 transition-shadow bg-white/5 ${isFinalized ? 'pointer-events-none' : 'cursor-move touch-none'} ${isActive ? 'ring-2 ring-dashed ring-[#00d2ff] bg-[#00d2ff]/10' : 'hover:ring-1 hover:ring-white/30 hover:bg-white/5'} ${widthClasses}`}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})` }}
        onMouseDown={(e) => handleSelect(e, id, pos, scale, false)}
        onTouchStart={(e) => handleSelect(e, id, pos, scale, false)}
      >
        {children}
        {isActive && !isFinalized && (
          <>
            <div 
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-[#00d2ff] border border-[#1b1c27] rounded-full flex items-center justify-center cursor-nwse-resize shadow-[0_0_10px_rgba(0,210,255,0.6)] touch-none"
              onMouseDown={(e) => { e.stopPropagation(); handleSelect(e, id, pos, scale, true, 'tl'); }}
              onTouchStart={(e) => { e.stopPropagation(); handleSelect(e, id, pos, scale, true, 'tl'); }}
            />
            <div 
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#00d2ff] border border-[#1b1c27] rounded-full flex items-center justify-center cursor-nesw-resize shadow-[0_0_10px_rgba(0,210,255,0.6)] touch-none"
              onMouseDown={(e) => { e.stopPropagation(); handleSelect(e, id, pos, scale, true, 'tr'); }}
              onTouchStart={(e) => { e.stopPropagation(); handleSelect(e, id, pos, scale, true, 'tr'); }}
            />
            <div 
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-[#00d2ff] border border-[#1b1c27] rounded-full flex items-center justify-center cursor-nesw-resize shadow-[0_0_10px_rgba(0,210,255,0.6)] touch-none"
              onMouseDown={(e) => { e.stopPropagation(); handleSelect(e, id, pos, scale, true, 'bl'); }}
              onTouchStart={(e) => { e.stopPropagation(); handleSelect(e, id, pos, scale, true, 'bl'); }}
            />
            <div 
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-[#00d2ff] border border-[#1b1c27] rounded-full flex items-center justify-center cursor-nwse-resize shadow-[0_0_10px_rgba(0,210,255,0.6)] touch-none"
              onMouseDown={(e) => { e.stopPropagation(); handleSelect(e, id, pos, scale, true, 'br'); }}
              onTouchStart={(e) => { e.stopPropagation(); handleSelect(e, id, pos, scale, true, 'br'); }}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full relative">
      {!isPreview && !isFinalized && (
        <div className="w-full">
          <div className="bg-[#4b55f5]/10 border border-[#4b55f5]/30 text-[#00d2ff] text-[10px] uppercase font-bold tracking-widest px-4 py-2 rounded-lg text-center shadow-inner mb-4">
            Arrastra la foto de fondo, textos {logoUrl && 'y tu Logo '} libremente para acomodarlos.
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
             if (e.target === e.currentTarget) {
                 setActiveElement(null);
                 handleSelect(e, 'bg', bgPos, bgScale, false);
             }
          }}
          onTouchStart={(e) => {
             if (isFinalized) return;
             if (e.target === e.currentTarget) {
                 setActiveElement(null);
                 handleSelect(e, 'bg', bgPos, bgScale, false);
             }
          }}
          className={`relative w-full aspect-[4/5] overflow-hidden bg-black text-white flex flex-col items-center justify-between z-10 select-none ${isFinalized ? 'pointer-events-none' : 'cursor-default touch-none'} m-0`}
        >
        <div className="absolute inset-0 z-0 bg-black">
           <img 
             src={photoUrl || ''}
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
            src={posterTemplateUrl} 
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
        
        {activeElement === 'bg' && !isFinalized && (
           <div 
             className="absolute inset-[25%] z-20 ring-2 ring-dashed ring-white/50 pointer-events-none"
           >
              <div 
                className="absolute -bottom-4 -right-4 w-12 h-12 bg-black/60 backdrop-blur border-2 border-white rounded-full flex items-center justify-center cursor-nwse-resize pointer-events-auto shadow-xl"
                onMouseDown={(e) => handleSelect(e, 'bg', bgPos, bgScale, true)}
                onTouchStart={(e) => handleSelect(e, 'bg', bgPos, bgScale, true)}
              >
                 <Expand className="w-5 h-5 text-white" />
              </div>
              <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] uppercase font-bold text-white pointer-events-none">Fondo (Ajuste)</div>
           </div>
        )}

        {processedLogo && (
           <div className="absolute top-[60%] left-[30%] z-20">
              {renderBoundingBox('logo', logoPos, logoScale, (
               <img 
                 src={processedLogo} 
                 alt="Team Logo" 
                 {...(!processedLogo.startsWith('data:') ? { crossOrigin: "anonymous" } : {})}
                 draggable={false}
                 className="object-contain select-none"
                 style={{ width: `150px` }} 
               />
             ))}
           </div>
        )}

        {posterTemplateUrl && (
          <>
            <div className="absolute top-[40%] left-0 w-full px-8 z-30">
               {renderBoundingBox('welcome', welcomePos, welcomeScale, (
                  <h1 
                    id="poster-welcome-text"
                    className="text-4xl italic font-black uppercase tracking-widest leading-none drop-shadow-2xl whitespace-nowrap"
                    style={{ 
                      fontFamily: posterFontFamily || 'Impact, sans-serif',
                      color: posterColorWelcome || '#ffffff',
                      WebkitTextStroke: '1px black', 
                      textShadow: '3px 3px 0px rgba(0,0,0,0.8)' 
                    }}
                  >
                    {gender === 'FEMALE' ? 'BIENVENIDA' : 'BIENVENIDO'}
                  </h1>
               ))}
            </div>

            <div className="absolute top-[48%] left-0 w-full px-8 z-30">
              {showFolioOnPoster !== false && (
                 renderBoundingBox('folio', folioPos, folioScale, (
                  <span 
                    id="poster-folio-text"
                    className="text-4xl italic tracking-tighter leading-none shadow-lg block whitespace-nowrap"
                    style={{ 
                      fontFamily: posterFontFamily || 'Impact, sans-serif',
                      color: posterColorFolio || '#00ffcc',
                      WebkitTextStroke: '1px black', 
                      textShadow: '3px 3px 0px rgba(0,0,0,0.8)' 
                    }}
                  >
                    #{folio.slice(-3)}
                  </span>
                ))
              )}
              
              {renderBoundingBox('name', namePos, nameScale, (
                <h2  
                  id="poster-name-text"
                  className="text-2xl italic font-black tracking-tighter uppercase leading-none whitespace-nowrap text-left block"
                  style={{ 
                    fontFamily: posterFontFamily || 'Impact, sans-serif',
                    color: posterColorName || '#ffffff',
                    WebkitTextStroke: '1px black', 
                    textShadow: '3px 3px 0px rgba(0,0,0,0.8)' 
                  }}
                >
                  {name}
                </h2>
              ))}
              
              {/* Dynamic location text based on event config */}
              {(() => {
                const parts: string[] = [];
                if (showStateOnPoster !== false && originState) parts.push(originState);
                if (showMuniOnPoster && originMuni) parts.push(originMuni);
                if (parts.length === 0) return null;
                return renderBoundingBox('state', statePos, stateScale, (
                    <div 
                      className="flex flex-col items-start"
                      style={{ 
                        fontFamily: posterFontFamily || 'Impact, sans-serif',
                        color: posterColorState || '#ccff00',
                        WebkitTextStroke: '1px black', 
                        textShadow: '3px 3px 0px rgba(0,0,0,0.8)' 
                      }}
                    >
                      {parts.map((part, idx) => (
                        <span key={idx} id={`poster-state-text-${idx}`} className="text-2xl italic tracking-tighter leading-none block whitespace-nowrap">
                          {part}
                        </span>
                      ))}
                    </div>
                  ));
              })()}
           </div>
          </>
        )}

        </div>

        {/* --- CONSOLA DE CONTROLES PARA ADMIN Y USUARIOS --- */}
        {!isFinalized && (
          <div className="flex flex-col gap-5 w-full bg-[#171821]/80 backdrop-blur-md p-6 rounded-3xl border border-white/5 shadow-2xl mt-4">
            
            {/* ZOOM FOTO */}
            <div className="space-y-3">
               <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#00d2ff]">
                  <span>Zoom Foto</span>
                  <span>x{bgScale.toFixed(2)}</span>
               </div>
               <input type="range" step="0.01" min="1" max="5" value={bgScale} onChange={(e) => setBgScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#00d2ff]" />
            </div>

            {/* ZOOM LOGO (CONTROL QUE FALTABA) */}
            {processedLogo && (
              <div className="space-y-3 border-t border-white/5 pt-5">
                 <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#bb86fc]">
                    <span>Zoom Logo / Sponsor</span>
                    <span>x{logoScale.toFixed(2)}</span>
                 </div>
                 <input type="range" step="0.01" min="0.2" max="3" value={logoScale} onChange={(e) => setLogoScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#bb86fc]" />
              </div>
            )}

            {/* CONTROLES DE TAMAÑO DE TEXTOS */}
            {posterTemplateUrl && (
              <div className="border-t border-white/5 pt-5">
                 <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/80">
                          <span>Tamaño Bienvenida</span>
                          <span>x{welcomeScale.toFixed(2)}</span>
                       </div>
                       <input type="range" step="0.01" min="0.5" max="3" value={welcomeScale} onChange={(e) => setWelcomeScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-white" />
                    </div>
                    {showFolioOnPoster !== false && (
                      <div className="space-y-3">
                         <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#00ffcc]">
                            <span>Tamaño Folio</span>
                            <span>x{folioScale.toFixed(2)}</span>
                         </div>
                         <input type="range" step="0.01" min="0.5" max="3" value={folioScale} onChange={(e) => setFolioScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#00ffcc]" />
                      </div>
                    )}
                    <div className="space-y-3">
                       <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/80">
                          <span>Tamaño Nombre</span>
                          <span>x{nameScale.toFixed(2)}</span>
                       </div>
                       <input type="range" step="0.01" min="0.5" max="3" value={nameScale} onChange={(e) => setNameScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-white" />
                    </div>
                    {(showStateOnPoster !== false || showMuniOnPoster) && (
                      <div className="space-y-3">
                         <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-[#ccff00]">
                            <span>Tamaño Procedencia</span>
                            <span>x{stateScale.toFixed(2)}</span>
                         </div>
                         <input type="range" step="0.01" min="0.5" max="3" value={stateScale} onChange={(e) => setStateScale(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-[#ccff00]" />
                      </div>
                    )}
                 </div>
              </div>
            )}

            <button 
              onClick={() => setIsRemovingBg(!isRemovingBg)}
              className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${isRemovingBg ? 'bg-[#4b55f5] text-white border-[#4b55f5]' : 'bg-transparent text-gray-400 border-white/10'}`}
            >
              {isRemovingBg ? "✨ Quitar Fondo Blanco: Activo" : "Intentar quitar fondo blanco al logo"}
            </button>
          </div>
        )}

        {/* --- TUTORIAL OVERLAY PARA USUARIOS NUEVOS --- */}
        {!isFinalized && !isPreview && showTutorial && (
          <div className="absolute inset-0 z-[100] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
             <div className="relative mb-8">
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-[#00d2ff]/20 rounded-full animate-ping" />
                <MousePointer2 className="w-12 h-12 text-[#00d2ff] rotate-12" />
             </div>

        {/* --- OPCIÓN PARA VOLVER AL REGISTRO (SOLO ADMIN) --- */}
        {isFinalized && isPreview && (
          <div className="absolute inset-0 z-[110] bg-[#171821]/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-300">
             <div className="w-20 h-20 bg-[#00ff88]/20 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-[#00ff88]" />
             </div>
             <h3 className="text-xl font-black uppercase text-white mb-4">¡DISEÑO ACTUALIZADO! ✨</h3>
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed mb-10">
                Has corregido la bienvenida exitosamente. <br/> Ahora puedes volver al listado de registros.
             </p>
             <button 
                onClick={() => router.push('/admin/registrations')}
                className="w-full bg-[#00ff88] text-[#1b1c27] py-4 rounded-xl font-black uppercase tracking-widest text-[12px] shadow-[0_0_30px_rgba(0,255,136,0.3)] hover:scale-105 transition-all"
             >
                🏁 TERMINAR Y VOLVER A REGISTROS
             </button>
          </div>
        )}
             
             <h3 className="text-xl font-black uppercase tracking-tighter mb-4 text-white">
                💡 ¡Es momento de <span className="text-[#00d2ff]">diseñar</span>!
             </h3>
             
             <div className="space-y-6 mb-10">
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                   <div className="bg-[#4b55f5]/20 p-3 rounded-full"><Move className="w-6 h-6 text-[#4b55f5] animate-bounce" /></div>
                   <p className="text-[11px] font-bold uppercase tracking-widest text-left text-gray-300">
                      <span className="text-white block">Arrastra con tu dedo</span> 
                      La foto de fondo y los textos para acomodarlos.
                   </p>
                </div>
                
                <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                   <div className="bg-[#00d2ff]/20 p-3 rounded-full"><Expand className="w-6 h-6 text-[#00d2ff] animate-pulse" /></div>
                   <p className="text-[11px] font-bold uppercase tracking-widest text-left text-gray-300">
                      <span className="text-white block">Usa la barra de zoom</span> 
                      Para ajustar el tamaño de tu imagen de fondo.
                   </p>
                </div>
             </div>

             <button 
                onClick={() => setShowTutorial(false)}
                className="w-full bg-[#00d2ff] text-[#1b1c27] py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[12px] shadow-[0_0_30px_rgba(0,210,255,0.4)] hover:scale-105 active:scale-95 transition-all"
             >
                ¡ENTENDIDO, A COMENZAR! 🚀
             </button>
          </div>
        )}

      </div>

      {(!isFinalized) && (
        <button 
          onClick={handleFinalize}
          disabled={finalizing || !ready}
          className="w-full bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-500 text-white py-4 mt-4 rounded-xl font-black shadow-[0_0_20px_rgba(75,85,245,0.4)] hover:shadow-[0_0_30px_rgba(75,85,245,0.6)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 uppercase tracking-widest text-[11px] relative overflow-hidden group"
        >
          {finalizing && (
            <div className="absolute inset-0 w-full h-full bg-white/20 animate-pulse" />
          )}
          {finalizing ? <><Loader2 className="w-5 h-5 animate-spin" /> Salvando Cambios...</> : <><CheckCircle2 className="w-5 h-5 group-hover:scale-125 transition-transform" /> {isPreview ? 'Guardar Cambios como Administrador' : 'Finalizar Diseño HD'}</>}
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
