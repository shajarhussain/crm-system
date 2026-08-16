"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { user, role, loading } = useAuth();

  if (!loading && user) {
    if (role === "admin") router.push("/admin");
    else if (role === "employee") router.push("/employee");
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center p-4">Loading...</div>;

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-md border border-gray-100">
        <h2 className="text-3xl font-bold text-center text-gray-900 tracking-tight">CRM System</h2>
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700">Email Address</label>
            <input 
              type="email"
              required
              className="w-full px-4 py-2.5 mt-1 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black outline-none transition"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700">Password</label>
            <input 
              type="password"
              required
              className="w-full px-4 py-2.5 mt-1 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black outline-none transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
          <button 
            type="submit" 
            className="w-full px-4 py-3 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
