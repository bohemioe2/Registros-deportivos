"use client";

import { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";

export default function SignaturePad({ onEnd }: { onEnd: (dataUrl: string) => void }) {
  const sigCanvas = useRef<any>(null);

  const clear = () => {
    sigCanvas.current?.clear();
    onEnd("");
  };

  const handleEnd = () => {
    if (sigCanvas.current?.isEmpty()) {
      onEnd("");
    } else {
      onEnd(sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-[#ffffff1a] rounded-xl bg-[#242636] overflow-hidden shadow-inner cursor-pointer">
        <SignatureCanvas 
          ref={sigCanvas} 
          penColor="#00d2ff"
          canvasProps={{ className: "w-full h-44 cursor-crosshair touch-none" }} 
          onEnd={handleEnd}
        />
      </div>
      <div className="flex justify-end pr-1">
        <button type="button" onClick={clear} className="text-[10px] uppercase tracking-widest font-bold text-[#ff5f6d] hover:text-white transition-colors bg-[#ff5f6d]/10 hover:bg-[#ff5f6d]/30 border border-[#ff5f6d]/20 px-4 py-2 rounded-lg">
          Borrar Autenticación (Retrazar)
        </button>
      </div>
    </div>
  );
}
