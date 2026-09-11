'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BabLearningReport } from '@/types';

interface BabReportPdfModalProps {
  report: BabLearningReport | null;
  onClose: () => void;
}

export const BabReportPdfModal: React.FC<BabReportPdfModalProps> = ({ report, onClose }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!report || !mounted) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = report.completedAt
    ? new Date(report.completedAt).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

  // Penentuan status capaian umum
  const avgScore = report.averageScore || 0;
  const conceptStatus =
    avgScore >= 85
      ? { label: 'Baik', bg: 'bg-[#10b981]', text: 'text-white', badge: 'bg-emerald-100 text-emerald-800' }
      : avgScore >= 70
      ? { label: 'Sedang', bg: 'bg-[#f59e0b]', text: 'text-white', badge: 'bg-amber-100 text-amber-900' }
      : { label: 'Perlu Penguatan', bg: 'bg-[#ef4444]', text: 'text-white', badge: 'bg-rose-100 text-rose-900' };

  const examStatus =
    report.assessments.length > 0 && report.assessments.every((a) => (a.score ?? 0) >= 70)
      ? { label: 'Baik', bg: 'bg-[#10b981]', text: 'text-white' }
      : { label: 'Sedang', bg: 'bg-[#f59e0b]', text: 'text-white' };

  const xpStatus =
    report.totalXpEarned >= 30
      ? { label: 'Sangat Aktif', bg: 'bg-[#0284c7]', text: 'text-white' }
      : { label: 'Aktif', bg: 'bg-[#0ea5e9]', text: 'text-white' };

  const starStatus =
    report.totalStarsEarned > 0
      ? { label: `${report.totalStarsEarned} Bintang Diraih`, bg: 'bg-[#eab308]', text: 'text-white' }
      : { label: 'Dalam Proses', bg: 'bg-[#94a3b8]', text: 'text-white' };

  const modalContent = (
    <div
      id="report-portal-root"
      className="fixed inset-0 z-50 flex flex-col items-center bg-black/75 backdrop-blur-sm overflow-y-auto p-3 sm:p-6 print:p-0 print:bg-white print:static print:block"
    >
      {/* ── Global Print Stylesheet (Isolates print to this exact element, strictly 1 page A4) ── */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm 10mm 8mm 10mm;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                height: auto !important;
                overflow: visible !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              body > *:not(#report-portal-root) {
                display: none !important;
              }
              #report-portal-root {
                display: block !important;
                position: static !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              #rapor-pendidikan-sheet {
                box-shadow: none !important;
                border: none !important;
                padding: 0 !important;
                margin: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                page-break-after: avoid !important;
                page-break-inside: avoid !important;
              }
              .screen-action-bar {
                display: none !important;
              }
            }
          `,
        }}
      />

      {/* ── Screen Floating Action Bar (Hidden in Print) ── */}
      <div className="screen-action-bar w-full max-w-4xl bg-gray-900 text-white px-5 py-3 rounded-xl border border-gray-700 shadow-2xl flex items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-sm">
            📊
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-wide text-gray-100">
              Rapor Pendidikan Belajar Siswa (Model Kemendikdasmen)
            </h3>
            <p className="text-[11px] text-gray-400">
              Informatif, Visual &amp; Deskriptif — Pasti Pas 1 Halaman A4
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <span>🖨️ Cetak / Unduh PDF (1 Lembar)</span>
          </button>
          <button
            onClick={onClose}
            className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-xs px-3.5 py-2 rounded-lg border border-gray-700 transition-colors"
          >
            ✕ Tutup
          </button>
        </div>
      </div>

      {/* ── RAPOR PENDIDIKAN SHEET (Gaya Kemendikdasmen, Pas 1 Lembar A4) ── */}
      <div
        id="rapor-pendidikan-sheet"
        className="w-full max-w-[794px] bg-white text-gray-900 p-6 sm:p-8 shadow-2xl border border-gray-200 rounded-xl my-auto leading-normal font-sans"
      >
        {/* ── HEADER RAPOR PENDIDIKAN ── */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4 mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                Rapor Hasil Belajar
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium pt-0.5">Rapor Capaian Belajar Milik</p>
            <h1 className="text-2xl font-black text-blue-700 tracking-tight uppercase">
              {report.studentName}
            </h1>
            <p className="text-xs font-semibold text-gray-700">
              NISN: <span className="font-mono">{report.nisn || report.studentId}</span> &nbsp;·&nbsp;
              Kelas: {report.studentClass} &nbsp;·&nbsp;
              Mata Pelajaran: <strong className="text-gray-900">{report.courseTitle}</strong>
            </p>
            <p className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded inline-block border border-emerald-200 mt-1">
              Lingkup Materi: BAB {report.babNumber} — {report.babTitle}
            </p>
          </div>

          {/* Logo Kemendikdasmen Badge */}
          <div className="text-right shrink-0 flex flex-col items-end">
            <div className="flex items-center gap-2 bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-sm">
              <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-[11px] font-black text-white">
                §
              </div>
              <div className="text-left leading-tight">
                <p className="text-[9px] font-bold tracking-wider uppercase text-gray-300">Small-Edu</p>
                <p className="text-[10px] font-black text-white">Rapor Pendidikan</p>
              </div>
            </div>
            <span className="text-[9px] font-bold text-gray-600 mt-1 uppercase tracking-wider">
              Identifikasi · Refleksi · Benahi
            </span>
          </div>
        </div>

        {/* ── DESKRIPSI SINGKAT RAPOR PENDIDIKAN ── */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4 text-xs text-gray-700 leading-relaxed">
          <p>
            Rapor Capaian Belajar ini menyajikan ringkasan perkembangan belajar peserta didik secara komprehensif pada lingkup materi ini, mencakup penguasaan konsep, ketuntasan butir soal asesmen, keaktifan belajar, dan manajemen waktu pengerjaan.
          </p>
          <p className="font-bold text-gray-900 mt-1">
            Yuk, lihat hasil capaian pembelajaran pada bab ini!
          </p>
        </div>

        {/* ── GRID KARTU INDIKATOR (3 Kolom x 2 Baris) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {/* Card 1: Penguasaan Konsep & Teori */}
          <div className="border border-gray-200 rounded-xl p-3.5 bg-white shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="w-full h-1 bg-emerald-500 absolute top-0 left-0" />
            <div>
              <h3 className="font-bold text-xs text-gray-900 mb-1.5 text-center">
                Kemampuan Penguasaan Materi
              </h3>
              <div className="flex justify-center my-1">
                <span className={`text-xs font-black px-4 py-1 rounded-full ${conceptStatus.bg} ${conceptStatus.text}`}>
                  {conceptStatus.label}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 font-bold text-center mt-1">
                ↑ Skor Rata-rata: {avgScore} / 100
              </p>
              <p className="text-[11px] text-gray-600 leading-relaxed mt-2">
                <strong>Capaian:</strong> Mampu memahami konsep teori, struktur materi, dan arahan pembelajaran pada modul bab ini.
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[9px] font-black text-emerald-800">
              <span>CAPAIAN UTAMA</span>
              <span>📈 TUNTAS</span>
            </div>
          </div>

          {/* Card 2: Ketuntasan Ujian & Butir Soal */}
          <div className="border border-gray-200 rounded-xl p-3.5 bg-white shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="w-full h-1 bg-blue-500 absolute top-0 left-0" />
            <div>
              <h3 className="font-bold text-xs text-gray-900 mb-1.5 text-center">
                Ketuntasan Ujian &amp; Butir Soal
              </h3>
              <div className="flex justify-center my-1">
                <span className={`text-xs font-black px-4 py-1 rounded-full ${examStatus.bg} ${examStatus.text}`}>
                  {examStatus.label}
                </span>
              </div>
              <p className="text-[11px] text-blue-700 font-bold text-center mt-1">
                {report.assessments.length} Asesmen Teruji
              </p>
              <p className="text-[11px] text-gray-600 leading-relaxed mt-2">
                <strong>Capaian:</strong> Mampu menyelesaikan butir-butir pertanyaan latihan (pilihan ganda, menjodohkan, isian, &amp; analisis).
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[9px] font-black text-blue-800">
              <span>HASIL ASESMEN</span>
              <span>🎯 TERVERIFIKASI</span>
            </div>
          </div>

          {/* Card 3: Keaktifan Belajar (XP) */}
          <div className="border border-gray-200 rounded-xl p-3.5 bg-white shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="w-full h-1 bg-sky-500 absolute top-0 left-0" />
            <div>
              <h3 className="font-bold text-xs text-gray-900 mb-1.5 text-center">
                Tingkat Keaktifan Belajar (XP)
              </h3>
              <div className="flex justify-center my-1">
                <span className={`text-xs font-black px-4 py-1 rounded-full ${xpStatus.bg} ${xpStatus.text}`}>
                  ⚡ {report.totalXpEarned} XP
                </span>
              </div>
              <p className="text-[11px] text-sky-700 font-bold text-center mt-1">
                Akumulasi Poin Keaktifan
              </p>
              <p className="text-[11px] text-gray-600 leading-relaxed mt-2">
                <strong>Capaian:</strong> Berinteraksi aktif dalam menyelesaikan alur bacaan modul, menyimak video, dan mengerjakan tugas.
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[9px] font-black text-sky-800">
              <span>PENINGKATAN AKTIF</span>
              <span>⚡ TINGGI</span>
            </div>
          </div>

          {/* Card 4: Apresiasi Prestasi (Bintang) */}
          <div className="border border-gray-200 rounded-xl p-3.5 bg-white shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="w-full h-1 bg-amber-500 absolute top-0 left-0" />
            <div>
              <h3 className="font-bold text-xs text-gray-900 mb-1.5 text-center">
                Apresiasi Prestasi (Bintang)
              </h3>
              <div className="flex justify-center my-1">
                <span className={`text-xs font-black px-4 py-1 rounded-full ${starStatus.bg} ${starStatus.text}`}>
                  ⭐ {report.totalStarsEarned} Bintang
                </span>
              </div>
              <p className="text-[11px] text-amber-700 font-bold text-center mt-1">
                Prestasi Ketuntasan Bab
              </p>
              <p className="text-[11px] text-gray-600 leading-relaxed mt-2">
                <strong>Capaian:</strong> Mengumpulkan milestone keaktifan belajar hingga berhasil membuka bintang apresiasi bab.
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[9px] font-black text-amber-800">
              <span>PENGHARGAAN</span>
              <span>🌟 PRESTASI</span>
            </div>
          </div>

          {/* Card 5: Kedisiplinan & Waktu */}
          <div className="border border-gray-200 rounded-xl p-3.5 bg-white shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="w-full h-1 bg-teal-500 absolute top-0 left-0" />
            <div>
              <h3 className="font-bold text-xs text-gray-900 mb-1.5 text-center">
                Kedisiplinan &amp; Manajemen Waktu
              </h3>
              <div className="flex justify-center my-1">
                <span className="text-xs font-black px-4 py-1 rounded-full bg-teal-600 text-white">
                  Tepat Waktu
                </span>
              </div>
              <p className="text-[11px] text-teal-700 font-bold text-center mt-1">
                Kepatuhan Alur Sekuensial
              </p>
              <p className="text-[11px] text-gray-600 leading-relaxed mt-2">
                <strong>Capaian:</strong> Menyelesaikan tahapan belajar secara tertib dan mandiri sebelum batas akhir rentang waktu bab.
              </p>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[9px] font-black text-teal-800">
              <span>MANAJEMEN WAKTU</span>
              <span>⏱ DISIPLIN</span>
            </div>
          </div>

          {/* Card 6: Ringkasan Nilai Asesmen Terpasang */}
          <div className="border border-gray-200 rounded-xl p-3.5 bg-white shadow-xs flex flex-col justify-between relative overflow-hidden">
            <div className="w-full h-1 bg-indigo-500 absolute top-0 left-0" />
            <div>
              <h3 className="font-bold text-xs text-gray-900 mb-1.5 text-center">
                Daftar Nilai Asesmen BAB
              </h3>
              <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                {report.assessments.length === 0 ? (
                  <p className="text-[11px] text-gray-400 italic text-center py-2">
                    Belum ada butir asesmen tersimpan.
                  </p>
                ) : (
                  report.assessments.map((a, i) => (
                    <div
                      key={a.chapterId}
                      className="flex items-center justify-between p-1.5 bg-slate-50 border border-slate-200 rounded text-[11px]"
                    >
                      <span className="truncate max-w-[130px] font-medium text-gray-800" title={a.title}>
                        #{i + 1} {a.title}
                      </span>
                      <span className="font-black text-blue-700 shrink-0">
                        {a.score !== undefined ? a.score : '-'} Poin
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[9px] font-black text-indigo-800">
              <span>NILAI BAB</span>
              <span>📊 RATA-RATA: {avgScore}</span>
            </div>
          </div>
        </div>

        {/* ── BANNER AJAKAN KOLABORASI (Seperti Kemendikdasmen Asli) ── */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white rounded-xl p-3.5 text-center shadow-sm mb-3">
          <h4 className="font-black text-sm tracking-wide mb-0.5">
            Bagaimana pendapat Anda tentang hasil ini? Ayo, terus berikan apresiasi &amp; semangat belajar!
          </h4>
          <p className="text-[11px] text-blue-100 font-medium">
            Setiap proses belajar adalah kemajuan berharga. Dampingi dan dukung ananda untuk meraih capaian gemilang di bab berikutnya!
          </p>
        </div>

        {/* ── FOOTER RESMI DOKUMEN ── */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium border-t border-gray-200 pt-2">
          <span>{formattedDate} · Guru Pengampu: <strong>{report.teacherName}</strong></span>
          <span className="font-mono">rapor-pendidikan.smalledu.id</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
