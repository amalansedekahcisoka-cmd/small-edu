'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataProvider } from '@/lib/data/dataProvider';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { LogIn, AlertCircle, Lock, UserCheck, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const cleanInput = identifier.toLowerCase().trim();
      const cleanPassword = password.trim();

      // Panggil endpoint autentikasi server yang aman
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanInput, password: cleanPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Gagal masuk. Periksa kembali NISN/NIP atau kata sandi Anda.');
        setIsLoading(false);
        return;
      }

      const matchedUser = data.user;

      // Simpan identitas pengguna aktif di dataProvider
      DataProvider.setCurrentUser(matchedUser);

      if (data.mustChangePassword) {
        router.push('/auth/change-password');
        return;
      }

      if (matchedUser.role === 'admin') router.push('/admin');
      else if (matchedUser.role === 'teacher') router.push('/teacher');
      else router.push('/student');
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Terjadi kendala jaringan saat memproses login. Silakan coba kembali.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Main Centered Login Window */}
        <RetroWindow
          title="AUTENTIKASI PENGGUNA • SMALL-EDU LMS"
          headerColor="navy"
          icon={<Lock className="w-4 h-4 text-yellow-300" />}
          className="neo-shadow-xl"
        >
          <div className="space-y-6">
            {/* School Brand Header */}
            <div className="text-center space-y-2 pb-4 border-b-2 border-black">
              <div className="w-12 h-12 bg-[#008080] text-white neo-border neo-shadow-sm flex items-center justify-center font-black text-2xl mx-auto">
                S
              </div>
              <h1 className="text-xl font-black tracking-tight text-black">
                SMALL-EDU LMS
              </h1>
              <p className="text-xs font-mono text-zinc-600">
                Sistem Pembelajaran Mandiri & Berurutan
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-[#fff1f0] neo-border-sm text-red-900 font-mono text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLogin} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block font-bold mb-1.5 text-black flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5" />
                  Email / ID Pengguna:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Masukkan email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full p-2.5 neo-border-sm bg-white text-sm focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block font-bold mb-1.5 text-black flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Kata Sandi:
                </label>
                <input
                  type="password"
                  required
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 neo-border-sm bg-white text-sm focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <RetroButton
                  type="submit"
                  variant="teal"
                  size="md"
                  disabled={isLoading}
                  className="w-full"
                  icon={<LogIn className="w-4 h-4" />}
                >
                  {isLoading ? 'Memverifikasi...' : 'Masuk ke Portal LMS 🚀'}
                </RetroButton>
              </div>
            </form>

          </div>
        </RetroWindow>

        {/* Security / Production Badge */}
        <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-zinc-600">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Sistem Akses Terenkripsi & Terintegrasi Cloud</span>
        </div>
      </div>
    </div>
  );
}
