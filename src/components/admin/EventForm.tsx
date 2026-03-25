"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { Plus, Trash2, Loader2, Sparkles, CheckCircle2, MapPin } from "lucide-react";
import { useState, useEffect } from "react";
import { db, storage } from "@/lib/firebase/config";
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import WelcomePoster from "@/components/public/WelcomePoster";

const DEFAULT_VALUES = {
  name: "",
  description: "",
  paymentMethods: "",
  liabilityText: "",
  organizerEmail: "",
  categoriesEnabled: false,
  categories: [{ name: "Libre", gender: "MIXED", minAge: 18, maxAge: 99 }],
  posterTemplate: null,
  posterFontFamily: "Impact, sans-serif",
  posterColorFolio: "#00ffcc",
  posterColorName: "#ffffff",
  posterColorState: "#ccff00",
  posterColorWelcome: "#ff007f",
  showFolioOnPoster: true,
  eventBanner: null,
  kitsEnabled: false,
  kits: [{ name: "Kit Básico", description: "Medalla e Hidratación", price: 500, includesJersey: false }],
  jerseyTypes: ["Playera manga corta"],
  jerseySizes: ["Extra Chica", "Chica", "Mediana", "Grande", "Extra Grande"],
  enabledDocs: ["payment", "photo", "logo", "id"]
};

export default function EventForm({ initialData, onCancelEdit }: { initialData?: any; onCancelEdit?: () => void }) {
  const { register, handleSubmit, watch, control, reset } = useForm({
    defaultValues: initialData || DEFAULT_VALUES
  });

  const { fields, append, remove } = useFieldArray({ control, name: "categories" });
  const { fields: kitFields, append: kitAppend, remove: kitRemove } = useFieldArray({ control, name: "kits" as any });

  const categoriesEnabled = watch("categoriesEnabled");
  const kitsEnabled = watch("kitsEnabled");
  const kitsWatch = watch("kits");
  
  const posterTemplateList = watch("posterTemplate");
  const posterFontFamily = watch("posterFontFamily");
  const posterColorFolio = watch("posterColorFolio");
  const posterColorName = watch("posterColorName");
  const posterColorState = watch("posterColorState");
  const posterColorWelcome = watch("posterColorWelcome");
  const showFolioOnPoster = watch("showFolioOnPoster");
  const eventName = watch("name");

  const [isSaving, setIsSaving] = useState(false);
  const [templatePreviewUrl, setTemplatePreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrl, setBannerPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      let safeData = { ...DEFAULT_VALUES, ...initialData, posterTemplate: null, eventBanner: null };
      if(typeof safeData.jerseySizes === 'string') safeData.jerseySizes = safeData.jerseySizes.split(',').map((x:string) => x.trim()).filter((x:string) => x);
      if(typeof safeData.jerseyTypes === 'string') safeData.jerseyTypes = safeData.jerseyTypes.split(',').map((x:string) => x.trim()).filter((x:string) => x);
      if(!safeData.enabledDocs) safeData.enabledDocs = ["payment", "photo", "logo", "id"];
      
      reset(safeData);
      
      if (initialData.posterTemplateUrl) {
         setTemplatePreviewUrl(initialData.posterTemplateUrl);
      }
      if (initialData.eventBannerUrl) {
         setBannerPreviewUrl(initialData.eventBannerUrl);
      }
    } else {
      reset(DEFAULT_VALUES);
      setTemplatePreviewUrl(null);
      setBannerPreviewUrl(null);
    }
  }, [initialData, reset]);

  useEffect(() => {
    if (posterTemplateList && (posterTemplateList as any).length > 0) {
      const objectUrl = URL.createObjectURL((posterTemplateList as any)[0]);
      setTemplatePreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (!initialData?.posterTemplateUrl) {
      setTemplatePreviewUrl(null);
    }
  }, [posterTemplateList, initialData]);

  useEffect(() => {
    const bannerFile = watch("eventBanner");
    if (bannerFile && (bannerFile as any).length > 0) {
      const objectUrl = URL.createObjectURL((bannerFile as any)[0]);
      setBannerPreviewUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else if (!initialData?.eventBannerUrl) {
      setBannerPreviewUrl(null);
    }
  }, [watch("eventBanner"), initialData]);

  const onSubmit = async (data: any) => {
    setIsSaving(true);
    try {
      let posterTemplateUrl = initialData?.posterTemplateUrl || "";
      if (data.posterTemplate && data.posterTemplate.length > 0) {
        const fileRef = ref(storage, `templates/${Date.now()}_${data.posterTemplate[0].name}`);
        await uploadBytes(fileRef, data.posterTemplate[0]);
        posterTemplateUrl = await getDownloadURL(fileRef);
      }
      
      let eventBannerUrl = initialData?.eventBannerUrl || "";
      if (data.eventBanner && data.eventBanner.length > 0) {
        const fileRef = ref(storage, `banners/${Date.now()}_${data.eventBanner[0].name}`);
        await uploadBytes(fileRef, data.eventBanner[0]);
        eventBannerUrl = await getDownloadURL(fileRef);
      }

      // Evitar guardar objetos file binarios directamente a la Base de Datos
      const { posterTemplate, eventBanner, ...cleanData } = data;
      
      let kitsToSave = cleanData.kits ? [...cleanData.kits] : [];
      for(let i = 0; i < kitsToSave.length; i++) {
         let kitUrl = kitsToSave[i].imageUrl || "";
         if(kitsToSave[i].imageFile && kitsToSave[i].imageFile.length > 0) {
            try {
              const fref = ref(storage, `kits/${Date.now()}_${kitsToSave[i].imageFile[0].name}`);
              await uploadBytes(fref, kitsToSave[i].imageFile[0]);
              kitUrl = await getDownloadURL(fref);
            } catch(e) {
              console.error("Error cargando imagen de Kit:", e);
              alert("Hubo un error cargando la foto promocional del Paquete " + kitsToSave[i].name + ". El paquete se guardará sin la foto.");
            }
         }
         kitsToSave[i].imageUrl = kitUrl;
         delete kitsToSave[i].imageFile;
      }
      cleanData.kits = kitsToSave;

      if (initialData?.id) {
         await updateDoc(doc(db, "events", initialData.id), {
           ...cleanData,
           posterTemplateUrl,
           eventBannerUrl
         });
         alert("¡Operación Actualizada Exitosamente!");
         if (onCancelEdit) onCancelEdit();
      } else {
         await addDoc(collection(db, "events"), {
           ...cleanData,
           status: "ABIERTO", // Status Default
           date: "Por Definir", // Default for now
           posterTemplateUrl,
           eventBannerUrl,
           createdAt: serverTimestamp()
         });
         alert("¡Operación Evento sincronizada exitosamente en tu Base de Datos!");
         reset();
      }
    } catch (e) {
      console.error(e);
      alert("Error publicando el nodo del evento");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 max-w-4xl">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2 p-6 rounded-2xl bg-[#bb86fc]/10 border border-[#bb86fc]/30 shadow-inner mb-2">
           <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#bb86fc]">Imagen de Portada (Banner Público Opcional)</label>
           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Sube una fotografía ancha y de alta calidad (Landscape). Esta será la imagen principal que tus atletas verán al entrar a Mundo Deportivo.</p>
           
           {bannerPreviewUrl && (
             <div className="mb-4 rounded-xl overflow-hidden border border-[#bb86fc]/30 shadow-lg h-32 w-full">
                <img src={bannerPreviewUrl} className="w-full h-full object-cover" alt="Banner Preview" />
             </div>
           )}

           <input 
             type="file" 
             accept="image/*"
             {...register("eventBanner")} 
             className="w-full text-[12px] file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-[#bb86fc] file:text-black hover:file:bg-[#bb86fc]/80 text-gray-300 font-mono"
           />
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">Nombre Oficial de la Operación</label>
          <input 
            {...register("name", { required: true })} 
            className="w-full rounded-xl bg-[#171821] border border-[#ffffff10] text-gray-200 placeholder-gray-600 px-4 py-3 text-[13px] font-medium focus:border-[#00d2ff] focus:outline-none focus:ring-1 focus:ring-[#00d2ff] transition-all shadow-inner"
            placeholder="Ej: Triatlón Nacional 2026" 
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">Activación de Algoritmo de Categorías</label>
          <div className="flex items-center h-12 bg-[#171821] border border-[#ffffff10] rounded-xl px-4 shadow-inner">
            <input 
              type="checkbox" 
              {...register("categoriesEnabled")}
              className="h-5 w-5 rounded border-[#ffffff20] bg-[#242636] text-[#4b55f5] focus:ring-[#4b55f5] cursor-pointer"
            />
            <span className="ml-3 text-[12px] font-bold text-gray-400">Habilitar matrices segmentadas por edad y rama</span>
          </div>
        </div>

        {categoriesEnabled && (
          <div className="md:col-span-2 space-y-4 border border-[#4b55f5]/20 p-6 rounded-2xl bg-[#4b55f5]/5 shadow-inner transition-all transform origin-top">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-[#ffffff10] gap-4">
              <div>
                <h4 className="text-[12px] font-bold text-[#00d2ff] uppercase tracking-[0.1em] flex items-center gap-2">
                   <Sparkles className="w-4 h-4" /> Categorías Definidas
                </h4>
                <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mt-1">Configura parámetros matemáticos para la asignación automática.</p>
              </div>
              <button type="button" onClick={() => append({ name: "", gender: "MIXED", minAge: 0, maxAge: 99 })} className="bg-[#171821] text-[#00d2ff] border border-[#00d2ff]/30 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm flex items-center gap-2 hover:bg-[#00d2ff]/10 hover:scale-105 transition-all w-full sm:w-auto justify-center">
                <Plus className="w-3.5 h-3.5" /> Agregar Fila
              </button>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-end bg-[#171821] p-4 rounded-xl border border-[#ffffff0a] shadow-sm group">
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Id de Grupo (Nombre)</label>
                  <input {...register(`categories.${index}.name` as const)} placeholder="Ej. Veteranos Elite" required className="w-full text-xs font-bold bg-[#242636] border border-[#ffffff10] text-gray-200 placeholder-gray-600 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#00d2ff]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Rama</label>
                  <select {...register(`categories.${index}.gender` as const)} className="w-full text-xs font-bold bg-[#242636] border border-[#ffffff10] text-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#00d2ff] appearance-none">
                    <option value="MIXED">Mixta</option>
                    <option value="MALE">Varonil</option>
                    <option value="FEMALE">Femenil</option>
                  </select>
                </div>
                <div className="flex gap-3 sm:col-span-2 w-full">
                  <div className="w-2/5 space-y-2">
                    <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Mín</label>
                    <input type="number" {...register(`categories.${index}.minAge` as const)} required className="w-full text-xs font-bold bg-[#242636] border border-[#ffffff10] text-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#00d2ff]" />
                  </div>
                  <div className="w-2/5 space-y-2">
                    <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Máx</label>
                    <input type="number" {...register(`categories.${index}.maxAge` as const)} required className="w-full text-xs font-bold bg-[#242636] border border-[#ffffff10] text-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#00d2ff]" />
                  </div>
                  <div className="w-1/5 flex items-end justify-end pb-0.5">
                     <button type="button" onClick={() => remove(index)} className="text-gray-500 hover:bg-[#ff5f6d]/10 hover:text-[#ff5f6d] border border-transparent hover:border-[#ff5f6d]/20 w-10 h-[38px] rounded-lg flex items-center justify-center transition-all bg-[#242636]">
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- MODULO DE KITS FINANCIEROS Y TEXTILES --- */}
        <div className="space-y-4 md:col-span-2 p-6 rounded-2xl bg-gradient-to-r from-green-500/5 to-teal-500/5 border border-green-500/20 mt-4">
           <label className="flex flex-col gap-2">
             <div className="flex items-center gap-3">
               <input type="checkbox" {...register("kitsEnabled")} className="w-5 h-5 accent-green-500 bg-[#171821] border-[#ffffff30] rounded cursor-pointer" />
               <h3 className="text-green-400 text-lg font-bold tracking-tight">Habilitar Upsells: Kits & Textiles</h3>
             </div>
             <p className="text-xs text-green-500/70 font-medium ml-8">Crea paquetes de diferente precio. Si envías prendas de ropa, el sistema exigirá al atleta su Selección de Tallas obligada.</p>
           </label>

           {kitsEnabled && (
             <div className="pl-2 sm:pl-8 space-y-6 pt-4 border-t border-green-500/10 mt-4">
               
               {/* Global Textile Settings */}
               {(kitsWatch || []).some((k:any) => k?.includesJersey) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 bg-[#171821] p-6 rounded-2xl border border-green-500/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.4)] relative overflow-hidden">
                     <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-green-500 to-[#00d2ff]"></div>
                     
                     <div className="space-y-4">
                       <div>
                         <label className="text-[12px] text-green-400 font-bold uppercase tracking-[0.2em] flex items-center gap-2 mb-1">
                           <CheckCircle2 className="w-4 h-4 text-[#00d2ff]" /> Tipos de Prenda
                         </label>
                         <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4 leading-relaxed">Selecciona los cortes y prendas que ofrecerás a la venta globalmente.</p>
                       </div>
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                         {["Chamarra", "Sudadera", "Rompe vientos", "Playera manga corta", "Playera manga larga", "Jersey ajustado con bolsas", "Jersey enduro (Holgado)"].map((t) => (
                           <label key={t} className="flex items-start gap-3 bg-[#242636] px-4 py-3.5 rounded-xl border border-[#ffffff05] cursor-pointer hover:bg-[#303348] hover:border-[#00d2ff]/30 transition-all group">
                             <div className="pt-0.5 shrink-0"><input type="checkbox" value={t} {...register("jerseyTypes")} className="w-4 h-4 accent-[#00d2ff] bg-black border-[#ffffff30] cursor-pointer" /></div>
                             <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest group-hover:text-white transition-colors leading-tight">{t}</span>
                           </label>
                         ))}
                       </div>
                     </div>
                     
                     <div className="space-y-4">
                       <div>
                         <label className="text-[12px] text-green-400 font-bold uppercase tracking-[0.2em] flex items-center gap-2 mb-1">
                           <CheckCircle2 className="w-4 h-4 text-green-400" /> Tallas Activas
                         </label>
                         <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4 leading-relaxed">Selecciona el espectro de medidas de fabricación confirmadas.</p>
                       </div>
                       <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                         {["Extra Chica", "Chica", "Mediana", "Grande", "Extra Grande", "XXL", "XXXL"].map((s) => (
                           <label key={s} className="flex items-start gap-3 bg-[#242636] px-4 py-3.5 rounded-xl border border-[#ffffff05] cursor-pointer hover:bg-[#303348] hover:border-green-400/30 transition-all group">
                             <div className="pt-0.5 shrink-0"><input type="checkbox" value={s} {...register("jerseySizes")} className="w-4 h-4 accent-green-400 bg-black border-[#ffffff30] cursor-pointer" /></div>
                             <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest group-hover:text-white transition-colors leading-tight">{s}</span>
                           </label>
                         ))}
                       </div>
                     </div>
                     
                  </div>
               )}

               {kitFields.map((field, idx) => (
                 <div key={field.id} className="relative bg-[#1a1c23] border border-green-500/10 rounded-xl p-5 shadow-sm group hover:border-green-500/30 transition-colors mt-4">
                   <button type="button" onClick={() => kitRemove(idx)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 h-8 w-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-xl hover:scale-110">
                     <Trash2 className="w-4 h-4" />
                   </button>
                   <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                     <div className="sm:col-span-4">
                       <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1.5 block">Nombre del Kit</label>
                       <input {...register(`kits.${idx}.name` as const, { required: true })} className="w-full bg-[#242636] border border-[#ffffff10] text-green-300 rounded-lg text-sm font-bold px-4 py-2.5 focus:outline-none focus:border-green-500 transition-all" placeholder="Kit Premium" />
                     </div>
                     <div className="sm:col-span-4">
                       <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1.5 block">Precio / Costo ($)</label>
                       <input type="number" {...register(`kits.${idx}.price` as const, { required: true })} className="w-full bg-[#242636] border border-[#ffffff10] text-[#00d2ff] rounded-lg font-mono text-sm px-4 py-2.5 focus:outline-none focus:border-[#00d2ff] transition-all" placeholder="850" />
                     </div>
                     <div className="sm:col-span-4 flex items-center">
                       <label className="flex items-center gap-3 mt-4 sm:mt-6 bg-[#242636] border border-[#ffffff10] px-4 py-2.5 rounded-lg w-full cursor-pointer hover:bg-[#303348] transition-colors">
                         <input type="checkbox" {...register(`kits.${idx}.includesJersey` as const)} className="w-4 h-4 accent-green-400 cursor-pointer" />
                         <span className="text-[10px] uppercase font-bold text-gray-300 tracking-[0.2em] whitespace-nowrap overflow-hidden text-ellipsis">Incluye Prenda (Tallas)</span>
                       </label>
                     </div>
                     <div className="sm:col-span-12">
                       <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1.5 block">Descripción de Entregables</label>
                       <input {...register(`kits.${idx}.description` as const, { required: true })} className="w-full bg-[#242636] border border-[#ffffff10] text-gray-300 rounded-lg text-xs px-4 py-2.5 focus:outline-none focus:border-green-500 transition-all" placeholder="Jersey Oficial, Medalla 3D Finisher, Calcetas, Hidratación Libre." />
                     </div>
                     <div className="sm:col-span-12">
                       <label className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-2">🔗 Foto Promocional del Paquete <span className="text-gray-500 font-normal lowercase">(Opcional)</span></label>
                       <div className="flex flex-col sm:flex-row gap-3">
                          <input type="file" accept="image/*" {...register(`kits.${idx}.imageFile` as const)} className="w-full bg-[#1c1d29] border border-[#ffffff10] text-gray-300 rounded-lg text-[10px] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-[9px] file:font-bold file:uppercase file:bg-green-500/20 file:text-green-400 hover:file:bg-green-500/30 transition-all" />
                          {(field as any).imageUrl && <span className="text-[10px] text-green-400 font-bold mt-2 sm:mt-0 flex items-center shrink-0">✓ Imagen Pre-Cargada</span>}
                       </div>
                     </div>
                   </div>
                 </div>
               ))}
               
               <button type="button" onClick={() => kitAppend({ name: "Nuevo Kit", description: "Básico", price: 0, includesJersey: false, imageUrl: "" })} className="flex items-center gap-2 text-green-400 text-xs font-bold px-5 py-3 rounded-xl border border-dashed border-green-500/50 hover:bg-green-500/10 transition-all w-full justify-center tracking-widest uppercase mt-4">
                 <Plus className="w-4 h-4" /> Agregar Nuevo Paquete Económico
               </button>
             </div>
           )}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">Descripción Pública (Datos para el Portal Web)</label>
          <textarea 
            {...register("description")} 
            rows={3}
            className="w-full rounded-xl bg-[#171821] border border-[#ffffff10] text-gray-200 placeholder-gray-600 px-4 py-3 text-[13px] font-medium focus:border-[#00d2ff] focus:outline-none focus:ring-1 focus:ring-[#00d2ff] transition-all shadow-inner custom-scrollbar"
            placeholder="Especifica sedes físicas, rutas, premios o metodologías de competencia. Esta data se mostrará a los atletas." 
          />
        </div>

        <div className="space-y-2 md:col-span-2 border-t border-[#ffffff0a] pt-6">
          <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">Credenciales Fiduciarias (Instrucciones Bancarias)</label>
          <textarea 
            {...register("paymentMethods")} 
            rows={2}
            className="w-full rounded-xl bg-[#171821] border border-[#ffffff10] text-[#00d2ff] font-mono px-4 py-3 text-[12px] focus:border-[#4b55f5] focus:outline-none focus:ring-1 focus:ring-[#4b55f5] transition-all shadow-inner custom-scrollbar"
            placeholder="Banco: XYZ | CLABE: 0123456789 | Nombre: Liga Nacional de Deportes" 
          />
        </div>

        <div className="space-y-3 md:col-span-2 border border-[#884af0]/30 rounded-2xl bg-gradient-to-r from-[#884af0]/10 to-[#4b55f5]/5 p-6 shadow-inner relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#884af0]/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#884af0]">Delegación de Autoridad (Multi-Tenant Inquilino)</label>
          <input 
            type="email"
            {...register("organizerEmail")} 
            className="w-full rounded-xl bg-[#171821] border border-[#884af0]/30 text-white placeholder-gray-600 px-4 py-3 text-[13px] font-medium focus:border-[#884af0] focus:outline-none focus:ring-1 focus:ring-[#884af0] transition-all shadow-inner relative z-10"
            placeholder="correo_del_cliente@su-organizacion.com" 
          />
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed relative z-10">Si anexas una cripto-identidad (correo) en este renglón, al momento de que esa credencial inicie sesión, su panel Dashboard quedará aislado, otorgándole visibilidad <b className="text-[#00d2ff]">SÓLO</b> a esta campaña. Tú ostentarás la visual de SuperAdministrador en todo momento.</p>
        </div>

        <div className="space-y-2 md:col-span-2 p-6 rounded-2xl bg-[#00d2ff]/10 border border-[#00d2ff]/30 shadow-inner">
           <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#00d2ff]">Diseño de Bienvenida HD (Frame PNG/Transparente)</label>
           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Sube el diseño gráfico transparente (.PNG) de tu evento. La app pondrá este diseño por encima de la foto del atleta, y estampará automáticamente el nombre, número y estado del participante según tu plantilla de referencia.</p>
           <input 
             type="file" 
             accept="image/png"
             {...register("posterTemplate")} 
             className="w-full text-[12px] file:mr-4 file:py-2.5 file:px-6 file:rounded-full file:border-0 file:text-[10px] file:uppercase file:tracking-widest file:font-bold file:bg-[#00d2ff] file:text-black hover:file:bg-[#00d2ff]/80 text-gray-300 font-mono"
           />
        </div>

        <div className="space-y-4 md:col-span-2 p-6 rounded-2xl bg-[#ff5f6d]/5 border border-[#ff5f6d]/30 shadow-inner mt-2">
           <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#ff5f6d]">Estilo de Textos para Bienvenida HD</label>
           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-3">Escoge la tipografía y los colores de las letras para que combinen perfecto con el diseño de tu marco PNG.</p>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Tipografía Global</label>
                <select {...register("posterFontFamily")} className="w-full text-xs font-bold bg-[#242636] border border-[#ffffff10] text-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#ff5f6d] appearance-none custom-select">
                  <option value="Impact, sans-serif">Impact (Gruesa)</option>
                  <option value="'Arial Black', sans-serif">Arial Black (Fuerte)</option>
                  <option value="Georgia, serif">Georgia (Elegante)</option>
                  <option value="'Courier New', monospace">Courier New (Digital)</option>
                  <option value="sans-serif">System Sans (Moderna)</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Color del Folio</label>
                <input type="color" {...register("posterColorFolio")} className="w-full h-10 rounded-lg cursor-pointer bg-transparent" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Color del Nombre</label>
                <input type="color" {...register("posterColorName")} className="w-full h-10 rounded-lg cursor-pointer bg-transparent" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Color del Estado</label>
                <input type="color" {...register("posterColorState")} className="w-full h-10 rounded-lg cursor-pointer bg-transparent" />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase font-bold text-gray-500 tracking-widest">Color Bienvenida</label>
                <input type="color" {...register("posterColorWelcome")} className="w-full h-10 rounded-lg cursor-pointer bg-transparent" />
              </div>
           </div>
           
           <div className="mt-4 flex items-center gap-3 bg-[#171821] p-4 rounded-xl border border-[#ffffff10]">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" {...register("showFolioOnPoster")} />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#ff5f6d]"></div>
              </label>
              <div>
                <span className="text-sm font-bold text-gray-200">Mostrar Folio en Dinámica Gráfica</span>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">Si lo desactivas, el hashtag con el número del competidor se borrará en todas las generaciones HD y visualizaciones.</p>
              </div>
           </div>
        </div>
        
        {/* VISTA PREVIA DEL POSTER */}
        {templatePreviewUrl && (
          <div className="md:col-span-2 p-8 border border-[#00d2ff]/30 bg-[#00d2ff]/5 rounded-3xl shadow-2xl flex flex-col items-center mt-6">
             <h3 className="text-sm font-bold tracking-widest uppercase text-[#00d2ff] mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> Vista Previa en Vivo (Simulación de Participante)
             </h3>
             <div className="w-full max-w-sm mx-auto transform scale-[0.80] sm:scale-100 origin-top pointer-events-none">
               <WelcomePoster 
                 isPreview={true}
                 folio="036"
                 name="MARIA INES RAMIREZ"
                 eventName={eventName || "EVENTO DE PRUEBA"}
                 category="Femenil"
                 originState="HIDALGO"
                 posterTemplateUrl={templatePreviewUrl}
                 posterFontFamily={posterFontFamily}
                 posterColorFolio={posterColorFolio}
                 posterColorName={posterColorName}
                 posterColorState={posterColorState}
                 posterColorWelcome={posterColorWelcome}
                 showFolioOnPoster={showFolioOnPoster !== false}
                 gender="FEMALE"
                 photoUrl="https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?q=80&w=1000&auto=format&fit=crop"
               />
             </div>
              <p className="text-[10px] text-gray-500 mt-2 text-center max-w-lg font-bold uppercase tracking-widest leading-relaxed">Nota: Los usuarios reales publicos sí podrán desplazar libremente sus textos arrastrándolos con el dedo para encuadrarlos perfectamente en la app final.</p>
           </div>
        )}
        
        {/* === MODULO DE DOCUMENTOS REQUERIDOS === */}
        <div className="space-y-4 md:col-span-2 mt-4 bg-[#171821] p-6 rounded-2xl border border-[#ffffff10] shadow-[inset_0_5px_20px_rgba(0,0,0,0.5)]">
           <div>
             <label className="text-[12px] uppercase font-bold tracking-[0.2em] text-[#ff5f6d] flex items-center gap-2 mb-1">
               <CheckCircle2 className="w-5 h-5 text-[#ff5f6d]" /> Documentos / Archivos Auditables
             </label>
             <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-relaxed">Selecciona los módulos de carga de imágenes y archivos que el atleta deberá llenar para liberar su ticket.</p>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
             {[
               { val: "payment", label: "Comprobante de Pago", desc: "Tickets y Transf." },
               { val: "photo", label: "Fotografía del Perfil", desc: "Extracción para Bienvenida" },
               { val: "logo", label: "Logotipo de Equipo", desc: "PNG recomendado" },
               { val: "id", label: "Identidad Oficial", desc: "INE / Documento legal" }
             ].map((docItem) => (
                <label key={docItem.val} className="flex flex-col gap-2 bg-[#242636] p-4 rounded-xl border border-[#ffffff05] cursor-pointer hover:border-[#ff5f6d]/30 transition-colors group">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" value={docItem.val} {...register("enabledDocs")} className="w-4 h-4 accent-[#ff5f6d] bg-black border-[#ffffff30]" />
                    <span className="text-[11px] font-bold text-gray-300 uppercase tracking-widest group-hover:text-white">{docItem.label}</span>
                  </div>
                  <span className="text-[9px] text-gray-500 ml-7 tracking-widest font-medium uppercase font-mono">{docItem.desc}</span>
                </label>
             ))}
           </div>
        </div>
        
        <div className="space-y-4 md:col-span-2 border-t border-[#ffffff0a] pt-10">
           <h3 className="text-[#00d2ff] text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5" /> Logística Final (Para Página de Éxito)
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                 <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">Ubicación (Texto Libre)</label>
                 <input {...register("locationText")} className="w-full rounded-xl bg-[#171821] border border-[#ffffff10] text-gray-200 px-4 py-3 text-[13px]" placeholder="Ej: Auditorio Francisco Villa, Sede Central" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">URL Google Maps (Opcional)</label>
                 <input {...register("locationUrl")} className="w-full rounded-xl bg-[#171821] border border-[#ffffff10] text-[#00d2ff] px-4 py-3 text-[13px]" placeholder="https://maps.google.com/..." />
              </div>
              <div className="md:col-span-2 space-y-2">
                 <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">Recomendaciones e Instrucciones Finales</label>
                 <textarea {...register("finalInstructions")} rows={3} className="w-full rounded-xl bg-[#171821] border border-[#ffffff10] text-gray-200 px-4 py-3 text-[13px]" placeholder="Ej: Llegar 30 min antes. Es obligatorio el uso de casco y número frontal." />
              </div>
           </div>
        </div>

        <div className="space-y-2 md:col-span-2 mt-4">
           <div className="flex justify-between items-end mb-2">
             <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-gray-500">Carta Legal y Terminos Responsivos</label>
             <span className="text-[9px] uppercase tracking-widest text-[#ff5f6d] font-bold">Firma requerida p/Aceptación</span>
          </div>
          <textarea 
            {...register("liabilityText", { required: true })} 
            rows={5}
            className="w-full rounded-xl bg-[#171821] border border-[#ffffff10] text-gray-400 px-4 py-4 text-[11px] font-mono focus:border-[#ff5f6d] focus:outline-none focus:ring-1 focus:ring-[#ff5f6d] custom-scrollbar shadow-inner"
            placeholder="Dictamino que me hallo en capacidades bio-físicas intactas para atravesar la prueba..." 
          />
        </div>
      </div>

      <div className="flex justify-end border-t border-[#ffffff0a] pt-8 gap-4">
        {initialData && (
          <button type="button" onClick={onCancelEdit} className="px-8 py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] border border-[#ffffff20] text-gray-400 hover:text-white hover:bg-[#ffffff10] transition-colors">
            Cancelar Edición
          </button>
        )}
        <button disabled={isSaving} type="submit" className="bg-gradient-to-r from-[#4b55f5] to-[#884af0] text-white px-10 py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-[0_10px_30px_rgba(75,85,245,0.4)] disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-[#00d2ff]"/> : null} 
          {isSaving ? "Inyectando Nodo..." : (initialData ? "Actualizar y Sobreescribir Operación" : "Compilar y Publicar Operación Automáticamente")}
        </button>
      </div>
    </form>
  );
}
