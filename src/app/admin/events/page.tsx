"use client";

import EventForm from "@/components/admin/EventForm";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { Trash2, EyeOff, Eye, Settings, Edit2 } from "lucide-react";

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
      const eVs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setEvents(eVs);
    });
    return () => unsubscribe();
  }, []);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ABIERTO" ? "OCULTO" : "ABIERTO";
    await updateDoc(doc(db, "events", id), { status: newStatus });
  };

  const deleteEvent = async (id: string, name: string) => {
    if (confirm(`¿Estás 100% seguro de eliminar permanentemente la "${name}"? Todo se borrará de tu base de datos.`)) {
      await deleteDoc(doc(db, "events", id));
    }
  };

  return (
    <div className="flex-1 p-10 lg:pl-12 flex flex-col h-full overflow-y-auto custom-scrollbar space-y-8 bg-[#1b1c27] text-white">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-[12px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-2">Editor de Matriz</h2>
          <h1 className="text-3xl font-light tracking-tight text-white flex items-center gap-3">
            Gestor de <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00d2ff] to-[#4b55f5]">Eventos</span>
          </h1>
        </div>
      </div>

      <div className="shrink-0 bg-[#242636]/60 backdrop-blur-md rounded-3xl border border-[#ffffff0a] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
        <h3 className="text-[11px] font-bold tracking-[0.2em] text-[#00d2ff] uppercase mb-8 flex items-center gap-3">
          {editingEvent ? <><Edit2 className="w-4 h-4" /> Editando: {editingEvent.name}</> : <><Settings className="w-4 h-4" /> Configurar Nuevo Evento Base</>}
        </h3>
        <EventForm 
           initialData={editingEvent} 
           onCancelEdit={() => {
             setEditingEvent(null);
             window.scrollTo({ top: 0, behavior: 'smooth' });
           }} 
        />
      </div>
      
      <div className="shrink-0 mt-8 pb-12">
        <h3 className="text-[12px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-6 border-b border-[#ffffff0a] pb-4">
          Mis Eventos Activos (Base de Datos)
        </h3>
        {events.length === 0 ? (
          <div className="text-[11px] font-bold tracking-widest uppercase text-gray-500 bg-[#171821] p-12 rounded-2xl border border-[#ffffff0a] text-center shadow-inner">
            No hay operaciones creadas en el servidor. Empieza configurando una arriba.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map(ev => (
              <div key={ev.id} className={`p-8 rounded-3xl border flex flex-col justify-between shadow-xl transition-all relative overflow-hidden group ${ev.status === 'OCULTO' ? 'bg-[#1a1b26] border-[#ffffff05] opacity-60' : 'bg-[#242636] border-[#ffffff0a] hover:border-[#4b55f5]/30'}`}>
                {ev.status === 'ABIERTO' && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#00d2ff]/10 to-[#4b55f5]/10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:from-[#00d2ff]/20 transition-colors"></div>
                )}
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <span className={`px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest border ${ev.status === 'ABIERTO' ? 'bg-gradient-to-r from-[#4b55f5]/20 to-[#884af0]/20 text-[#00d2ff] border-[#00d2ff]/30 shadow-[0_0_10px_rgba(0,210,255,0.2)]' : 'bg-[#171821] text-gray-500 border-gray-700'}`}>
                      {ev.status}
                    </span>
                    <span className="text-[10px] text-gray-600 font-mono tracking-widest font-bold bg-[#171821] px-2 py-1 rounded-md">ID:{ev.id.substring(0,5)}</span>
                  </div>
                  <h4 className="font-light text-white text-2xl tracking-tight mb-2 group-hover:text-[#00d2ff] transition-colors">{ev.name}</h4>
                  <p className="text-[13px] text-gray-400 mt-2 font-medium line-clamp-2 leading-relaxed">{ev.description || "Sin descripción proporcionada."}</p>
                </div>
                <div className="mt-8 pt-6 border-t border-[#ffffff0a] flex gap-3 relative z-10 flex-wrap">
                  <button onClick={() => toggleStatus(ev.id, ev.status)} className="flex-1 flex items-center justify-center gap-2 bg-[#171821] hover:bg-[#1c1d29] text-gray-300 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors shadow-inner border border-[#ffffff05] hover:border-[#ffffff10]">
                    {ev.status === "ABIERTO" ? <><EyeOff className="w-3.5 h-3.5"/> Ocultar</> : <><Eye className="w-3.5 h-3.5"/> Publicar</>}
                  </button>
                  <button 
                    onClick={() => {
                      setEditingEvent(ev);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }} 
                    className="flex items-center justify-center gap-2 bg-[#00d2ff]/10 hover:bg-[#00d2ff] text-[#00d2ff] hover:text-[#171821] px-5 py-3 rounded-xl transition-all border border-[#00d2ff]/20 shadow-sm text-[10px] font-bold uppercase tracking-widest"
                  >
                    <Edit2 className="w-4 h-4" /> Editar
                  </button>
                  <button onClick={() => deleteEvent(ev.id, ev.name)} className="flex items-center justify-center bg-[#ff5f6d]/10 hover:bg-[#ff5f6d] text-[#ff5f6d] hover:text-white px-5 py-3 rounded-xl transition-all border border-[#ff5f6d]/20 group/del shadow-sm">
                    <Trash2 className="w-4 h-4 group-hover/del:scale-110 transition-transform" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
