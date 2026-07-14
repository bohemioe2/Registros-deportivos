"use client";

import { useState, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { QrCode, CheckCircle2, AlertTriangle, User, Award, CheckCircle, Loader2, Search, Medal } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/components/admin/AuthProvider";
import { doc, getDoc, updateDoc, collection, query, where, getDocs, onSnapshot } from "firebase/firestore";

export default function MedalsPage() {
  const { role, assignedEventId } = useAuth();
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [participantInfo, setParticipantInfo] = useState<any | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [eventsData, setEventsData] = useState<{ [key: string]: any }>({});
  
  // Para la búsqueda manual
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Estadísticas
  const [stats, setStats] = useState({ delivered: 0, pending: 0, noMedal: 0 });

  useEffect(() => {
    setIsReady(true);
    // Cargar la configuración de los eventos para saber qué kits incluyen medallas
    const unsubEvents = onSnapshot(collection(db, "events"), (snapshot) => {
      const eventsMap: { [key: string]: any } = {};
      snapshot.forEach(d => {
        eventsMap[d.id] = d.data();
      });
      setEventsData(eventsMap);
    });

    return () => unsubEvents();
  }, []);

  // Escuchar estadísticas en tiempo real del evento actual asignado
  useEffect(() => {
    if (!role) return;

    let q;
    const baseColl = collection(db, "registrations");
    if (role === "SUPERADMIN") {
      q = baseColl; // Global
    } else if (assignedEventId) {
      q = query(baseColl, where("eventId", "==", assignedEventId));
    } else {
      return;
    }

    const unsubStats = onSnapshot(q, (snapshot) => {
      let delivered = 0;
      let pending = 0;
      let noMedal = 0;

      snapshot.docs.forEach(d => {
        const data = d.data();
        if (data.status !== "APPROVED") return;

        const eventConfig = eventsData[data.eventId];
        const kitConfig = eventConfig?.kits?.find((k: any) => k.name === data.kitName);
        
        // Si no existe la configuración del kit, o includesMedal es true/undefined, se considera que incluye medalla
        const includesMedal = kitConfig ? (kitConfig.includesMedal !== false) : true;

        if (!includesMedal) {
          noMedal++;
        } else if (data.medalDeliveredAt) {
          delivered++;
        } else {
          pending++;
        }
      });

      setStats({ delivered, pending, noMedal });
    });

    return () => unsubStats();
  }, [role, assignedEventId, eventsData]);

  const processParticipant = async (data: any, docId: string) => {
    // Bloqueo de seguridad: El organizador solo puede escanear su evento
    if (role === "ORGANIZER" && data.eventId !== assignedEventId) {
      setErrorStatus(`ERROR DE SEGURIDAD: Este atleta pertenece a otro evento. No tienes permisos para escanearlo.`);
      setLoading(false);
      return;
    }

    if (data.status !== "APPROVED") {
      setErrorStatus(`ESTADO NO AUTORIZADO: El corredor tiene estado '${data.status}'.`);
      setLoading(false);
      return;
    }

    // --- VALIDACIÓN DE MEDALLA ENTREGADA O LLEGADA ---
    if (data.finishedAt || data.medalDeliveredAt) {
      setErrorStatus(`⚠️ ALERTA: LLEGADA YA REGISTRADA PREVIAMENTE EL ${new Date(data.finishedAt || data.medalDeliveredAt).toLocaleString()}.`);
      setLoading(false);
      return;
    }

    // --- VERIFICAR DERECHO A MEDALLA ---
    const eventConfig = eventsData[data.eventId];
    let hasRightToMedal = true;
    if (eventConfig) {
      const kitConfig = eventConfig.kits?.find((k: any) => k.name === data.kitName);
      if (kitConfig && kitConfig.includesMedal === false) {
         hasRightToMedal = false;
      }
    }
    
    // Regla especial: Límite de 200 medallas físicas
    if (data.folioNumber > 200) {
      hasRightToMedal = false;
    }

    setParticipantInfo({ ...data, id: docId, hasRightToMedal });
    setLoading(false);
  };

  const handleScan = async (result: string) => {
    if (!result || scannedId === result || loading) return;
    setScannedId(result);
    setLoading(true);
    setParticipantInfo(null);
    setErrorStatus(null);
    setSearchQuery("");
    setSearchResults([]);

    try {
      const docRef = doc(db, "registrations", result);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        await processParticipant(snap.data(), snap.id);
      } else {
        setErrorStatus("DOCUMENTO INEXISTENTE. El QR escaneado no pertenece a la base de datos.");
        setLoading(false);
      }
    } catch (e) {
      setErrorStatus("Fallo en la conexión de escáner a la Nube.");
      setLoading(false);
    }
  };

  const handleManualSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setParticipantInfo(null);
    setErrorStatus(null);
    setScannedId(null);
    
    let parsedQuery = searchQuery.trim();
    if (/^\d+$/.test(parsedQuery)) {
       parsedQuery = `FOL-${String(parsedQuery).padStart(3, '0')}`;
    }
    
    try {
      const qByName = query(
        collection(db, "registrations"),
        where("firstName", ">=", parsedQuery),
        where("firstName", "<=", parsedQuery + '\uf8ff')
      );
      const qByFolio = query(
        collection(db, "registrations"),
        where("folio", "==", parsedQuery.toUpperCase())
      );

      const [snapName, snapFolio] = await Promise.all([getDocs(qByName), getDocs(qByFolio)]);
      
      let results: any[] = [];
      snapName.forEach(d => results.push({ id: d.id, ...d.data() }));
      snapFolio.forEach(d => {
        if (!results.find(r => r.id === d.id)) results.push({ id: d.id, ...d.data() });
      });

      // Filtrar por evento si es organizador
      if (role === "ORGANIZER" && assignedEventId) {
        results = results.filter(r => r.eventId === assignedEventId);
      }

      setSearchResults(results);
      if (results.length === 0) {
         setErrorStatus("No se encontró ningún participante con ese nombre o folio.");
      } else if (results.length === 1) {
         // Si solo hay uno, procesarlo directamente
         await processParticipant(results[0], results[0].id);
         setSearchResults([]);
      }
    } catch (error) {
      setErrorStatus("Error realizando la búsqueda manual.");
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = async (result: any) => {
    setLoading(true);
    setSearchResults([]);
    setErrorStatus(null);
    await processParticipant(result, result.id);
  };

  const markAsFinished = async () => {
    if (!participantInfo?.id) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const updates: any = { finishedAt: now };
      if (participantInfo.hasRightToMedal) {
         updates.medalDeliveredAt = now;
      }
      await updateDoc(doc(db, "registrations", participantInfo.id), updates);
      setParticipantInfo({ ...participantInfo, ...updates });
    } catch (e) {
      alert("Error registrando la llegada a meta en la nube.");
    }
    setLoading(false);
  };

  if (!isReady) return null;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#1b1c27] text-white p-6 pb-20 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-[#ffffff10] pb-6 flex-wrap gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-[#ffc371] to-[#ff5f6d] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,95,109,0.4)]">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-light tracking-tight">Scanner de <span className="font-bold text-[#ffc371]">Meta / Medallas</span></h1>
              <p className="text-gray-400 text-xs sm:text-sm font-medium mt-1 uppercase tracking-widest">Registra llegadas y controla entregables</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-center">
            <div className="bg-[#242636] border border-[#ffffff10] rounded-xl px-4 py-2">
               <p className="text-[9px] uppercase tracking-widest text-gray-400">Entregadas</p>
               <p className="text-[#00d2ff] font-mono font-bold text-lg">{stats.delivered}</p>
            </div>
            <div className="bg-[#242636] border border-[#ffffff10] rounded-xl px-4 py-2">
               <p className="text-[9px] uppercase tracking-widest text-gray-400">Pendientes</p>
               <p className="text-[#ffc371] font-mono font-bold text-lg">{stats.pending}</p>
            </div>
            <div className="bg-[#242636] border border-[#ffffff10] rounded-xl px-4 py-2 opacity-70">
               <p className="text-[9px] uppercase tracking-widest text-[#ff5f6d]">Sin Medalla</p>
               <p className="text-white font-mono font-bold text-lg">{stats.noMedal}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Lado de Escáner y Búsqueda */}
          <div className="bg-[#171821] p-6 sm:p-8 rounded-3xl border border-[#ffffff0a] shadow-inner relative overflow-hidden flex flex-col items-center">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff5f6d]/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
             
             {/* Buscador Manual */}
             <div className="w-full mb-8 relative z-10">
               <form onSubmit={handleManualSearch} className="relative w-full">
                 <input 
                   type="text" 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="Buscar por Folio (Ej: 2, 15 o CF-12345) o Nombre..."
                   className="w-full bg-[#242636] border border-[#ffffff10] text-white rounded-xl py-3 pl-12 pr-4 text-sm font-medium focus:outline-none focus:border-[#ffc371] transition-all shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]"
                 />
                 <button type="submit" disabled={isSearching} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#ffc371] transition-colors">
                   {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                 </button>
               </form>

               {/* Resultados de búsqueda múltiples */}
               {searchResults.length > 0 && (
                 <div className="absolute top-full left-0 right-0 mt-2 bg-[#242636] border border-[#ffffff20] rounded-xl shadow-2xl max-h-60 overflow-y-auto z-50">
                   {searchResults.map(res => (
                     <button 
                       key={res.id} 
                       onClick={() => selectSearchResult(res)}
                       className="w-full text-left px-4 py-3 border-b border-[#ffffff10] hover:bg-[#303348] transition-colors flex items-center justify-between"
                     >
                       <div>
                         <p className="text-sm font-bold text-white">{res.firstName} {res.lastName}</p>
                         <p className="text-[10px] uppercase text-gray-400 font-mono tracking-wider">{res.folio}</p>
                       </div>
                       <span className="text-[9px] uppercase tracking-widest text-[#ffc371] font-bold bg-[#ffc371]/10 px-2 py-1 rounded">Seleccionar</span>
                     </button>
                   ))}
                 </div>
               )}
             </div>

             <h2 className="text-[12px] uppercase font-bold text-gray-400 tracking-[0.2em] mb-4 w-full text-left">Lente Óptico (QR)</h2>
             
             <div className="w-full max-w-sm aspect-square bg-[#1b1c27] rounded-3xl border-2 border-dashed border-[#ffffff20] overflow-hidden relative shadow-[inset_0_10px_30px_rgba(0,0,0,0.5)]">
               <Scanner
                  onScan={(result: any) => handleScan(result[0].rawValue)}
                  onError={(error: any) => console.log(error?.message)}
                  components={{ audio: false, finder: false } as any}
                  allowMultiple={false}
               />
               
               {/* Mira de Escáner Flotante */}
               <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                 <div className="w-48 h-48 border border-white/30 rounded-3xl shadow-[0_0_0_4000px_rgba(0,0,0,0.4)]"></div>
               </div>
             </div>
             
             <button onClick={() => {setScannedId(null); setParticipantInfo(null); setErrorStatus(null); setSearchQuery(""); setSearchResults([]);}} className="text-[#ffc371] text-[10px] uppercase font-bold tracking-widest bg-[#ffc371]/10 hover:bg-[#ffc371]/20 px-6 py-3 rounded-xl transition-colors mt-8">
               Reiniciar Scanner y Búsqueda
             </button>
          </div>

          {/* Lado de Resultados */}
          <div className="bg-[#242636]/60 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-[#ffffff0a] shadow-[0_10px_40px_rgba(0,0,0,0.3)] min-h-[500px] flex flex-col">
            <h2 className="text-[12px] uppercase font-bold text-gray-400 tracking-[0.2em] mb-6 border-b border-[#ffffff10] pb-4">Auditoría de Llegada</h2>
            
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                 <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#ffc371]" />
                 <p className="uppercase text-[10px] font-bold tracking-widest">Verificando Derechos...</p>
              </div>
            ) : errorStatus ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                 <AlertTriangle className="w-16 h-16 text-[#ff5f6d] mb-4" />
                 <p className="text-[#ff5f6d] font-bold text-lg uppercase tracking-wider mb-2">Acceso Denegado</p>
                 <p className="text-gray-400 text-xs uppercase tracking-widest leading-relaxed">{errorStatus}</p>
              </div>
            ) : participantInfo ? (
              <div className="flex-1 flex flex-col animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-start mb-6">
                   <div>
                     <p className="text-[10px] uppercase tracking-widest font-bold text-[#ffc371] mb-1">Identidad Confirmada</p>
                     <p className="text-3xl font-light text-white">{participantInfo.firstName} <span className="font-bold">{participantInfo.lastName}</span></p>
                     <p className="text-gray-400 text-sm font-mono tracking-widest mt-1">{participantInfo.folio}</p>
                   </div>
                   {participantInfo.medalDeliveredAt ? (
                      <div className="bg-green-500/10 text-green-400 p-3 rounded-full border border-green-500/20" title="Medalla ya entregada">
                         <CheckCircle className="w-6 h-6" />
                      </div>
                   ) : (
                      <div className="bg-[#171821] text-gray-500 p-3 rounded-full border border-[#ffffff10]">
                         <User className="w-6 h-6" />
                      </div>
                   )}
                </div>
                
                {/* === DETALLE DEL KIT Y MEDALLA === */}
                {participantInfo.hasRightToMedal ? (
                   <div className="bg-[#171821] border border-[#ffc371]/30 p-5 rounded-2xl relative overflow-hidden group mb-6 flex-1">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#ffc371]/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#ffc371] flex items-center gap-2 mb-3">
                        <Medal className="w-4 h-4" /> Derecho a Medalla Comprobado
                      </p>
                      <p className="font-bold text-white text-xl uppercase tracking-widest mb-2">
                        {participantInfo.kitName || "Kit Básico / General"}
                      </p>
                      <p className="text-gray-400 text-xs uppercase tracking-widest leading-relaxed">
                        Este corredor adquirió un paquete con derecho a medalla de finalista. ENTREGAR MEDALLA.
                      </p>
                   </div>
                ) : (
                   <div className="bg-[#171821] border border-[#ff5f6d]/50 p-5 rounded-2xl relative overflow-hidden group mb-6 flex-1">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff5f6d]/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#ff5f6d] flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4" /> Finalista Sin Medalla
                      </p>
                      <p className="font-bold text-white text-xl uppercase tracking-widest mb-2">
                        {participantInfo.kitName || "Kit Sin Medalla"}
                      </p>
                      <p className="text-[#ff5f6d] text-xs uppercase tracking-widest font-bold leading-relaxed">
                        ATENCIÓN: Este atleta cruzó la meta pero NO tiene derecho a medalla. Registrar llegada únicamente.
                      </p>
                   </div>
                )}
                
                <div className="mt-auto pt-4 border-t border-[#ffffff0a]">
                   {participantInfo.finishedAt || participantInfo.medalDeliveredAt ? (
                     <button disabled className="w-full bg-green-500/10 text-green-500 border border-green-500/30 text-xs font-bold uppercase tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-not-allowed">
                       <CheckCircle2 className="w-4 h-4" /> Llegada Registrada ({new Date(participantInfo.finishedAt || participantInfo.medalDeliveredAt).toLocaleTimeString()})
                     </button>
                   ) : (
                     <button onClick={markAsFinished} className={`w-full text-white text-xs font-bold uppercase tracking-widest py-4 rounded-xl transition-transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 ${participantInfo.hasRightToMedal ? 'bg-gradient-to-r from-[#ffc371] to-[#ff5f6d] shadow-[0_0_20px_rgba(255,95,109,0.4)]' : 'bg-[#1c1d29] border border-[#ffffff20] hover:bg-[#242636]'}`}>
                       {participantInfo.hasRightToMedal ? 'Registrar Llegada y Entregar Medalla' : 'Registrar Llegada a Meta (Sin Medalla)'}
                     </button>
                   )}
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 opacity-30">
                 <Award className="w-16 h-16 mb-4 filter blur-[1px]" />
                 <p className="text-white font-bold text-lg uppercase tracking-wider mb-2">Modo Reposo</p>
                 <p className="text-gray-400 text-xs uppercase tracking-widest">Busca por Folio/Nombre o escanea el QR del atleta al cruzar la meta.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
