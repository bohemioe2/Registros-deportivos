"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, doc, setDoc, deleteDoc } from "firebase/firestore";
import { Trash2, KeyRound, Plus, UserPlus } from "lucide-react";
import { useAuth } from "@/components/admin/AuthProvider";

export default function StaffPage() {
  const { role, assignedEventId } = useAuth();
  
  const [staff, setStaff] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  
  const [newEmail, setNewEmail] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!role) return;

    // Escuchar eventos para el selector
    const unsubEvents = onSnapshot(collection(db, "events"), (snapshot) => {
      let evs = snapshot.docs.map(d => ({ id: d.id, name: d.data().name }));
      if (role === "ORGANIZER" && assignedEventId) {
        evs = evs.filter(e => e.id === assignedEventId);
      }
      setEvents(evs);

      if (role === "ORGANIZER" && assignedEventId) {
        setSelectedEventId(assignedEventId);
      }
    });

    // Escuchar staff
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      let stf = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(u => u.role === "STAFF");
      if (role === "ORGANIZER" && assignedEventId) {
        stf = stf.filter(u => u.assignedEventId === assignedEventId);
      }
      setStaff(stf);
    });

    return () => {
      unsubUsers();
      unsubEvents();
    };
  }, [role, assignedEventId]);

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !selectedEventId) return;
    
    setLoading(true);
    try {
      // El ID del documento será el email para cruzarlo cuando se registren
      await setDoc(doc(db, "users", newEmail.trim().toLowerCase()), {
        email: newEmail.trim().toLowerCase(),
        role: "STAFF",
        assignedEventId: selectedEventId,
        createdAt: new Date().toISOString()
      });
      setNewEmail("");
      if (role === "SUPERADMIN") setSelectedEventId("");
    } catch (error) {
      console.error(error);
      alert("Error al agregar staff.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (emailId: string) => {
    if (confirm(`¿Estás seguro de revocarle el acceso a ${emailId}? Ya no podrá usar el escáner.`)) {
      await deleteDoc(doc(db, "users", emailId));
    }
  };

  return (
    <div className="flex-1 p-10 lg:pl-12 flex flex-col h-full overflow-y-auto custom-scrollbar space-y-8 bg-[#1b1c27] text-white">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-[12px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-2">Accesos de Mesa</h2>
          <h1 className="text-3xl font-light tracking-tight text-white flex items-center gap-3">
            Gestor de <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#ff5f6d] to-[#ffc371]">Staff</span>
          </h1>
        </div>
      </div>

      {/* Formulario para agregar staff */}
      <div className="shrink-0 bg-[#242636]/60 backdrop-blur-md rounded-3xl border border-[#ffffff0a] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.3)]">
        <h3 className="text-[11px] font-bold tracking-[0.2em] text-[#ff5f6d] uppercase mb-6 flex items-center gap-3">
          <UserPlus className="w-4 h-4" /> Autorizar Nuevo Staff
        </h3>
        <form onSubmit={handleAddStaff} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input 
              type="email" 
              required 
              placeholder="Correo electrónico del personal" 
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-[#171821] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-[#ff5f6d] focus:border-[#ff5f6d] outline-none transition-all"
            />
          </div>
          <div className="flex-1">
            <select 
              required
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              disabled={role === "ORGANIZER"}
              className="w-full bg-[#171821] border border-[#ffffff10] rounded-xl px-4 py-3 text-sm focus:ring-1 focus:ring-[#ff5f6d] focus:border-[#ff5f6d] outline-none transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Asignar a un Evento --</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="bg-[#ff5f6d] hover:bg-[#ff4b5a] text-white font-bold px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50 shrink-0"
          >
            <Plus className="w-4 h-4" /> Autorizar
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-4">
          Nota: Ingresa el correo de tu personal. Después, diles que entren a <strong className="text-gray-400">hazdeporte.com/signup</strong> y creen su cuenta con ese mismo correo. Solo podrán usar el Escáner.
        </p>
      </div>

      {/* Lista de Staff */}
      <div className="shrink-0 mt-8 pb-12">
        <h3 className="text-[12px] font-bold tracking-[0.25em] text-gray-500 uppercase mb-6 border-b border-[#ffffff0a] pb-4">
          Personal Autorizado ({staff.length})
        </h3>
        
        {staff.length === 0 ? (
          <div className="text-[11px] font-bold tracking-widest uppercase text-gray-500 bg-[#171821] p-12 rounded-2xl border border-[#ffffff0a] text-center shadow-inner">
            No tienes personal registrado aún.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {staff.map(stf => {
              const assignedEventName = events.find(e => e.id === stf.assignedEventId)?.name || "Evento Eliminado / Desconocido";
              return (
                <div key={stf.id} className="bg-[#242636] border border-[#ffffff0a] p-6 rounded-2xl shadow-lg relative group flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff5f6d]/20 to-[#ffc371]/20 flex items-center justify-center border border-[#ff5f6d]/30">
                        <KeyRound className="w-4 h-4 text-[#ff5f6d]" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate" title={stf.email}>{stf.email}</p>
                        <p className="text-[10px] text-[#ffc371] font-bold uppercase tracking-widest mt-0.5">Rol: STAFF</p>
                      </div>
                    </div>
                    <div className="bg-[#171821] rounded-xl p-3 border border-[#ffffff05] mt-4">
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Evento Asignado</p>
                      <p className="text-xs text-gray-300 font-medium truncate">{assignedEventName}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(stf.id)}
                    className="absolute top-4 right-4 p-2 bg-[#ff5f6d]/10 hover:bg-[#ff5f6d] text-[#ff5f6d] hover:text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="Revocar acceso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
