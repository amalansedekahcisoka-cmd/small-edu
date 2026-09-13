'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DataProvider } from '@/lib/data/dataProvider';
import { Course, ClassRoom } from '@/types';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { UserPlus, ArrowLeft, CheckCircle2, AlertCircle, Sparkles, BookOpen, UserCheck, ShieldCheck, School } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [nisn, setNisn] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gradeClass, setGradeClass] = useState('');
  const [joinCode, setJoinCode] = useState('');

  // Daftar kelas resmi yang dibuat Admin
  const [availableClasses, setAvailableClasses] = useState<ClassRoom[]>([]);

  // Course Inspection state
  const [inspecting, setInspecting] = useState(false);
  const [courseInfo, setCourseInfo] = useState<Course | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  // Form submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    name: string;
    nisn: string;
    courseTitle: string;
    teacherName: string;
  } | null>(null);

  // Muat daftar kelas resmi yang dibuat Admin
  useEffect(() => {
    DataProvider.getClassesAsync().then((cls) => {
      if (cls && cls.length > 0) {
        setAvailableClasses(cls);
        // Default pilih kelas pertama jika belum dipilih
        setGradeClass(cls[0].name);
      }
    }).catch(console.error);
  }, []);

  // Debounced lookup untuk Join Code
  useEffect(() => {
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 3) {
      setCourseInfo(null);
      setCodeError(null);
      return;
    }

    const timer = setTimeout(async () => {
      setInspecting(true);
      setCodeError(null);
      try {
        const found = await DataProvider.getCourseByJoinCode(cleaned);
        if (found) {
          setCourseInfo(found);
          setCodeError(null);
        } else {
          setCourseInfo(null);
          setCodeError(`Kode kelas "${cleaned}" tidak ditemukan. Pastikan Anda meminta kode yang benar dari Guru.`);
        }
      } catch (err) {
        console.error('Error checking join code:', err);
        setCodeError('Gagal memeriksa kode kelas ke server.');
      } finally {
        setInspecting(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [joinCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validasi NISN (10 digit numerik)
    const cleanNisn = nisn.trim();
    if (!/^\d{10}$/.test(cleanNisn)) {
      setFormError('NISN wajib berupa 10 digit angka resmi (contoh: 0081234567).');
      return;
    }

    // Validasi Password
    if (password.length < 6) {
      setFormError('Kata sandi minimal 6 karakter demi keamanan akun Anda.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Konfirmasi kata sandi tidak cocok dengan kata sandi yang diisi.');
      return;
    }

    if (!courseInfo) {
      setFormError('Kode kelas yang Anda masukkan belum valid. Mohon masukkan kode kelas dari guru Anda.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Cek duplikasi NISN di Cloud
      const nisnCheck = await DataProvider.checkNisnExists(cleanNisn);
      if (nisnCheck.exists) {
        setFormError('NISN ini sudah terdaftar di sistem. Silakan login atau hubungi Guru/Admin jika lupa kata sandi.');
        setIsSubmitting(false);
        return;
      }

      // 2. Submit pendaftaran mandiri
      const res = await DataProvider.registerStudentSelf({
        name: name.trim(),
        nisn: cleanNisn,
        password: password.trim(),
        courseId: courseInfo.id,
        courseTitle: courseInfo.title,
        teacherId: courseInfo.teacherId,
        teacherName: courseInfo.teacherName,
        gradeClass: gradeClass.trim() || courseInfo.gradeLevel || 'Kelas X',
      });

      if (!res.success) {
        setFormError(res.message);
        setIsSubmitting(false);
        return;
      }

      setSuccessData({
        name: name.trim(),
        nisn: cleanNisn,
        courseTitle: courseInfo.title,
        teacherName: courseInfo.teacherName,
      });
    } catch (err: any) {
      console.error('Registration failed:', err);
      setFormError('Terjadi kesalahan saat memproses pendaftaran. Silakan periksa koneksi internet Anda.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#fffdfa]">
      {/* Decorative Grid Pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="w-full max-w-lg relative z-10 space-y-4">
        {/* Tombol Kembali ke Login */}
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-zinc-600 hover:text-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Halaman Login</span>
        </button>

        <RetroWindow
          title="PENDAFTARAN MANDIRI SISWA BARU"
          headerColor="teal"
          className="w-full shadow-2xl"
        >
          <div className="p-5 sm:p-6 space-y-5">
            {/* Header Form */}
            <div className="border-b-2 border-dashed border-zinc-300 pb-3">
              <div className="flex items-center gap-2 text-[#008080] font-black font-mono text-base">
                <UserPlus className="w-5 h-5" />
                <span>Formulir Registrasi Siswa</span>
              </div>
              <p className="text-xs text-zinc-600 font-mono mt-1">
                Lengkapi identitas resmi Anda dan masukkan Kode Pembelajaran dari Guru pengampu mata pelajaran.
              </p>
            </div>

            {/* Tampilan Sukses / Menunggu Persetujuan */}
            {successData ? (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 bg-emerald-50 neo-border-sm border-emerald-600 text-emerald-950 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-black font-mono text-sm uppercase">Pendaftaran Terkirim!</h4>
                      <p className="text-xs font-mono text-emerald-800">
                        Status akun Anda saat ini: <strong className="bg-amber-100 text-amber-900 px-1.5 py-0.5 neo-border-sm text-[11px]">MENUNGGU PERSETUJUAN GURU</strong>
                      </p>
                    </div>
                  </div>

                  <div className="text-xs font-mono bg-white/80 p-3 neo-border-sm space-y-1.5 text-zinc-800">
                    <div><strong>Nama:</strong> {successData.name}</div>
                    <div><strong>NISN:</strong> {successData.nisn}</div>
                    <div><strong>Mata Pelajaran:</strong> {successData.courseTitle}</div>
                    <div><strong>Guru Pengampu:</strong> {successData.teacherName}</div>
                  </div>

                  <p className="text-xs text-emerald-900 leading-relaxed">
                    Akun Anda telah tersimpan di sistem. Beritahukan kepada <strong>{successData.teacherName}</strong> untuk menyetujui (approve) pendaftaran Anda agar Anda dapat langsung mulai belajar.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <RetroButton
                    type="button"
                    variant="teal"
                    size="md"
                    className="w-full"
                    onClick={() => router.push('/')}
                  >
                    Kembali ke Halaman Login
                  </RetroButton>
                </div>
              </div>
            ) : (
              /* Formulir Pendaftaran */
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div className="p-3 bg-red-50 neo-border-sm border-red-600 text-red-900 text-xs font-mono flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{formError}</span>
                  </div>
                )}

                {/* 1. Kode Kelas Guru (Bagian Paling Krusial) */}
                <div className="p-3 bg-teal-50/70 neo-border-sm border-[#008080] space-y-2">
                  <label className="block text-xs font-mono font-bold text-[#008080] flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      KODE KELAS / KURSUS GURU *
                    </span>
                    {inspecting && (
                      <span className="text-[10px] text-zinc-500 animate-pulse">Memeriksa kode...</span>
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: MTK-7A atau X9K2PQ"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="w-full p-2.5 neo-border-sm bg-white font-mono font-bold text-sm tracking-widest text-center uppercase focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                  />

                  {/* Preview Validasi Kursus */}
                  {courseInfo && (
                    <div className="p-2.5 bg-white neo-border-sm border-emerald-500 text-xs font-mono space-y-1 animate-in fade-in duration-150">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-black">
                        <BookOpen className="w-4 h-4 shrink-0" />
                        <span>{courseInfo.title}</span>
                      </div>
                      <div className="text-zinc-600 pl-5 text-[11px]">
                        Pengampu: <strong>{courseInfo.teacherName}</strong> ({courseInfo.gradeLevel || 'Semua Tingkat'})
                      </div>
                    </div>
                  )}

                  {codeError && (
                    <div className="text-[11px] font-mono text-red-600 bg-red-50 p-2 neo-border-sm border-red-300">
                      {codeError}
                    </div>
                  )}
                  <p className="text-[11px] font-mono text-zinc-500">
                    *Minta 6 digit kode ini kepada Guru mata pelajaran Anda di kelas.
                  </p>
                </div>

                {/* 2. Nama Lengkap */}
                <div>
                  <label className="block text-xs font-mono font-bold text-zinc-700 mb-1">
                    NAMA LENGKAP SISWA *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Sesuai rapor / absensi resmi"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 neo-border-sm bg-white text-sm font-mono focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                  />
                </div>

                {/* 3. NISN & Kelas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono font-bold text-zinc-700 mb-1">
                      NISN (10 DIGIT) *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="0081234567"
                      value={nisn}
                      onChange={(e) => setNisn(e.target.value.replace(/\D/g, ''))}
                      className="w-full p-2.5 neo-border-sm bg-white text-sm font-mono focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-zinc-700 mb-1 flex items-center justify-between">
                      <span>ROMBEL / KELAS *</span>
                      <span className="text-[10px] text-zinc-500 font-normal">Pilih kelas resmi</span>
                    </label>
                    {availableClasses.length > 0 ? (
                      <select
                        required
                        value={gradeClass}
                        onChange={(e) => setGradeClass(e.target.value)}
                        className="w-full p-2.5 neo-border-sm bg-white text-sm font-mono font-bold text-black focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                      >
                        <option value="" disabled>-- Pilih Kelas Anda --</option>
                        {availableClasses.map((cls) => (
                          <option key={cls.id} value={cls.name}>
                            🏫 {cls.name} {cls.major ? `(${cls.major})` : ''}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. X RPL 1"
                        value={gradeClass}
                        onChange={(e) => setGradeClass(e.target.value.toUpperCase())}
                        className="w-full p-2.5 neo-border-sm bg-white text-sm font-mono focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                      />
                    )}
                  </div>
                </div>

                {/* 4. Password & Konfirmasi Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono font-bold text-zinc-700 mb-1">
                      KATA SANDI BARU *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Min. 6 karakter"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-2.5 neo-border-sm bg-white text-sm font-mono focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold text-zinc-700 mb-1">
                      ULANGI KATA SANDI *
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Ketik ulang sandi"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full p-2.5 neo-border-sm bg-white text-sm font-mono focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <RetroButton
                    type="submit"
                    variant="teal"
                    size="md"
                    disabled={isSubmitting || !courseInfo}
                    className="w-full"
                    icon={<UserCheck className="w-4 h-4" />}
                  >
                    {isSubmitting ? 'Memproses Pendaftaran...' : 'Kirim Pendaftaran ke Guru'}
                  </RetroButton>
                </div>
              </form>
            )}
          </div>
        </RetroWindow>

        {/* Security Badge */}
        <div className="flex items-center justify-center gap-1.5 text-xs font-mono text-zinc-600">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <span>Satu Siswa = Satu NISN Tunggal Terdaftar di Cloud</span>
        </div>
      </div>
    </div>
  );
}
