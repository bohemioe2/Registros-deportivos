"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/components/admin/AuthProvider";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Tag, Download, Loader2, FolderArchive, Eye, ChevronDown } from "lucide-react";

export default function BibsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const isSuperAdmin = user?.email === "eder.beltran.acosta@gmail.com";

  // Load events
  useEffect(() => {
    if (!user) return;
    const q = isSuperAdmin ? collection(db, "events") : query(collection(db, "events"), where("organizerEmail", "==", user.email));
    return onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user, isSuperAdmin]);

  // Load registrations when event selected
  useEffect(() => {
    if (!selectedEventId) { setRegistrations([]); return; }
    const ev = events.find(e => e.id === selectedEventId);
    setSelectedEvent(ev || null);
    setPreviewUrl(null);
    const q = query(collection(db, "registrations"), where("eventId", "==", selectedEventId));
    return onSnapshot(q, snap => {
      setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [selectedEventId, events]);

  const getProxyUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("blob:") || url.startsWith("data:")) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  // Core bib generator function
  const generateBibCanvas = async (
    reg: any,
    event: any
  ): Promise<string | null> => {
    const W = 1200;
    const H = 840;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const loadImage = (src: string): Promise<HTMLImageElement | null> =>
      new Promise(resolve => {
        if (!src) return resolve(null);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });

    // Determine bib number — strip leading zeros, just the integer
    const bibNumber = String(parseInt(reg.folio?.replace(/\D/g, '') || "0", 10));

    // Load template and logo concurrently
    const [templateImg, logoImg] = await Promise.all([
      event?.bibTemplateUrl ? loadImage(getProxyUrl(event.bibTemplateUrl)) : Promise.resolve(null),
      reg.logoUrl ? loadImage(getProxyUrl(reg.logoUrl)) : Promise.resolve(null),
    ]);

    // ── LAYER 0: White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // ── LAYER 1: Canva template (sits behind number, shows through transparent center)
    if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, W, H);
    } else {
      // Fallback gradient background if no template uploaded
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, "#1b1c27");
      grad.addColorStop(1, "#25283d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // ── LAYER 2: Giant bib number (centered, massive)
    const numberFontSize = bibNumber.length <= 2 ? 440 : bibNumber.length <= 3 ? 360 : 280;
    ctx.font = `900 ${numberFontSize}px Impact, 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Shadow
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 6;

    // Draw number
    ctx.fillStyle = "#000000";
    ctx.fillText(bibNumber, W / 2, H / 2 - 30);

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // ── LAYER 3: Participant name (bottom center)
    const fullName = `${reg.firstName || ""} ${reg.lastName || ""}`.toUpperCase().trim();
    ctx.font = `bold 52px 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#000000";
    ctx.fillText(fullName, W / 2, H - 52);

    // ── LAYER 4: Team logo bottom-left corner (if exists)
    if (logoImg) {
      const maxLogoW = 180;
      const maxLogoH = 120;
      const scale = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height);
      const lw = logoImg.width * scale;
      const lh = logoImg.height * scale;
      ctx.drawImage(logoImg, 24, H - lh - 24, lw, lh);
    }

    return canvas.toDataURL("image/jpeg", 0.92);
  };

  // Generate preview for first participant
  const handlePreview = async () => {
    if (!registrations.length || !selectedEvent) return;
    setIsPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const first = registrations[0];
      const url = await generateBibCanvas(first, selectedEvent);
      setPreviewUrl(url);
    } catch (e) {
      alert("Error generando vista previa.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Batch download all bibs as ZIP
  const handleBatchDownload = async () => {
    if (!registrations.length || !selectedEvent) return;
    setIsGenerating(true);
    setProgress("Iniciando...");
    try {
      const zip = new JSZip();
      let count = 0;
      for (const reg of registrations) {
        const bibNumber = String(parseInt(reg.folio?.replace(/\D/g, '') || "0", 10));
        setProgress(`Generando dorsal ${bibNumber} de ${registrations.length}... (${count + 1}/${registrations.length})`);
        const dataUrl = await generateBibCanvas(reg, selectedEvent);
        if (dataUrl) {
          const base64 = dataUrl.split(",")[1];
          zip.file(`Dorsal_${bibNumber}_${(reg.firstName || "").toUpperCase()}.jpg`, base64, { base64: true });
          count++;
        }
      }
      setProgress("Empaquetando ZIP...");
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `Dorsales_${selectedEvent.name}_${Date.now()}.zip`);
      setProgress("");
    } catch (e) {
      alert("Error generando los dorsales.");
      setProgress("");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 flex flex-col h-full overflow-y-auto custom-scrollbar space-y-8 text-white">

      {/* Header */}
      <div>
        <h2 className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-1 flex items-center gap-2">
          <Tag className="w-3 h-3" /> Módulo de Impresión
        </h2>
        <h1 className="text-2xl font-light text-white tracking-tight">
          Generador de <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#ff9500] to-[#ff5f6d]">Dorsales HD</span>
        </h1>
        <p className="text-gray-500 text-[11px] uppercase tracking-widest font-bold mt-2">
          Genera los números de dorsal para impresión en modo batch — listos para la imprenta.
        </p>
      </div>

      {/* Event Selector */}
      <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-6">
        <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#ff9500] mb-3 block">
          1. Selecciona el evento
        </label>
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          className="w-full bg-[#171821] border border-[#ffffff10] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff9500] appearance-none font-medium"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ff9500' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
        >
          <option value="">— Elige un evento —</option>
          {events.map(ev => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>

        {selectedEventId && (
          <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-bold uppercase tracking-widest">
            <span className="bg-[#ff9500]/10 text-[#ff9500] border border-[#ff9500]/20 px-3 py-1.5 rounded-full">
              {registrations.length} participantes
            </span>
            {selectedEvent?.bibTemplateUrl ? (
              <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-full">
                ✓ Plantilla de dorsal configurada
              </span>
            ) : (
              <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1.5 rounded-full">
                ⚠ Sin plantilla — se usará fondo oscuro por defecto
              </span>
            )}
          </div>
        )}
      </div>

      {/* Preview + Actions */}
      {selectedEventId && registrations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Preview Panel */}
          <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-6 flex flex-col gap-4">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">2. Vista Previa</h3>
              <p className="text-xs text-gray-500">Muestra el dorsal del primer participante para verificar el diseño antes de descargar el lote.</p>
            </div>

            {previewUrl ? (
              <div className="rounded-xl overflow-hidden border border-[#ffffff10] shadow-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt="Previsualización dorsal" className="w-full object-contain" />
              </div>
            ) : (
              <div className="aspect-[10/7] bg-[#171821] rounded-xl border border-dashed border-[#ffffff10] flex items-center justify-center">
                <div className="text-center">
                  <Tag className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Vista previa aquí</p>
                </div>
              </div>
            )}

            <button
              onClick={handlePreview}
              disabled={isPreviewLoading}
              className="w-full py-3 rounded-xl font-bold text-[11px] uppercase tracking-widest border border-[#ff9500]/30 text-[#ff9500] bg-[#ff9500]/10 hover:bg-[#ff9500]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isPreviewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {isPreviewLoading ? "Generando..." : `Generar Preview (${registrations[0]?.firstName || "Participante 1"})`}
            </button>
          </div>

          {/* Batch Download Panel */}
          <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-6 flex flex-col gap-4">
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">3. Descarga en Lote</h3>
              <p className="text-xs text-gray-500">
                Genera un dorsal JPG por cada participante y los empaqueta en un archivo ZIP listo para llevar a imprenta.
              </p>
            </div>

            {/* Participants list preview */}
            <div className="bg-[#171821] rounded-xl border border-[#ffffff0a] max-h-52 overflow-y-auto custom-scrollbar">
              {registrations.map((reg, i) => {
                const bibNum = String(parseInt(reg.folio?.replace(/\D/g, '') || "0", 10));
                return (
                  <div key={reg.id} className="flex items-center justify-between px-4 py-3 border-b border-[#ffffff05] last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[#ff9500] font-mono font-bold text-base w-8 text-right">{bibNum}</span>
                      <span className="text-gray-300 text-sm font-medium">{reg.firstName} {reg.lastName}</span>
                    </div>
                    {reg.logoUrl && (
                      <span className="text-[9px] text-green-400 font-bold uppercase tracking-widest">+ Logo</span>
                    )}
                  </div>
                );
              })}
            </div>

            {isGenerating && progress && (
              <div className="bg-[#ff9500]/10 border border-[#ff9500]/20 rounded-xl px-4 py-3">
                <p className="text-[#ff9500] text-[11px] font-bold uppercase tracking-widest flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin" /> {progress}
                </p>
              </div>
            )}

            <button
              onClick={handleBatchDownload}
              disabled={isGenerating}
              className="w-full py-4 bg-gradient-to-r from-[#ff9500] to-[#ff5f6d] text-white rounded-xl font-black text-[12px] uppercase tracking-widest shadow-[0_0_20px_rgba(255,149,0,0.3)] hover:shadow-[0_0_30px_rgba(255,149,0,0.5)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
            >
              {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderArchive className="w-5 h-5" />}
              {isGenerating ? progress || "Generando..." : `Descargar ${registrations.length} Dorsales (ZIP)`}
            </button>

            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold text-center">
              Formato: JPG 1200×840px • Calidad imprenta 150 DPI
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedEventId && (
        <div className="bg-[#242636]/40 border border-dashed border-[#ffffff0a] rounded-3xl p-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-[#ff9500]/10 rounded-2xl flex items-center justify-center mb-4">
            <Tag className="w-8 h-8 text-[#ff9500]" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Generador de Dorsales</h3>
          <p className="text-gray-500 text-sm max-w-md">
            Selecciona un evento arriba para ver los participantes inscritos y generar sus dorsales de competencia en formato de imprenta.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">
            <div className="bg-[#171821] px-3 py-2 rounded-lg">1. Elige Evento</div>
            <div className="bg-[#171821] px-3 py-2 rounded-lg">2. Preview Dorsal</div>
            <div className="bg-[#171821] px-3 py-2 rounded-lg">3. Descarga ZIP</div>
          </div>
        </div>
      )}

      {selectedEventId && registrations.length === 0 && (
        <div className="bg-[#242636]/40 border border-dashed border-[#ffffff0a] rounded-3xl p-12 flex flex-col items-center text-center">
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Sin participantes registrados en este evento aún.</p>
        </div>
      )}
    </div>
  );
}
