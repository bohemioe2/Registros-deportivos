"use client";

import { AuthProvider } from "@/components/admin/AuthProvider";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex h-[100dvh] print:h-auto bg-[#1b1c27] overflow-hidden print:overflow-visible text-white font-sans">
        <AdminSidebar />
        <div className="flex-1 flex flex-col h-full print:h-auto bg-[#1b1c27]">
          {/* Main content takes full height without separating header like the old layout, to match the full immersive screenshot approach */}
          <main className="flex-1 h-full print:h-auto overflow-hidden print:overflow-visible bg-[#1b1c27]">
            {children}
          </main>
        </div>
      </div>
    </AuthProvider>
  );
}
