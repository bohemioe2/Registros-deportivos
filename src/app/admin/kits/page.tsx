"use client";

import { useEffect, useState, useMemo } from "react";
import { db } from "@/lib/firebase/config";
import { collection, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { useAuth } from "@/components/admin/AuthProvider";
import { Shirt, Download, Filter, Users, Loader2 } from "lucide-react";

export default function KitsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.email === "eder.beltran.acosta@gmail.com";

  const [events, setEvents] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Cargar eventos
  useEffect(() => {
    if (!user) return;
    const q = isSuperAdmin
      ? collection(db, "events")
      : query(collection(db, "events"), where("organizerEmail", "==", user.email));
    const unsub = onSnapshot(q, (snap) => {
      const evts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEvents(evts);
      if (evts.length > 0 && !selectedEventId) setSelectedEventId(evts[0].id);
    });
    return () => unsub();
  }, [user, isSuperAdmin]);

  // Cargar registros del evento seleccionado
  useEffect(() => {
    if (!selectedEventId) return;
    setLoading(true);
    const q = query(
      collection(db, "registrations"),
      where("eventId", "==", selectedEventId),
      orderBy("folioNumber", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setRegistrations(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [selectedEventId]);

  // Solo registros con jersey
  const jerseyRows = useMemo(
    () => registrations.filter((r) => r.jerseySize && r.jerseySize !== "N/A"),
    [registrations]
  );

  // Conteo de tallas
  const sizeSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    jerseyRows.forEach((r) => {
      const s = r.jerseySize || "?";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [jerseyRows]);

  // Exportar CSV
  const exportCSV = () => {
    if (jerseyRows.length === 0) return;
    const headers = ["Folio", "Nombre", "Apellidos", "Email", "Kit", "Tipo Jersey", "Talla", "Estado"];
    const rows = jerseyRows.map((r) => [
      r.folio || "",
      r.firstName || "",
      r.lastName || "",
      r.email || "",
      r.kitName || "",
      r.jerseyType || "",
      r.jerseySize || "",
      r.status || "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((v: string) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const eventName = events.find((e) => e.id === selectedEventId)?.name || "evento";
    a.href = url;
    a.download = `Pedido-Jerseys-${eventName.replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <div className="flex-1 p-8 lg:p-12 flex flex-col overflow-y-auto bg-[#0d0e14] text-white min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-8 mb-12">
        <div className="space-y-3">
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 w-fit px-4 py-1.5 rounded-full">
            <Shirt className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] font-black tracking-[0.3em] text-gray-400 uppercase">Concentrado Textil</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase leading-none italic">
            Kits /{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-[#00d2ff]">
              Textiles
            </span>
          </h1>
          <p className="text-gray-500 text-xs uppercase tracking-widest font-bold">
            Pedido de prendas para el proveedor — solo participantes con jersey
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
          {/* Selector de evento */}
          <div className="relative w-full sm:w-[360px] group">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-green-400">
              <Filter className="w-4 h-4" />
            </div>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="w-full bg-[#1b1c27]/60 backdrop-blur-xl border border-white/5 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] pl-12 pr-10 py-5 focus:outline-none focus:border-green-400/50 transition-all cursor-pointer appearance-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%234ade80' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 1.5rem center",
              }}
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botón exportar CSV */}
          <button
            onClick={exportCSV}
            disabled={jerseyRows.length === 0}
            className="w-full sm:w-auto bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-black font-black text-[10px] px-8 py-5 rounded-2xl transition-all uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(74,222,128,0.3)] hover:-translate-y-0.5"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Resumen de tallas */}
      {!loading && jerseyRows.length > 0 && (
        <div className="mb-10 bg-[#171821]/60 border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
          <h3 className="text-[10px] font-black tracking-[0.35em] text-gray-500 uppercase mb-6 flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping inline-block"></span>
            Resumen de Tallas — {jerseyRows.length} prendas totales
          </h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(sizeSummary)
              .sort((a, b) => b[1] - a[1])
              .map(([size, count]) => (
                <div
                  key={size}
                  className="bg-[#0d0e14] border border-green-500/20 rounded-2xl px-6 py-4 text-center min-w-[90px] hover:border-green-400/60 transition-colors group"
                >
                  <p className="text-2xl font-black text-green-400 group-hover:text-green-300 transition-colors">
                    {count}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mt-1">{size}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-[#171821]/40 backdrop-blur-2xl rounded-[40px] border border-white/5 overflow-hidden flex-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">Cargando pedidos...</p>
          </div>
        ) : jerseyRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Shirt className="w-12 h-12 text-gray-700" />
            <p className="text-[11px] font-black uppercase tracking-widest text-gray-600">
              {selectedEvent ? "Ningún registro con jersey en este evento." : "Selecciona un evento."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Folio", "Nombre Completo", "Kit", "Tipo / Diseño", "Talla", "Estado"].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-5 text-left text-[9px] font-black uppercase tracking-[0.3em] text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jerseyRows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-b border-white/[0.03] transition-colors hover:bg-white/[0.03] ${
                      i % 2 === 0 ? "" : "bg-white/[0.015]"
                    }`}
                  >
                    <td className="px-6 py-4">
                      <span className="text-[#00d2ff] font-black font-mono text-[11px] tracking-widest">
                        {r.folio}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-white font-bold text-[12px]">
                        {r.firstName} {r.lastName}
                      </p>
                      <p className="text-gray-600 text-[9px] font-mono mt-0.5 uppercase tracking-widest">{r.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-[#4b55f5]/20 text-[#4b55f5] border border-[#4b55f5]/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                        {r.kitName}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-gray-300 font-medium text-[11px]">{r.jerseyType || "—"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                        {r.jerseySize}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          r.status === "APPROVED"
                            ? "bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/20"
                            : r.status === "REJECTED"
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {jerseyRows.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-gray-600">
            <Users className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {jerseyRows.length} registro{jerseyRows.length !== 1 ? "s" : ""} con prenda
            </span>
          </div>
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-700">
            El CSV incluye BOM UTF-8 para compatibilidad con Excel
          </p>
        </div>
      )}
    </div>
  );
}
