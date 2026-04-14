"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where, updateDoc, doc } from "firebase/firestore";
import { useAuth } from "@/components/admin/AuthProvider";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Tag, FolderArchive, Loader2, Save, CheckCircle2, Eye } from "lucide-react";

const DEFAULT_BIB_CONFIG = {
  numberColor: "#000000",
  nameColor: "#000000",
  numberXPct: 50,   // % del ancho
  numberYPct: 48,   // % del alto
  nameXPct: 50,     // % del ancho
  nameYPct: 88,     // % del alto
  logoXPct: 3,      // % desde izquierda
  logoYPct: 76,     // % desde arriba
};

type BibConfig = typeof DEFAULT_BIB_CONFIG;

export default function BibsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState("");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [config, setConfig] = useState<BibConfig>(DEFAULT_BIB_CONFIG);
  const isSuperAdmin = user?.email === "eder.beltran.acosta@gmail.com";

  // Load events
  useEffect(() => {
    if (!user) return;
    const q = isSuperAdmin
      ? collection(db, "events")
      : query(collection(db, "events"), where("organizerEmail", "==", user.email));
    return onSnapshot(q, snap => setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [user, isSuperAdmin]);

  // When event is selected, load its saved config
  useEffect(() => {
    if (!selectedEventId) { setRegistrations([]); setSelectedEvent(null); return; }
    const ev = events.find(e => e.id === selectedEventId);
    setSelectedEvent(ev || null);
    setPreviewUrl(null);
    setConfigSaved(false);
    // Restore saved bibConfig or use defaults
    if (ev?.bibConfig) {
      setConfig({ ...DEFAULT_BIB_CONFIG, ...ev.bibConfig });
    } else {
      setConfig(DEFAULT_BIB_CONFIG);
    }
    const q = query(collection(db, "registrations"), where("eventId", "==", selectedEventId));
    return onSnapshot(q, snap => setRegistrations(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [selectedEventId, events]);

  // Auto-regenerate preview when config changes (debounced)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedEventId || !registrations.length) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      generatePreview();
    }, 600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, registrations, selectedEvent]);

  const getProxyUrl = (url?: string) => {
    if (!url) return "";
    if (url.startsWith("blob:") || url.startsWith("data:")) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const generateBibCanvas = async (reg: any, event: any, cfg: BibConfig): Promise<string | null> => {
    const W = 1200, H = 840;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
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

    const bibNumber = String(parseInt(reg.folio?.replace(/\D/g, '') || "0", 10));

    const [templateImg, logoImg] = await Promise.all([
      event?.bibTemplateUrl ? loadImage(getProxyUrl(event.bibTemplateUrl)) : Promise.resolve(null),
      reg.logoUrl ? loadImage(getProxyUrl(reg.logoUrl)) : Promise.resolve(null),
    ]);

    // LAYER 0: White background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // LAYER 1: Canva template
    if (templateImg) {
      ctx.drawImage(templateImg, 0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, "#1b1c27");
      grad.addColorStop(1, "#25283d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // LAYER 2: Giant bib number
    const numFontSize = bibNumber.length <= 2 ? 440 : bibNumber.length <= 3 ? 360 : 280;
    ctx.font = `900 ${numFontSize}px Impact, 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 16; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4;
    ctx.fillStyle = cfg.numberColor;
    ctx.fillText(bibNumber, W * (cfg.numberXPct / 100), H * (cfg.numberYPct / 100));
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

    // LAYER 3: Participant name
    const fullName = `${reg.firstName || ""} ${reg.lastName || ""}`.toUpperCase().trim();
    ctx.font = `bold 52px 'Arial Black', Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = cfg.nameColor;
    ctx.fillText(fullName, W * (cfg.nameXPct / 100), H * (cfg.nameYPct / 100));

    // LAYER 4: Team logo
    if (logoImg) {
      const maxW = 180, maxH = 120;
      const scale = Math.min(maxW / logoImg.width, maxH / logoImg.height);
      const lw = logoImg.width * scale, lh = logoImg.height * scale;
      ctx.drawImage(logoImg, W * (cfg.logoXPct / 100), H * (cfg.logoYPct / 100), lw, lh);
    }

    return canvas.toDataURL("image/jpeg", 0.92);
  };

  const generatePreview = useCallback(async () => {
    if (!registrations.length || !selectedEvent) return;
    setIsPreviewLoading(true);
    try {
      const url = await generateBibCanvas(registrations[0], selectedEvent, config);
      setPreviewUrl(url);
    } catch { /* silent */ }
    finally { setIsPreviewLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registrations, selectedEvent, config]);

  const handleSaveConfig = async () => {
    if (!selectedEventId) return;
    setIsSavingConfig(true);
    try {
      await updateDoc(doc(db, "events", selectedEventId), { bibConfig: config });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 3000);
    } catch { alert("Error guardando configuración."); }
    finally { setIsSavingConfig(false); }
  };

  const handleBatchDownload = async () => {
    if (!registrations.length || !selectedEvent) return;
    setIsGenerating(true);
    try {
      const zip = new JSZip();
      let count = 0;
      for (const reg of registrations) {
        const bibNumber = String(parseInt(reg.folio?.replace(/\D/g, '') || "0", 10));
        setProgress(`Generando ${count + 1}/${registrations.length} — Dorsal #${bibNumber}`);
        const dataUrl = await generateBibCanvas(reg, selectedEvent, config);
        if (dataUrl) {
          zip.file(`Dorsal_${bibNumber}_${(reg.firstName || "").toUpperCase()}.jpg`, dataUrl.split(",")[1], { base64: true });
          count++;
        }
      }
      setProgress("Empaquetando ZIP...");
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `Dorsales_${selectedEvent.name}_${Date.now()}.zip`);
    } catch { alert("Error generando dorsales."); }
    finally { setIsGenerating(false); setProgress(""); }
  };

  const setC = (key: keyof BibConfig, value: string | number) =>
    setConfig(prev => ({ ...prev, [key]: value }));

  const SliderRow = ({ label, configKey, min = 0, max = 100 }: { label: string; configKey: keyof BibConfig; min?: number; max?: number }) => (
    <div className="flex items-center gap-3">
      <span className="text-[9px] uppercase font-bold text-gray-500 tracking-widest w-28 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={1}
        value={config[configKey] as number}
        onChange={e => setC(configKey, parseFloat(e.target.value))}
        className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-[#ff9500]"
      />
      <span className="text-[10px] font-mono text-[#ff9500] w-8 text-right">{config[configKey]}%</span>
    </div>
  );

  return (
    <div className="p-4 lg:p-8 flex flex-col h-full overflow-y-auto custom-scrollbar space-y-6 text-white">

      {/* Header */}
      <div>
        <h2 className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-1 flex items-center gap-2">
          <Tag className="w-3 h-3" /> Módulo de Impresión
        </h2>
        <h1 className="text-2xl font-light text-white tracking-tight">
          Generador de <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#ff9500] to-[#ff5f6d]">Dorsales HD</span>
        </h1>
      </div>

      {/* Event Selector */}
      <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-5">
        <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#ff9500] mb-2 block">Evento</label>
        <select
          value={selectedEventId}
          onChange={e => setSelectedEventId(e.target.value)}
          className="w-full bg-[#171821] border border-[#ffffff10] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#ff9500] appearance-none font-medium"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ff9500' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
        >
          <option value="">— Elige un evento —</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
        </select>
        {selectedEventId && (
          <div className="mt-3 flex flex-wrap gap-3">
            <span className="bg-[#ff9500]/10 text-[#ff9500] border border-[#ff9500]/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
              {registrations.length} participantes
            </span>
            {selectedEvent?.bibTemplateUrl
              ? <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">✓ Plantilla configurada</span>
              : <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">⚠ Sin plantilla PNG</span>
            }
            {selectedEvent?.bibConfig && (
              <span className="bg-[#4b55f5]/10 text-[#4b55f5] border border-[#4b55f5]/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">✓ Config guardada</span>
            )}
          </div>
        )}
      </div>

      {selectedEventId && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── LEFT: Config Panel ── */}
          <div className="space-y-4">

            {/* Colors */}
            <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-5 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#ff9500]">🎨 Colores</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest block">Color del Número</label>
                  <div className="flex items-center gap-3 bg-[#171821] p-3 rounded-xl border border-[#ffffff10]">
                    <input type="color" value={config.numberColor} onChange={e => setC("numberColor", e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent" />
                    <span className="text-gray-300 text-[11px] font-mono font-bold">{config.numberColor}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest block">Color del Nombre</label>
                  <div className="flex items-center gap-3 bg-[#171821] p-3 rounded-xl border border-[#ffffff10]">
                    <input type="color" value={config.nameColor} onChange={e => setC("nameColor", e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent" />
                    <span className="text-gray-300 text-[11px] font-mono font-bold">{config.nameColor}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Positions */}
            <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-5 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#00d2ff]">📐 Posición del Número</h3>
              <SliderRow label="Horizontal (X)" configKey="numberXPct" />
              <SliderRow label="Vertical (Y)" configKey="numberYPct" />
            </div>

            <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-5 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#bb86fc]">📐 Posición del Nombre</h3>
              <SliderRow label="Horizontal (X)" configKey="nameXPct" />
              <SliderRow label="Vertical (Y)" configKey="nameYPct" />
            </div>

            <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-5 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[#00ff88]">📐 Posición del Logo</h3>
              <SliderRow label="Horizontal (X)" configKey="logoXPct" />
              <SliderRow label="Vertical (Y)" configKey="logoYPct" />
            </div>

            {/* Save Button */}
            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className={`w-full py-4 rounded-xl font-black text-[12px] uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${configSaved ? 'bg-green-500/20 border border-green-500/40 text-green-400' : 'bg-gradient-to-r from-[#4b55f5] to-[#884af0] text-white shadow-[0_0_20px_rgba(75,85,245,0.4)] hover:shadow-[0_0_30px_rgba(75,85,245,0.6)]'} disabled:opacity-50`}
            >
              {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : configSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {isSavingConfig ? "Guardando..." : configSaved ? "¡Configuración Guardada!" : "Guardar Configuración del Dorsal"}
            </button>
            {!configSaved && (
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold text-center -mt-2">
                Solo necesitas hacer esto una vez — queda guardado para siempre en este evento.
              </p>
            )}
          </div>

          {/* ── RIGHT: Preview + Batch ── */}
          <div className="space-y-4">

            {/* Live Preview */}
            <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vista Previa en Vivo</h3>
                {isPreviewLoading && <Loader2 className="w-3 h-3 animate-spin text-[#ff9500]" />}
              </div>
              {previewUrl ? (
                <div className="rounded-xl overflow-hidden border border-[#ffffff10] shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Previsualización dorsal" className="w-full object-contain" />
                </div>
              ) : (
                <div className="aspect-[10/7] bg-[#171821] rounded-xl border border-dashed border-[#ffffff10] flex items-center justify-center">
                  {isPreviewLoading
                    ? <Loader2 className="w-8 h-8 animate-spin text-[#ff9500]" />
                    : <div className="text-center"><Tag className="w-10 h-10 text-gray-600 mx-auto mb-2" /><p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest">Generando preview...</p></div>
                  }
                </div>
              )}
              <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold text-center">
                Se actualiza automáticamente al mover los controles · Participante: {registrations[0]?.firstName || "—"}
              </p>
            </div>

            {/* Participants list */}
            <div className="bg-[#242636]/60 border border-[#ffffff0a] rounded-2xl p-5 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">Participantes en este Lote</h3>
              <div className="bg-[#171821] rounded-xl border border-[#ffffff0a] max-h-48 overflow-y-auto custom-scrollbar">
                {registrations.map((reg) => {
                  const bibNum = String(parseInt(reg.folio?.replace(/\D/g, '') || "0", 10));
                  return (
                    <div key={reg.id} className="flex items-center justify-between px-4 py-2.5 border-b border-[#ffffff05] last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-[#ff9500] font-mono font-bold text-sm w-6 text-right">{bibNum}</span>
                        <span className="text-gray-300 text-[12px] font-medium">{reg.firstName} {reg.lastName}</span>
                      </div>
                      {reg.logoUrl && <span className="text-[9px] text-green-400 font-bold uppercase tracking-widest">+logo</span>}
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
                disabled={isGenerating || !registrations.length}
                className="w-full py-4 bg-gradient-to-r from-[#ff9500] to-[#ff5f6d] text-white rounded-xl font-black text-[12px] uppercase tracking-widest shadow-[0_0_20px_rgba(255,149,0,0.3)] hover:shadow-[0_0_30px_rgba(255,149,0,0.5)] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale"
              >
                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderArchive className="w-5 h-5" />}
                {isGenerating ? progress || "Generando..." : `Descargar ${registrations.length} Dorsales (ZIP)`}
              </button>
              <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold text-center">
                Formato JPG 1200×840px · Calidad imprenta
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedEventId && (
        <div className="bg-[#242636]/40 border border-dashed border-[#ffffff0a] rounded-3xl p-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-[#ff9500]/10 rounded-2xl flex items-center justify-center mb-4">
            <Tag className="w-8 h-8 text-[#ff9500]" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Generador de Dorsales</h3>
          <p className="text-gray-500 text-sm max-w-md">Selecciona un evento para configurar y generar los dorsales de competencia.</p>
          <div className="mt-6 grid grid-cols-3 gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">
            <div className="bg-[#171821] px-3 py-2 rounded-lg">1. Configura Colores</div>
            <div className="bg-[#171821] px-3 py-2 rounded-lg">2. Posiciona Elementos</div>
            <div className="bg-[#171821] px-3 py-2 rounded-lg">3. Guarda y Descarga</div>
          </div>
        </div>
      )}
    </div>
  );
}
