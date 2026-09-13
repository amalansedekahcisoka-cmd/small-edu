'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataProvider } from '@/lib/data/dataProvider';
import { User } from '@/types';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const currentUser = DataProvider.getCurrentUser();
    setUser(currentUser);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password baru minimal harus 6 karakter.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok dengan password baru.');
      return;
    }

    if (user) {
      setIsSubmitting(true);
      try {
        const ok = await DataProvider.changePasswordAsync(user.id, newPassword);
        if (ok) {
          setSuccess(true);
          setTimeout(() => {
            if (user.role === 'student') router.push('/student');
            else if (user.role === 'teacher') router.push('/teacher');
            else router.push('/admin');
          }, 1200);
        } else {
          setError('Gagal memperbarui kata sandi. Silakan coba kembali.');
          setIsSubmitting(false);
        }
      } catch (err: any) {
        setError(err?.message || 'Terjadi kendala saat menyimpan kata sandi baru.');
        setIsSubmitting(false);
      }
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-md mx-auto px-4 py-16 space-y-6">
      <RetroWindow
        title="PENGATURAN KATA SANDI BARU"
        headerColor="mustard"
        icon={<KeyRound className="w-4 h-4" />}
      >
        <div className="space-y-4">
          {user.mustChangePassword && (
            <div className="bg-[#fff1f0] neo-border-sm p-3 flex items-start gap-2 text-xs font-mono text-red-900">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong>Wajib Ganti Sandi Pertama Kali:</strong>
                <p>Akun kamu didaftarkan oleh administrator dengan kata sandi bawaan. Demi keamanan, silakan tentukan kata sandi baru pribadi kamu.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-100 border border-red-500 text-red-900 p-2 text-xs font-mono">
              ⚠️ {error}
            </div>
          )}

          {success ? (
            <div className="bg-[#79f2c0] neo-border-sm p-4 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-950 mx-auto" />
              <div className="font-bold text-sm text-emerald-950">
                Kata Sandi Berhasil Diperbarui!
              </div>
              <div className="text-xs font-mono text-emerald-900">
                Mengalihkan ke ruang belajar...
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
              <div>
                <label className="block font-bold mb-1">Nama Akun:</label>
                <input
                  type="text"
                  disabled
                  value={user.name}
                  className="w-full p-2 bg-zinc-200 border border-zinc-400 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Kata Sandi Baru:</label>
                <input
                  type="password"
                  required
                  placeholder="Minimal 6 karakter..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-2 neo-border-sm bg-white"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Ulangi Kata Sandi Baru:</label>
                <input
                  type="password"
                  required
                  placeholder="Ketik ulang kata sandi..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2 neo-border-sm bg-white"
                />
              </div>

              <div className="pt-2">
                <RetroButton type="submit" variant="teal" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Menyimpan Kata Sandi...' : 'Simpan Kata Sandi Baru & Lanjutkan'}
                </RetroButton>
              </div>
            </form>
          )}
        </div>
      </RetroWindow>
    </div>
  );
}
