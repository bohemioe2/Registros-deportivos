"use client";

import { useState, useEffect } from "react";
import { Scanner } from "@yudiel/react-qr-scanner";
import { QrCode, CheckCircle2, AlertTriangle, User, Award, CheckCircle, Loader2 } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/components/admin/AuthProvider";
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";

export default function ScannerPage() {
  const { role, assignedEventId } = useAuth();
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [participantInfo, setParticipantInfo] = useState<any | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false); // To avoid SSR window issues

  useEffect(() => {
    setIsReady(true);
  }, []);

  const handleScan = async (result: string) => {
    if (!result || loading) return;
    
    // Normalize input to avoid issues with extra spaces
    let cleanResult = result.trim();
    if (!cleanResult) return;
    
    // Si el usuario ingresa solo números (ej: "2" o "002"), autocompletamos el prefijo FOL-
    if (/^\d+$/.test(cleanResult)) {
       cleanResult = `FOL-${String(cleanResult).padStart(3, '0')}`;
    }
    
    if (scannedId === cleanResult) return;
    
    setScannedId(cleanResult);
    setLoading(true);
    setParticipantInfo(null);
    setErrorStatus(null);

    try {
      // 1. First try by Document ID
      const docRef = doc(db, "registrations", cleanResult);
      let snap: any = await getDoc(docRef);
      let data = snap.exists() ? snap.data() : null;
      let actualId = snap.id;

      // 2. If not found, try searching by Folio
      if (!data) {
        const q = query(collection(db, "registrations"), where("folio", "==", cleanResult.toUpperCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          snap = querySnapshot.docs[0];
          data = snap.data();
          actualId = snap.id;
        }
      }

      if (data) {
        // Bloqueo de seguridad: El organizador solo puede escanear su evento
        if (role === "ORGANIZER" && data.eventId !== assignedEventId) {
          setErrorStatus(`ERROR DE SEGURIDAD: Este atleta pertenece a otro evento. No tienes permisos para escanearlo.`);
          setLoading(false);
          return;
        }
        
        // --- VALIDACIÓN DE SEGURIDAD DOBLE REGISTRO ---
        if (data.checkedInAt) {
           setErrorStatus(`⚠️ ERROR DE SEGURIDAD: DOBLE REGISTRO DETECTADO. Este folio (#${data.folio?.slice(-3)}) YA fue REGISTRADO en Mesa el ${new Date(data.checkedInAt).toLocaleString()}.`);
           setLoading(false);
           return;
        }

        if (data.status !== "APPROVED") {
           setErrorStatus(`ESTADO NO AUTORIZADO: El corredor tiene estado '${data.status}'. Cobrar o auditar en mesa.`);
        }
        setParticipantInfo({ ...data, id: actualId });
      } else {
        setErrorStatus("DOCUMENTO INEXISTENTE. El QR o Folio ingresado no pertenece a la base de datos.");
      }
    } catch (e) {
      setErrorStatus("Fallo en la conexión de escáner a la Nube.");
    } finally {
      setLoading(false);
      setManualInput(""); // Clear manual input after searching
    }
  };

  const markAsCheckedIn = async () => {
    if (!participantInfo?.id) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, "registrations", participantInfo.id), {
        checkedInAt: new Date().toISOString()
      });
      setParticipantInfo({ ...participantInfo, checkedInAt: new Date().toISOString() });
    } catch (e) {
      alert("Error haciendo check-in en la nube.");
    }
    setLoading(false);
  };

  if (!isReady) return null;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#1b1c27] text-white p-6 pb-20 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center gap-4 border-b border-[#ffffff10] pb-6">
          <div className="w-12 h-12 bg-gradient-to-tr from-[#00d2ff] to-[#4b55f5] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(75,85,245,0.4)]">
            <QrCode className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-light tracking-tight">Scanner de <span className="font-bold text-[#00d2ff]">Acceso Rápido</span></h1>
            <p className="text-gray-400 text-xs sm:text-sm font-medium mt-1 uppercase tracking-widest">Escanea el QR de la hoja de resumen o celular</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* Lado de Escáner */}
          <div className="bg-[#171821] p-6 sm:p-8 rounded-3xl border border-[#ffffff0a] shadow-inner relative overflow-hidden flex flex-col items-center">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#4b55f5]/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
             
             <h2 className="text-[12px] uppercase font-bold text-gray-400 tracking-[0.2em] mb-6 w-full text-left">Lente Óptico</h2>
             
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
             
             {/* Búsqueda manual */}
             <div className="w-full max-w-sm mt-8 border-t border-[#ffffff10] pt-6 flex flex-col gap-3">
                <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">O Ingresa Folio Manualmente:</p>
                <div className="flex gap-2">
                     <input 
                       type="text" 
                       placeholder="Ej: 2 o FOL-002"
                       value={manualInput}
                       onChange={(e) => setManualInput(e.target.value)}
                       onKeyDown={(e) => e.key === 'Enter' && handleScan(manualInput)}
                       className="flex-1 bg-[#1b1c27] border border-[#ffffff20] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#00d2ff] font-mono"
                     />
                   <button 
                     onClick={() => handleScan(manualInput)}
                     disabled={!manualInput.trim()}
                     className="bg-[#00d2ff]/20 text-[#00d2ff] hover:bg-[#00d2ff]/30 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-3 rounded-xl font-bold text-sm transition-colors"
                   >
                     Buscar
                   </button>
                </div>
             </div>

             <button onClick={() => {setScannedId(null); setParticipantInfo(null); setErrorStatus(null); setManualInput("");}} className="text-[#00d2ff] text-[10px] uppercase font-bold tracking-widest bg-[#00d2ff]/10 hover:bg-[#00d2ff]/20 px-6 py-3 rounded-xl transition-colors mt-6">
               Reiniciar Lente Manualmente
             </button>
          </div>

          {/* Lado de Resultados */}
          <div className="bg-[#242636]/60 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-[#ffffff0a] shadow-[0_10px_40px_rgba(0,0,0,0.3)] min-h-[500px] flex flex-col">
            <h2 className="text-[12px] uppercase font-bold text-gray-400 tracking-[0.2em] mb-6 border-b border-[#ffffff10] pb-4">Auditoría de Participante</h2>
            
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                 <Loader2 className="w-10 h-10 animate-spin mb-4 text-[#4b55f5]" />
                 <p className="uppercase text-[10px] font-bold tracking-widest">Desencriptando Nube...</p>
              </div>
            ) : errorStatus ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                 <AlertTriangle className="w-16 h-16 text-[#ff5f6d] mb-4" />
                 <p className="text-[#ff5f6d] font-bold text-lg uppercase tracking-wider mb-2">Bloqueo de Seguridad</p>
                 <p className="text-gray-400 text-xs uppercase tracking-widest">{errorStatus}</p>
              </div>
            ) : participantInfo ? (
              <div className="flex-1 flex flex-col animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-start mb-6">
                   <div>
                     <p className="text-[10px] uppercase tracking-widest font-bold text-[#00d2ff] mb-1">Identidad Confirmada</p>
                     <p className="text-3xl font-light text-white">{participantInfo.firstName} <span className="font-bold">{participantInfo.lastName}</span></p>
                     <p className="text-gray-400 text-sm font-mono tracking-widest mt-1">{participantInfo.folio}</p>
                   </div>
                   {participantInfo.checkedInAt ? (
                      <div className="bg-green-500/10 text-green-400 p-3 rounded-full border border-green-500/20" title="Check-in completado">
                         <CheckCircle className="w-6 h-6" />
                      </div>
                   ) : (
                      <div className="bg-[#171821] text-gray-500 p-3 rounded-full border border-[#ffffff10]">
                         <User className="w-6 h-6" />
                      </div>
                   )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                   <div className="bg-[#171821] p-4 rounded-xl border border-[#ffffff0a]">
                     <p className="text-[9px] uppercase tracking-widest font-bold text-gray-500 mb-1">Categoría</p>
                     <p className="text-white text-sm font-bold uppercase tracking-wider">{participantInfo.gender === 'MALE' ? 'Varonil' : 'Femenil'} — {participantInfo.age} Años</p>
                   </div>
                   <div className="bg-[#171821] p-4 rounded-xl border border-[#ffffff0a]">
                     <p className="text-[9px] uppercase tracking-widest font-bold text-gray-500 mb-1">Estado Médico</p>
                     <p className="text-[#ff5f6d] font-mono font-bold text-lg">{participantInfo.bloodType || "N/A"}</p>
                   </div>
                </div>
                
                {/* === TEXTILE AND KIT RENDERING ALGORITHM === */}
                <div className="bg-[#171821] border border-[#00d2ff]/30 p-5 rounded-2xl relative overflow-hidden group mb-6">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-[#00d2ff]/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                   <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#00d2ff] flex items-center gap-2 mb-3">
                     <Award className="w-4 h-4" /> Entregables Oficiales en Mesa
                   </p>
                   <p className="font-bold text-white text-2xl uppercase tracking-widest mb-4">
                     {participantInfo.kitName || "Kit Básico / General"}
                   </p>
                   
                   {participantInfo.jerseyType && participantInfo.jerseyType !== "N/A" && (
                     <div className="bg-black/40 border border-[#ff5f6d]/30 px-5 py-3 rounded-xl flex items-center justify-between shadow-inner">
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-bold text-[#ff5f6d] mb-0.5">Entregar Prenda: {participantInfo.jerseyType}</p>
                          <p className="text-gray-300 font-bold uppercase text-[12px] tracking-widest flex items-center gap-2">Talla Física Requerida:</p>
                        </div>
                        <span className="bg-[#ff5f6d] text-black px-4 py-1 rounded shadow-[0_0_15px_rgba(255,95,109,0.4)] font-bold text-lg font-mono tracking-widest">
                           {participantInfo.jerseySize}
                        </span>
                     </div>
                   )}
                </div>
                
                <div className="mt-auto pt-4 border-t border-[#ffffff0a]">
                   {participantInfo.checkedInAt ? (
                     <button disabled className="w-full bg-green-500/10 text-green-500 border border-green-500/30 text-xs font-bold uppercase tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-not-allowed">
                       <CheckCircle2 className="w-4 h-4" /> Atleta Entregado Exitosamente
                     </button>
                   ) : (
                     <button onClick={markAsCheckedIn} className="w-full bg-gradient-to-r from-[#00d2ff] to-[#4b55f5] text-white text-xs font-bold uppercase tracking-widest py-4 rounded-xl transition-transform hover:scale-105 shadow-[0_0_20px_rgba(75,85,245,0.4)] flex items-center justify-center gap-2">
                       Marcar como Checado en Mesa
                     </button>
                   )}
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 opacity-30">
                 <QrCode className="w-16 h-16 mb-4 filter blur-[1px]" />
                 <p className="text-white font-bold text-lg uppercase tracking-wider mb-2">Modo Reposo</p>
                 <p className="text-gray-400 text-xs uppercase tracking-widest">Coloca un QR frente al Lente Óptico para invocar a la base de datos.</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
