"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      // Tras registrarse, Firebase los loguea automáticamente. 
      // El AuthProvider validará su rol. Si Eder (Super Admin) aún no les da rol,
      // el AuthProvider los sacará por seguridad, lo cual es el comportamiento deseado.
      router.push("/admin");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Este correo ya está registrado. Por favor, inicia sesión.");
      } else if (err.code === 'auth/weak-password') {
        setError("La contraseña debe tener al menos 6 caracteres.");
      } else {
        setError("Error al crear la cuenta. Revisa tus datos.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-sm border border-gray-200">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Crear Cuenta</h2>
          <p className="mt-2 text-sm text-gray-600">Regístrate para acceder al panel de tu evento</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignup}>
          {error && <p className="text-sm font-medium text-red-600 text-center bg-red-50 p-3 rounded-md">{error}</p>}
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <input
                type="email"
                required
                className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <input
                type="password"
                required
                className="relative block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-black focus:outline-none focus:ring-black sm:text-sm"
                placeholder="Crear contraseña (min. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Button type="submit" disabled={loading} className="w-full bg-black hover:bg-gray-800 disabled:opacity-50">
              {loading ? "Creando cuenta..." : "Crear Cuenta"}
            </Button>
          </div>
          <div className="text-center text-sm">
            <span className="text-gray-500">¿Ya tienes cuenta? </span>
            <Link href="/login" className="font-medium text-black hover:underline">
              Inicia sesión aquí
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
