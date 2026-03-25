"use client";

import { useEffect, useState } from "react";
import { Search, Eye, Download, CheckCircle, X, FileText, Image as ImageIcon, CheckCircle2, Trash2, FolderArchive, ChevronDown } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { useAuth } from "@/components/admin/AuthProvider";
import WelcomePoster from "@/components/public/WelcomePoster";

export default function RegistrationsPage() {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("ALL");
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRegeneratingPoster, setIsRegeneratingPoster] = useState(false);
  const [ignoreUserLogo, setIgnoreUserLogo] = useState(false);
  
  const [isDownloadingBatch, setIsDownloadingBatch] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);
  
  const [batchStart, setBatchStart] = useState("");
  const [batchEnd, setBatchEnd] = useState("");

  const isSuperAdmin = user?.email === "eder.beltran.acosta@gmail.com";

  // 1. Obtener los eventos correspondientes al Rol
  useEffect(() => {
    if (!user) return;
    
    let q;
    if (isSuperAdmin) {
      q = collection(db, "events");
    } else {
      q = query(collection(db, "events"), where("organizerEmail", "==", user.email));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const evs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(evs);
    });

    return () => unsub();
  }, [user, isSuperAdmin]);

  // 2. Obtener inscripciones filtradas por Evento
  useEffect(() => {
    if (!user) return;

    let q;
    if (selectedEventId === "ALL") {
       if (isSuperAdmin) {
           q = collection(db, "registrations");
       } else {
           setRegistrations([]);
           return;
       }
    } else {
       q = query(collection(db, "registrations"), where("eventId", "==", selectedEventId));
    }

    const unsub = onSnapshot(q, (snapshot) => {
      const regs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRegistrations(regs);
    });

    return () => unsub();
  }, [selectedEventId, user, isSuperAdmin]);

  const formatTimestamp = (ts: any) => {
    if (!ts) return "Pendiente";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString('es-MX', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const approveRegistration = async (id: string) => {
    await updateDoc(doc(db, "registrations", id), { status: "APPROVED" });
    if(selectedUser?.id === id) {
      setSelectedUser((prev: any) => ({ ...prev, status: "APPROVED" }));
    }
  };

  const deleteRegistration = async (id: string, folio: string) => {
    if (window.confirm(`⚠️ ESTÁS A PUNTO DE ELIMINAR EL EXPEDIENTE [ ${folio} ]\n\nEsta acción es irreversible y borrará al atleta de la Base de Datos.\n¿Estás absolutamente seguro de continuar?`)) {
      try {
        await deleteDoc(doc(db, "registrations", id));
        if (selectedUser?.id === id) setSelectedUser(null);
      } catch (err) {
        console.error("Error al eliminar", err);
        alert("Ocurrió un error al intentar eliminar el registro.");
      }
    }
  };

  const downloadBatch = async () => {
    if (!batchStart || !batchEnd) {
      alert("⚠️ Operación fallida: Por favor selecciona Fecha de Inicio y Fecha Límite.");
      return;
    }
    
    setIsDownloadingBatch(true);
    try {
       const startTime = new Date(batchStart).getTime();
       const endTime = new Date(batchEnd).getTime();
       
       if (startTime >= endTime) {
         alert("⚠️ Rango inviable: La fecha límite (cierre) debe ocurrir después de la de inicio.");
         setIsDownloadingBatch(false);
         return;
       }

       const toDownload = filteredRegistrations.filter(r => {
          if (!r.posterFinalUrl) return false;
          let rTime;
          if (r.createdAt?.toMillis) rTime = r.createdAt.toMillis();
          else if (r.createdAt?.seconds) rTime = r.createdAt.seconds * 1000;
          else if (typeof r.createdAt === 'number') rTime = r.createdAt;
          else rTime = new Date(r.createdAt).getTime();
          return rTime >= startTime && rTime <= endTime;
       });
       
       if (toDownload.length === 0) {
          alert("0 pósters interactuados y guardados en esta horquilla de tiempo geolocalizada.");
          setIsDownloadingBatch(false);
          return;
       }
       
       const zip = new JSZip();
       let count = 0;
       
       await Promise.all(toDownload.map(async (reg) => {
          try {
             const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(reg.posterFinalUrl)}`);
             const blob = await res.blob();
             zip.file(`HD_${reg.folio}_${reg.firstName}.jpg`, blob);
             count++;
             setDownloadProgress(`Comprimiendo HD: ${count}/${toDownload.length}...`);
          } catch(e) {
             console.error("Error batch fetching HD node:", e);
          }
       }));
       
       setDownloadProgress(`Codificando ZIP Nivel Cero...`);
       const content = await zip.generateAsync({ type: "blob" });
       saveAs(content, `EXTRACCION_LOTE_HD_${Date.now()}.zip`);
    } catch(e) {
       console.error(e);
       alert("Error arquitectónico empaquetando el Lote Batch.");
    } finally {
       setIsDownloadingBatch(false);
       setBatchOpen(false);
       setDownloadProgress("");
    }
  };

  const exportToCSV = () => {
    if (filteredRegistrations.length === 0) {
      alert("No hay datos para exportar en este filtro.");
      return;
    }

    const headers = [
      "Folio", "Nombre", "Apellidos", "Email", "Telefono 1", "Telefono 2", 
      "Edad", "Sexo", "Tipo Sangre", "Estado", "Municipio", "Categoria", 
      "KIT ID", "Jersey", "Status", "Fecha Registro", "URL Poster", "URL Voucher"
    ];

    const csvRows = filteredRegistrations.map(r => [
      r.folio || "",
      r.firstName || "",
      r.lastName || "",
      r.email || "",
      r.phone1 || "",
      r.phone2 || "",
      r.age || "",
      r.gender || "",
      r.bloodType || "",
      r.state || "",
      r.muni || "",
      r.category || "",
      r.kitId || "N/A",
      r.jerseySize || "N/A",
      r.status || "",
      formatTimestamp(r.createdAt),
      r.posterFinalUrl || "",
      r.voucherUrl || ""
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(","));

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LISTADO_ATLETAS_${selectedEventId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRegistrations = registrations.filter(r => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const fullName = `${r.firstName} ${r.lastName}`.toLowerCase();
    const folioStr = (r.folio || "").toLowerCase();
    return fullName.includes(search) || folioStr.includes(search);
  });

  return (
    <div className="p-4 lg:p-8 flex flex-col h-full overflow-y-auto custom-scrollbar space-y-6">
      
      {/* Header Registros */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-bold tracking-[0.2em] text-gray-400 uppercase mb-1">Tabla de Atletas</h2>
          <h1 className="text-2xl font-light text-white tracking-tight">Registros e Inscripciones</h1>
          {!isSuperAdmin && (
            <p className="text-[10px] text-[#00d2ff] font-bold mt-2 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00d2ff] animate-pulse"></span> Modo Organizador: {user?.email}
            </p>
          )}
        </div>
        
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2.5 bg-[#171821] border border-[#ffffff0a] hover:bg-[#25283d] hover:border-[#00d2ff]/30 text-gray-400 hover:text-[#00d2ff] px-5 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all shadow-xl group"
          >
            <FileText className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Bajar Excel
          </button>

          <select 
            value={selectedEventId} 
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full sm:w-[260px] bg-[#242636] border border-[#ffffff1a] text-white rounded-xl text-xs px-4 py-3 focus:outline-none focus:border-[#4b55f5] font-semibold tracking-wide shadow-xl appearance-none cursor-pointer hover:bg-[#2a2d3d] transition-colors"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.8rem center' }}
          >
            {isSuperAdmin && <option value="ALL">Vista Global: TODOS</option>}
            {!isSuperAdmin && <option value="ALL" disabled>ELIGE UN EVENTO 👇</option>}
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-[#242636]/60 rounded-3xl border border-[#ffffff0a] shadow-[0_10px_40px_rgba(0,0,0,0.3)] backdrop-blur-md overflow-visible flex flex-col">
        
        {/* Search Bar */}
        <div className="p-6 border-b border-[#ffffff0a] flex flex-col md:flex-row items-center justify-between bg-[#1c1d29]/50 gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-3 h-[18px] w-[18px] text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar corredor o #folio..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 text-sm bg-[#171821] border border-[#ffffff10] text-gray-200 rounded-xl focus:outline-none focus:border-[#4b55f5] focus:ring-1 focus:ring-[#4b55f5] transition-all placeholder:text-gray-600" 
            />
          </div>
          
          <div className="relative w-full md:w-auto">
            <button 
              onClick={() => setBatchOpen(!batchOpen)}
              disabled={isDownloadingBatch}
              className="w-full md:w-auto bg-[#4b55f5]/10 hover:bg-[#4b55f5]/20 text-[#4b55f5] border border-[#4b55f5]/30 px-6 py-2.5 rounded-xl text-[11px] uppercase font-black tracking-widest transition-all flex items-center justify-center gap-2"
            >
              {isDownloadingBatch ? (
                <>{downloadProgress || "Empaquetando..."}</>
              ) : (
                <><FolderArchive className="w-4 h-4" /> Bajar Posters Batch <ChevronDown className="w-3 h-3 ml-1" /></>
              )}
            </button>
            
            {batchOpen && !isDownloadingBatch && (
              <div className="absolute right-0 top-12 w-full md:w-[320px] bg-[#1b1c27] border border-[#ffffff1a] shadow-2xl rounded-xl overflow-hidden z-30 p-6">
                 <div className="mb-5">
                   <h3 className="text-[12px] uppercase tracking-[0.2em] font-bold text-gray-300 mb-1 flex items-center gap-2">
                     <FolderArchive className="w-5 h-5 text-[#ff5f6d]" /> Custom Extractor Grid
                   </h3>
                   <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Horquilla Analítica de Exportación</p>
                 </div>
                 
                 <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Fecha Limitante (Arranque)</span>
                      <input 
                        type="datetime-local" 
                        value={batchStart} 
                        onChange={(e) => setBatchStart(e.target.value)}
                        className="w-full bg-[#171821] border border-[#ffffff10] rounded-lg px-3 py-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#00d2ff] transition-colors" 
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest block mb-1">Fecha de Clausura (Fin)</span>
                      <input 
                        type="datetime-local" 
                        value={batchEnd} 
                        onChange={(e) => setBatchEnd(e.target.value)}
                        className="w-full bg-[#171821] border border-[#ffffff10] rounded-lg px-3 py-3 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#4b55f5] transition-colors" 
                      />
                    </div>
                    
                    <button onClick={() => downloadBatch()} className="w-full text-center px-4 py-3 mt-4 text-[11px] uppercase tracking-[0.2em] font-bold bg-[#4b55f5] hover:bg-[#3f47cc] text-white rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-px border border-transparent hover:border-[#ffffff20]">
                      Extraer Lote HD Autorizado
                    </button>
                    
                    <button onClick={() => {
                        const now = new Date();
                        // Ajuste Localhost Timezone format YYYY-MM-DDThh:mm
                        const tzOffset = now.getTimezoneOffset() * 60000; //offset in milliseconds
                        setBatchEnd(new Date(now.getTime() - tzOffset).toISOString().slice(0, 16));
                        setBatchStart(new Date(now.getTime() - tzOffset - 24 * 60 * 60 * 1000).toISOString().slice(0,16));
                    }} className="w-full text-center mt-3 text-[9px] uppercase tracking-[0.2em] font-bold text-gray-500 hover:text-white transition-colors">
                      Pre-Llenar Formulario Automáticamente (Últimas 24 Hrs)
                    </button>
                 </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-[#171821] text-gray-500 font-bold text-[9px] uppercase tracking-widest border-b border-[#ffffff0a]">
              <tr>
                <th className="px-4 py-4">Id Folio</th>
                <th className="px-4 py-4">Participante</th>
                {isSuperAdmin && selectedEventId === "ALL" && <th className="px-4 py-4">Campaña</th>}
                <th className="px-4 py-4">Registro Inicial</th>
                <th className="px-4 py-4">Paquete / Inversión</th>
                <th className="px-4 py-4">Rama / Categoría</th>
                <th className="px-4 py-4">Estado Pago</th>
                <th className="px-4 py-4 text-right">Acción Rapida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ffffff0a]">
              {filteredRegistrations.map((reg) => (
                <tr key={reg.id} className="hover:bg-[#4b55f5]/5 transition-colors group">
                  <td className="px-4 py-4 font-mono text-[12px] font-bold text-[#00d2ff]">{reg.folio}</td>
                  <td className="px-4 py-4">
                     <span className="font-bold text-gray-200 group-hover:text-white transition-colors text-[13px]">{reg.firstName} {reg.lastName}</span>
                     <span className="block text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{reg.state}</span>
                  </td>
                  {isSuperAdmin && selectedEventId === "ALL" && (
                    <td className="px-4 py-4 text-gray-400 font-medium text-[11px] truncate max-w-[150px]">{events.find(e => e.id === reg.eventId)?.name || "N/A"}</td>
                  )}
                  <td className="px-4 py-4">
                    <span className="text-gray-300 text-[10px] uppercase tracking-widest font-bold bg-[#171821] px-2.5 py-1.5 rounded-lg border border-[#ffffff05] shadow-inner flex inline-flex w-max">
                       {formatTimestamp(reg.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-4 flex flex-col items-start justify-center gap-1 min-w-[180px]">
                     {reg.kitName ? (
                       <>
                         <span className="bg-[#4b55f5]/10 text-[#00d2ff] font-bold text-[9px] px-2 py-0.5 rounded-md border border-[#4b55f5]/30 shadow-inner uppercase tracking-widest leading-none">
                           {reg.kitName} ~ ${reg.kitPricePaid}
                         </span>
                         {reg.jerseyType && reg.jerseyType !== "N/A" && (
                           <span className="text-[9px] text-[#ff5f6d] font-mono tracking-widest">
                             🎽 {reg.jerseyType} [{reg.jerseySize}]
                           </span>
                         )}
                       </>
                     ) : (
                       <span className="text-[#ffffff40] text-[9px] font-mono uppercase tracking-widest">Sin Selección</span>
                     )}
                  </td>
                  <td className="px-4 py-4 text-gray-400 font-medium text-[12px]">
                     {reg.gender === "MALE" ? "Varonil" : "Femenil"} <span className="opacity-50">({reg.age})</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-full border ${
                      reg.status === 'APPROVED' 
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                      : 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                    }`}>
                      {reg.status === 'APPROVED' ? 'Aprobado' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-4 py-4 flex items-center justify-end gap-2">
                    <button onClick={() => setSelectedUser(reg)} className="text-gray-500 hover:text-[#00d2ff] bg-[#1c1d29] hover:bg-[#25283d] w-8 h-8 flex items-center justify-center rounded-lg border border-[#ffffff0a] transition-all" title="Ver Expediente">
                      <Eye className="w-4 h-4" />
                    </button>
                    {reg.status === 'PENDING' && (
                      <button onClick={() => approveRegistration(reg.id)} className="text-gray-300 hover:text-white bg-gradient-to-r from-[#4b55f5] to-[#884af0] px-3 py-1.5 rounded-lg text-[10px] font-bold transition-transform hover:scale-105 shadow-[0_0_10px_rgba(75,85,245,0.4)] flex items-center gap-1.5">
                        Aprobar <CheckCircle className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={() => deleteRegistration(reg.id, reg.folio)} className="text-gray-500 hover:text-white bg-[#1c1d29] hover:bg-red-500/80 w-8 h-8 flex items-center justify-center rounded-lg border border-[#ffffff0a] transition-all" title="Eliminar Registro">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRegistrations.length === 0 && (
            <div className="p-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-[#1c1d29] border border-[#ffffff0a] flex items-center justify-center mb-4">
                 <Search className="w-6 h-6 text-gray-600" />
              </div>
              <p className="text-gray-400 font-medium text-sm">
                {!isSuperAdmin && selectedEventId === "ALL" 
                 ? "Elige uno de tus eventos de la lista para ver los competidores." 
                 : "El radar está en blanco. No se hallaron participantes."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal / Panel Flotante de Expediente */}
      {selectedUser && (() => {
        const liveUser = registrations.find(r => r.id === selectedUser.id) || selectedUser;
        const currentEvent = events.find(e => e.id === liveUser.eventId);
        
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#00000080] backdrop-blur-md p-4 sm:p-6 transition-opacity">
          <div className="bg-[#1b1c27] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-[#ffffff10] max-w-3xl w-full flex flex-col max-h-[92vh] overflow-hidden transform transition-all animate-in zoom-in duration-300">
            
            {/* Modal Header */}
            <div className="p-6 sm:px-8 sm:py-7 border-b border-[#ffffff0a] flex justify-between items-center bg-[#171821] shrink-0">
              <div className="flex items-center gap-4">
                 <div className="w-2 h-8 bg-gradient-to-b from-[#00d2ff] to-[#4b55f5] rounded-full"></div>
                 <div>
                    <h3 className="font-light text-2xl text-white tracking-tight">Expediente</h3>
                    <span className="text-gray-500 font-mono text-sm tracking-widest">{liveUser.folio}</span>
                 </div>
              </div>
              <button 
                onClick={() => { setSelectedUser(null); setIsRegeneratingPoster(false); }} 
                className="text-gray-500 hover:text-white transition-colors rounded-xl p-2.5 bg-[#242636] hover:bg-gray-800 border border-[#ffffff0a]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-[#242636]/40 p-6 rounded-2xl border border-[#ffffff05]">
                  {/* Botón de Visualización de Foto de Bienvenida */}
                  {liveUser.posterFinalUrl ? (
                     <a 
                       href={liveUser.posterFinalUrl} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-gradient-to-tr from-[#4b55f5]/20 to-[#884af0]/20 border border-[#4b55f5]/40 text-[#00d2ff] hover:bg-[#4b55f5]/30 transition-all group mb-6"
                     >
                       <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                       <div className="text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Diseño Finalizado</p>
                          <p className="text-xs font-bold">Ver y Descargar Póster HD</p>
                       </div>
                     </a>
                  ) : (
                    <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-[#171821] border border-white/5 text-gray-500 opacity-60 mb-6">
                      <ImageIcon className="w-5 h-5" />
                      <div className="text-left">
                         <p className="text-[10px] font-black uppercase tracking-widest">Estado: Pendiente</p>
                         <p className="text-xs font-bold italic">Usuario no ha finalizado su póster</p>
                      </div>
                    </div>
                  )}
                  <p className="text-[#00d2ff] text-[10px] font-bold uppercase tracking-[0.2em] mb-2 mt-2">Datos del Titular</p>
                  <p className="font-light text-white text-3xl mb-2">{liveUser.firstName} {liveUser.lastName}</p>
                  <p className="text-gray-400 text-sm font-medium">{liveUser.state} • {liveUser.muni}</p>
                </div>
                
                <div className="bg-[#242636]/40 p-6 rounded-2xl border border-[#ffffff05]">
                  <p className="text-[#884af0] text-[10px] font-bold uppercase tracking-[0.2em] mb-2">Acuerdo Operativo</p>
                  <p className="font-bold text-white text-xl mb-2">{currentEvent?.name || "Evento Base"}</p>
                  <p className="text-gray-400 text-sm font-medium">Edad Operativa: {liveUser.age} | Rama: {liveUser.gender === 'MALE' ? 'Varonil' : 'Femenil'}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#171821] p-5 rounded-2xl border border-[#ffffff0a] flex flex-col justify-center">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Riesgo / Sangre</p>
                  <p className="font-light text-[#ff5f6d] text-4xl">{liveUser.bloodType || 'N/A'}</p>
                </div>
                <div className="bg-[#171821] p-5 rounded-2xl border border-[#ffffff0a] flex flex-col justify-center">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Com. Directa</p>
                  <p className="font-mono text-white text-lg tracking-wider">{liveUser.phone1}</p>
                </div>
                <div className="bg-[#171821] p-5 rounded-2xl border border-[#ffffff0a] flex flex-col justify-center">
                  <p className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-2">Com. Alterna</p>
                  <p className="font-mono text-white text-lg tracking-wider">{liveUser.phone2}</p>
                </div>
              </div>
              
              {/* === INYECCIÓN KITS Y TEXTILES === */}
              {liveUser.kitName && (
                 <div className="bg-[#242636]/60 border border-[#00d2ff]/20 rounded-2xl p-6 relative overflow-hidden flex flex-col sm:flex-row gap-6 justify-between items-center group">
                   <div className="absolute top-0 left-0 w-2 h-full bg-[#00d2ff]"></div>
                   <div className="absolute top-0 right-0 w-32 h-32 bg-[#00d2ff]/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none group-hover:bg-[#00d2ff]/10 transition-colors"></div>
                   
                   <div className="pl-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#00d2ff] mb-1">Kit de Competencia Designado</p>
                      <p className="font-bold text-white text-xl uppercase tracking-widest">{liveUser.kitName}</p>
                      <p className="font-mono text-gray-400 mt-2 text-sm bg-black/30 w-max px-3 py-1 rounded inline-flex border border-[#ffffff10]">Inversión Autorizada: <span className="text-[#00d2ff] ml-2 underline decoration-[#00d2ff]/50 decoration-dashed underline-offset-4">${liveUser.kitPricePaid} MXN</span></p>
                   </div>
                   
                   {(liveUser.jerseyType && liveUser.jerseyType !== "N/A") && (
                     <div className="bg-[#171821] border border-[#ff5f6d]/30 px-6 py-4 rounded-xl flex items-center gap-4 text-left shadow-inner shrink-0 w-full sm:w-auto">
                        <span className="text-3xl filter drop-shadow-[0_0_10px_rgba(255,95,109,0.5)]">🎽</span>
                        <div>
                          <p className="text-[9px] uppercase tracking-widest font-bold text-[#ff5f6d] mb-1">Registro Textil (Prenda Física)</p>
                          <p className="text-gray-200 font-bold uppercase text-[11px] tracking-widest">Diseño: <span className="text-white">{liveUser.jerseyType}</span></p>
                          <p className="text-gray-200 font-bold uppercase text-[11px] tracking-widest mt-0.5">Medida: <span className="bg-[#ff5f6d] text-black px-1.5 py-0.5 rounded text-[10px] ml-1">{liveUser.jerseySize}</span></p>
                        </div>
                     </div>
                   )}
                 </div>
              )}

              <div>
                <h4 className="font-bold text-[12px] uppercase tracking-[0.2em] text-gray-500 mb-5 pl-2 border-l-2 border-gray-700">Archivos Auditables de Validación</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {liveUser.paymentUrl && (
                    <a href={liveUser.paymentUrl} target="_blank" rel="noreferrer" className="flex items-center gap-5 p-5 rounded-2xl bg-[#242636] hover:bg-[#2c2f42] border border-[#ffffff0a] hover:border-[#4b55f5]/30 transition-all group">
                      <div className="bg-[#4b55f5]/10 p-3.5 rounded-xl group-hover:bg-[#4b55f5]/20 group-hover:scale-110 transition-transform">
                         <FileText className="w-6 h-6 text-[#4b55f5]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">Comprobante de Pago</p>
                        <p className="text-[11px] text-blue-400 font-bold tracking-widest uppercase mt-1">Cliquear Carga</p>
                      </div>
                    </a>
                  )}
                  
                  {liveUser.idUrl && (
                    <a href={liveUser.idUrl} target="_blank" rel="noreferrer" className="flex items-center gap-5 p-5 rounded-2xl bg-[#242636] hover:bg-[#2c2f42] border border-[#ffffff0a] hover:border-[#884af0]/30 transition-all group">
                      <div className="bg-[#884af0]/10 p-3.5 rounded-xl group-hover:bg-[#884af0]/20 group-hover:scale-110 transition-transform">
                         <ImageIcon className="w-6 h-6 text-[#884af0]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">Identificación Oficial</p>
                        <p className="text-[11px] text-[#884af0] font-bold tracking-widest uppercase mt-1">Inspección Ocular</p>
                      </div>
                    </a>
                  )}

                  {liveUser.photoUrl && (
                  <a href={liveUser.photoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-5 p-5 rounded-2xl bg-[#242636] hover:bg-[#2c2f42] border border-[#ffffff0a] hover:border-[#ff5f6d]/30 transition-all group">
                    <div className="bg-[#ff5f6d]/10 p-3.5 rounded-xl group-hover:bg-[#ff5f6d]/20 group-hover:scale-110 transition-transform">
                       <ImageIcon className="w-6 h-6 text-[#ff5f6d]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">Fotografía Base</p>
                      <p className="text-[11px] text-[#ff5f6d] font-bold tracking-widest uppercase mt-1">Descarga RAW</p>
                    </div>
                  </a>
                  )}

                  {liveUser.logoUrl && (
                  <a href={liveUser.logoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-5 p-5 rounded-2xl bg-[#242636] hover:bg-[#2c2f42] border border-[#ffffff0a] hover:border-yellow-500/30 transition-all group">
                    <div className="bg-yellow-500/10 p-3.5 rounded-xl group-hover:bg-yellow-500/20 group-hover:scale-110 transition-transform">
                       <ImageIcon className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">Logotipo del Equipo</p>
                      <p className="text-[11px] text-yellow-500 font-bold tracking-widest uppercase mt-1">Extracción Original</p>
                    </div>
                  </a>
                  )}
                </div>

                {isRegeneratingPoster ? (
                   <div className="md:col-span-2 border border-[#00d2ff]/30 rounded-2xl p-6 bg-[#00d2ff]/5 flex flex-col items-center mt-8">
                     <div className="w-full flex justify-between items-center mb-6">
                         <h3 className="text-[#00d2ff] text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                            <ImageIcon className="w-5 h-5" /> Consola de Ensamblaje Directo
                         </h3>
                         <button 
                            onClick={() => { setIsRegeneratingPoster(false); setIgnoreUserLogo(false); }} 
                            className="text-gray-400 hover:text-white bg-[#1c1d29] px-4 py-2 rounded-lg text-xs font-bold border border-[#ffffff0a]"
                         >
                           Cerrar Consola
                         </button>
                     </div>
                     
                     <label className="flex items-center justify-center gap-3 bg-[#1c1d29] px-5 py-3 rounded-xl border border-[#ffffff0a] cursor-pointer mb-8 w-full max-w-sm shadow-inner transition-colors hover:border-[#ff5f6d]/50">
                       <input type="checkbox" checked={ignoreUserLogo} onChange={(e) => setIgnoreUserLogo(e.target.checked)} className="accent-[#ff5f6d] w-4 h-4 cursor-pointer" />
                       <span className="text-gray-300 text-[11px] uppercase font-bold tracking-widest">Ignorar Logo del Usuario</span>
                     </label>

                     <div className="w-full max-w-sm">
                       <WelcomePoster 
                          folio={liveUser.folio}
                          name={`${liveUser.firstName} ${liveUser.lastName}`}
                          eventName={currentEvent?.name || "EVENTO"}
                          category={liveUser.gender === 'MALE' ? 'Varonil' : 'Femenil'} 
                          photoUrl={liveUser.photoUrl}
                          logoUrl={ignoreUserLogo ? undefined : liveUser.logoUrl}
                          posterTemplateUrl={currentEvent?.posterTemplateUrl}
                          originState={liveUser.state}
                          posterFontFamily={currentEvent?.posterFontFamily}
                          posterColorFolio={currentEvent?.posterColorFolio}
                          posterColorName={currentEvent?.posterColorName}
                          posterColorState={currentEvent?.posterColorState}
                          posterColorWelcome={currentEvent?.posterColorWelcome}
                          showFolioOnPoster={currentEvent?.showFolioOnPoster !== false}
                          gender={liveUser.gender}
                          registrationId={liveUser.id}
                          eventId={liveUser.eventId}
                          isPreview={true}
                       />
                     </div>
                   </div>
                ) : (
                  <div className="border border-[#ffffff0a] rounded-2xl p-6 bg-[#171821] flex flex-col md:flex-row gap-6 mt-8">
                    <div className="flex-1 flex justify-center border border-[#ffffff0a] bg-black rounded-xl overflow-hidden shadow-inner aspect-[4/5] relative group">
                       {liveUser.posterFinalUrl ? (
                         <>
                           <img src={liveUser.posterFinalUrl} alt="Poster HD" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                           <a href={liveUser.posterFinalUrl} target="_blank" rel="noreferrer" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity backdrop-blur-sm">
                             <span className="bg-[#00d2ff] text-black font-bold uppercase tracking-widest text-[10px] px-4 py-2 rounded-full shadow-[0_0_20px_rgba(0,210,255,0.4)]">Descargar Original</span>
                           </a>
                         </>
                       ) : (
                         <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 w-full h-full">
                           <div className="w-12 h-12 rounded-full border border-yellow-500/30 bg-yellow-500/10 flex items-center justify-center mb-2">
                             <ImageIcon className="w-5 h-5 text-yellow-500" />
                           </div>
                           <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-gray-500">Sin Interacción</span>
                           <span className="text-[9px] font-bold tracking-widest uppercase text-yellow-500/70 leading-relaxed">El usuario no ha<br/>guardado su póster HD</span>
                         </div>
                       )}
                    </div>
                    <div className="flex-[2] flex flex-col justify-center">
                       <p className="text-[#00d2ff] uppercase text-[10px] font-bold tracking-[0.2em] mb-2">Generación Autómata</p>
                       <p className="font-light text-2xl text-white mb-4">Póster HD Finalizado</p>
                       <p className="text-gray-400 text-sm font-medium leading-relaxed max-w-sm">Esta es la visualización exacta que el atleta ha procesado. Útil para gafetes y redes sociales.</p>
                       
                       <div className="mt-8 flex flex-col gap-3">
                         <button onClick={() => setIsRegeneratingPoster(true)} className="w-full bg-[#1c1d29] hover:bg-[#25283d] text-[#00d2ff] py-3 rounded-xl border border-[#ffffff0a] font-bold uppercase tracking-widest text-[11px] hover:border-[#00d2ff]/30 transition-all flex justify-center items-center gap-2">
                           Ensamblar Documento HD Manualmente
                         </button>
                         <div className="flex items-center justify-between text-[11px] font-bold tracking-widest uppercase bg-[#242636]/50 px-4 py-3 rounded-xl border border-[#ffffff05]">
                           <span className="text-gray-500">Carta Responsiva</span>
                           <span className="text-green-400 flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5" /> Aceptación Sellada</span>
                         </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 sm:px-8 sm:py-5 border-t border-[#ffffff0a] bg-[#171821] flex justify-end gap-4 shrink-0">
              <button 
                onClick={() => { setSelectedUser(null); setIsRegeneratingPoster(false); }} 
                className="px-7 py-3 text-[11px] uppercase tracking-widest font-bold text-gray-400 bg-[#242636] hover:bg-[#2c2f42] hover:text-white rounded-xl transition-colors"
              >
                Cerrar
              </button>
              {liveUser.status === 'PENDING' && (
                <button 
                  onClick={() => approveRegistration(liveUser.id)} 
                  className="px-7 py-3 text-[11px] uppercase tracking-widest font-bold text-white bg-gradient-to-r from-[#4b55f5] to-[#884af0] rounded-xl hover:opacity-90 flex items-center gap-2 shadow-[0_0_20px_rgba(75,85,245,0.4)] transition-transform hover:-translate-y-px"
                >
                  <CheckCircle className="w-[14px] h-[14px]" /> Aprobar Registro
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
