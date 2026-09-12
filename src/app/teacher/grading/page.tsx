'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DataProvider } from '@/lib/data/dataProvider';
import { getHighlightedHtml } from '@/lib/engine/keywordMatcher';
import { Submission, User } from '@/types';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { RetroBadge } from '@/components/ui/RetroBadge';
import {
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  Search,
  Check,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function TeacherGradingPage() {
  const { user: authUser, isAuthorized, isLoading: isAuthLoading } = useAuthGuard({
    allowedRoles: ['teacher', 'admin'],
  });
  const [mounted, setMounted] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [teacherScore, setTeacherScore] = useState<number>(85);
  const [feedback, setFeedback] = useState<string>('Jawaban sangat baik dan kata kunci esensial lengkap.');
  const [user, setUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'graded' | 'all'>('pending');
  const [giveTeacherGrace, setGiveTeacherGrace] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadSubmissions = async (preferredStatus?: 'pending' | 'graded' | 'all') => {
    const activeFilter = preferredStatus || statusFilter;
    const currentUser = DataProvider.getCurrentUser();
    setUser(currentUser);
    const [all, allCourses] = await Promise.all([
      DataProvider.getSubmissionsAsync(),
      DataProvider.getCoursesAsync(),
    ]);

    let filtered = all;
    if (currentUser?.role === 'teacher') {
      const myCourseIds = new Set(
        allCourses.filter((c) => c.teacherId === currentUser.id).map((c) => c.id)
      );
      filtered = all.filter((s) => myCourseIds.has(s.courseId));
    }

    setSubmissions(filtered);

    // List yang tampil sesuai filter
    const visibleSubs = activeFilter === 'all'
      ? filtered
      : filtered.filter((s) => s.status === activeFilter);

    if (visibleSubs.length > 0 && (!selectedSub || !visibleSubs.some((s) => s.id === selectedSub.id))) {
      setSelectedSub(visibleSubs[0]);
      setTeacherScore(visibleSubs[0].finalScore || visibleSubs[0].autoScore || 85);
      setFeedback(visibleSubs[0].teacherFeedback || 'Jawaban relevan dan memenuhi indikator penilaian.');
      setGiveTeacherGrace(visibleSubs[0].teacherGrace || false);
    } else if (visibleSubs.length === 0) {
      setSelectedSub(null);
      setGiveTeacherGrace(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const handleSelectSubmission = (sub: Submission) => {
    setSelectedSub(sub);
    setTeacherScore(sub.finalScore || 85);
    setFeedback(sub.teacherFeedback || 'Jawaban relevan dan memenuhi indikator penilaian.');
    setGiveTeacherGrace(sub.teacherGrace || false);
  };

  const handleApprove = async () => {
    if (!selectedSub || !user) return;

    const isScorePassed = Number(teacherScore) >= 75;
    const effectiveGrace = !isScorePassed && giveTeacherGrace;

    const updated = await DataProvider.approveSubmissionAsync(
      selectedSub.id,
      Number(teacherScore),
      feedback,
      user.name,
      selectedSub,
      effectiveGrace
    );

    if (updated) {
      confetti({ particleCount: 70, spread: 60 });
      const isRemedial = selectedSub.attemptNumber === 2;
      setNotification(
        isScorePassed
          ? `Nilai untuk ${selectedSub.studentName} berhasil disahkan (${teacherScore}/100 - TUNTAS MURNI + BONUS XP)! Bab berikutnya untuk siswa ini telah terbuka.`
          : effectiveGrace
          ? `Kebijaksanaan Guru diberikan untuk ${selectedSub.studentName} (${teacherScore}/100 - TUNTAS). Bab berikutnya telah terbuka tanpa bonus XP.`
          : isRemedial
          ? `Nilai remedial ${selectedSub.studentName} (${teacherScore}/100) disahkan. Batas kesempatan ujian (2/2) selesai. Bab berikutnya telah terbuka.`
          : `Nilai ${selectedSub.studentName} (${teacherScore}/100) disahkan. Siswa diberikan 1x kesempatan ujian remedial, dan bab berikutnya telah terbuka.`
      );
      await loadSubmissions();
      setSelectedSub(updated);

      setTimeout(() => setNotification(null), 6000);
    }
  };

  if (!mounted || isAuthLoading || !isAuthorized || !user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center font-mono text-sm font-bold text-zinc-600 gap-2">
        <div className="w-8 h-8 border-4 border-[#008080] border-t-transparent animate-spin"></div>
        <span>Memverifikasi sesi guru...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <RetroButton href="/teacher" variant="white" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
          Kembali ke Dashboard Guru
        </RetroButton>
        <span className="text-xs font-mono font-bold bg-[#ffde59] px-2 py-1 neo-border-sm">
          SISTEM KOREKSI ESSAY BERBANTUAN KATA KUNCI (MODE B)
        </span>
      </div>

      {notification && (
        <div className="p-4 bg-[#79f2c0] neo-border neo-shadow-sm font-mono text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-950" />
          <span>{notification}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Submissions Queue Grouped by Student & Chapter */}
        <div className="space-y-4">
          <RetroWindow
            title="ANTREAN JAWABAN SISWA"
            headerColor="gray"
            icon={<ClipboardCheck className="w-4 h-4" />}
          >
            {/* Filter Tabs Status */}
            <div className="flex border-b-2 border-black bg-zinc-100 p-1 gap-1 font-mono text-xs">
              <button
                onClick={() => {
                  setStatusFilter('pending');
                  const pendingSubs = submissions.filter((s) => s.status === 'pending');
                  if (pendingSubs.length > 0) {
                    handleSelectSubmission(pendingSubs[0]);
                  } else {
                    setSelectedSub(null);
                  }
                }}
                className={`flex-1 py-1.5 px-2 font-bold text-center neo-border-sm transition-all flex items-center justify-center gap-1.5 ${
                  statusFilter === 'pending'
                    ? 'bg-[#ffde59] text-black neo-shadow-xs'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <span>🟡 Menunggu</span>
                <span className="px-1.5 py-0.2 bg-black text-white text-[10px] rounded-full">
                  {submissions.filter((s) => s.status === 'pending').length}
                </span>
              </button>

              <button
                onClick={() => {
                  setStatusFilter('graded');
                  const gradedSubs = submissions.filter((s) => s.status === 'graded');
                  if (gradedSubs.length > 0) {
                    handleSelectSubmission(gradedSubs[0]);
                  } else {
                    setSelectedSub(null);
                  }
                }}
                className={`flex-1 py-1.5 px-2 font-bold text-center neo-border-sm transition-all flex items-center justify-center gap-1.5 ${
                  statusFilter === 'graded'
                    ? 'bg-[#79f2c0] text-[#0d4a2b] neo-shadow-xs'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <span>🟢 Disahkan</span>
                <span className="px-1.5 py-0.2 bg-[#008080] text-white text-[10px] rounded-full">
                  {submissions.filter((s) => s.status === 'graded').length}
                </span>
              </button>

              <button
                onClick={() => {
                  setStatusFilter('all');
                  if (submissions.length > 0) {
                    handleSelectSubmission(submissions[0]);
                  }
                }}
                className={`py-1.5 px-2.5 font-bold text-center neo-border-sm transition-all ${
                  statusFilter === 'all'
                    ? 'bg-black text-white'
                    : 'bg-white text-zinc-600 hover:bg-zinc-50'
                }`}
                title="Tampilkan Semua"
              >
                Semua ({submissions.length})
              </button>
            </div>

            <div className="space-y-3 pt-3">
              {(() => {
                const displayedSubs = statusFilter === 'all'
                  ? submissions
                  : submissions.filter((s) => s.status === statusFilter);

                if (displayedSubs.length === 0) {
                  return (
                    <div className="text-center p-8 bg-zinc-50 neo-border-sm text-xs font-mono space-y-2 text-zinc-600">
                      <div className="text-2xl">
                        {statusFilter === 'pending' ? '🎉' : '📂'}
                      </div>
                      <p className="font-bold text-black">
                        {statusFilter === 'pending'
                          ? 'Tidak Ada Antrean Menunggu!'
                          : 'Belum Ada Jawaban yang Disahkan'}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {statusFilter === 'pending'
                          ? 'Semua lembar ujian siswa telah selesai diperiksa dan disahkan nilainya.'
                          : 'Klik tab "Menunggu" untuk mengoreksi jawaban siswa.'}
                      </p>
                    </div>
                  );
                }

                return displayedSubs.map((sub) => {
                  const isSelected = selectedSub?.id === sub.id;
                  const isPending = sub.status === 'pending';
                  const isRemedial = sub.attemptNumber === 2;
                  const passingGrade = 75; // Standar target
                  const isPassed = (sub.finalScore || sub.autoScore) >= passingGrade;

                  return (
                    <div
                      key={sub.id}
                      onClick={() => handleSelectSubmission(sub)}
                      className={`p-3 neo-border-sm cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#ffde59] neo-shadow-sm ring-2 ring-black'
                          : 'bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-black">{sub.studentName}</span>
                        <div className="flex items-center gap-1">
                          {isRemedial ? (
                            <span className="px-1.5 py-0.5 bg-purple-200 text-purple-950 font-mono text-[10px] font-black border border-purple-800">
                              PERCOBAAN 2 (REMEDIAL)
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-950 font-mono text-[10px] font-black border border-blue-800">
                              PERCOBAAN 1 (UTAMA)
                            </span>
                          )}
                          <RetroBadge variant={isPending ? 'yellow' : 'green'} size="sm">
                            {isPending ? 'MENUNGGU' : 'DISAHKAN'}
                          </RetroBadge>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-zinc-200">
                        <div className="text-xs font-mono">
                          Skor: <strong className={isPassed ? 'text-emerald-700' : 'text-red-600'}>{sub.finalScore ?? sub.autoScore} / 100</strong>
                        </div>
                        <div className="text-[10px] font-mono font-bold">
                          {isPassed ? (
                            <span className="text-emerald-800 bg-emerald-100 px-1.5 py-0.5 border border-emerald-400">
                              ✓ TUNTAS
                            </span>
                          ) : isRemedial ? (
                            <span className="text-purple-900 bg-purple-100 px-1.5 py-0.5 border border-purple-400">
                              SELESAI (FINAL)
                            </span>
                          ) : (
                            <span className="text-amber-800 bg-amber-100 px-1.5 py-0.5 border border-amber-400">
                              REMEDIAL TERSEDIA
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Catatan pintar jika percobaan 1 sudah tuntas */}
                      {!isRemedial && isPassed && (
                        <div className="mt-1.5 text-[9px] font-mono text-emerald-800 bg-emerald-50 px-2 py-1 border border-emerald-300 flex items-center gap-1">
                          <span>🔒</span>
                          <span>Percobaan 1 Tuntas: Percobaan 2 otomatis terkunci.</span>
                        </div>
                      )}

                      <div className="text-[10px] font-mono text-zinc-500 mt-1 flex items-center justify-between">
                        <span>Waktu: {new Date(sub.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>{new Date(sub.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </RetroWindow>
        </div>

        {/* Right 2 Columns: Active Submission Review with Keyword Highlighting */}
        <div className="lg:col-span-2 space-y-4">
          {selectedSub ? (
            <RetroWindow
              title={`LEMBAR KOREKSI: ${selectedSub.studentName.toUpperCase()}`}
              headerColor="navy"
              icon={<Sparkles className="w-4 h-4 text-yellow-300" />}
            >
              <div className="space-y-6">
                {/* Meta Header */}
                <div className="bg-[#fffde6] neo-border-sm p-4 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                  <div>
                    <div className="text-zinc-600">NAMA SISWA:</div>
                    <div className="font-bold text-sm text-black">{selectedSub.studentName}</div>
                  </div>
                  <div>
                    <div className="text-zinc-600">SESI / KESEMPATAN:</div>
                    <div className="font-bold text-xs">
                      {selectedSub.attemptNumber === 2 ? (
                        <span className="text-purple-900 bg-purple-100 px-2 py-0.5 border border-purple-600 font-black">
                          🔴 UJIAN REMEDIAL (PERCOBAAN 2/2)
                        </span>
                      ) : (
                        <span className="text-blue-900 bg-blue-100 px-2 py-0.5 border border-blue-600 font-black">
                          🔵 PERCOBAAN 1 (UTAMA)
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-600">STATUS KOREKSI:</div>
                    <RetroBadge variant={selectedSub.status === 'pending' ? 'yellow' : 'green'}>
                      {selectedSub.status === 'pending'
                        ? 'MENUNGGU PENGESAHAN GURU'
                        : 'SUDAH DISAHKAN'}
                    </RetroBadge>
                  </div>
                  <div>
                    <div className="text-zinc-600">ESTIMASI KATA KUNCI:</div>
                    <div className="font-black text-sm text-emerald-800">
                      {selectedSub.autoScore} Poin
                    </div>
                  </div>
                </div>

                {/* Status Percobaan 1 vs 2 Alert */}
                {(() => {
                  const siblingSubs = submissions.filter(
                    (s) => s.studentId === selectedSub.studentId && s.chapterId === selectedSub.chapterId
                  );
                  const attempt1 = siblingSubs.find((s) => (s.attemptNumber || 1) === 1);
                  const attempt2 = siblingSubs.find((s) => s.attemptNumber === 2);
                  const passingGrade = 75;
                  const isAttempt1Passed = attempt1 && ((attempt1.finalScore || attempt1.autoScore) >= passingGrade);

                  if ((selectedSub.attemptNumber || 1) === 1 && isAttempt1Passed) {
                    return (
                      <div className="p-3 bg-[#eefaf3] border-2 border-emerald-600 text-xs font-mono text-emerald-950 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                          <div>
                            <strong>SISWA TUNTAS PADA PERCOBAAN 1 (Skor: {attempt1?.finalScore || attempt1?.autoScore}/100).</strong>
                            <p className="text-[11px] text-emerald-800 mt-0.5">
                              Sesuai aturan sistem, Ujian Remedial (Percobaan 2) <strong>OTOMATIS TERKUNCI</strong> dan siswa langsung berhak mempelajari materi selanjutnya.
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-emerald-700 text-white font-bold text-[10px] shrink-0 border border-black">
                          REMEDIAL TIDAK DIPERLUKAN
                        </span>
                      </div>
                    );
                  }

                  if (selectedSub.attemptNumber === 2 && attempt1) {
                    return (
                      <div className="p-3 bg-[#faf5ff] border-2 border-purple-600 text-xs font-mono text-purple-950 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-purple-700 shrink-0" />
                          <div>
                            <strong>PENINJAUAN HASIL REMEDIAL (PERCOBAAN KE-2).</strong>
                            <p className="text-[11px] text-purple-900 mt-0.5">
                              Skor Percobaan 1 Sebelumnya: <strong>{attempt1.finalScore || attempt1.autoScore} / 100 (Belum Tuntas)</strong>.
                              Ini adalah kesempatan terakhir siswa.
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-1 bg-purple-700 text-white font-bold text-[10px] shrink-0 border border-black">
                          KESEMPATAN 2 DARI 2
                        </span>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* Mode B Analysis Cards */}
                {selectedSub.modeBAnalysis && selectedSub.modeBAnalysis.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="font-black text-base border-b-2 border-black pb-1">
                      🔍 Pemeriksaan Otomatis Kata Kunci Jawaban Essay:
                    </h3>

                    {selectedSub.modeBAnalysis.map((analysis, idx) => {
                      const highlightedHtml = getHighlightedHtml(
                        analysis.studentText,
                        analysis.matchedKeywords
                      );

                      return (
                        <div key={idx} className="bg-white neo-border p-4 space-y-3">
                          <div className="font-bold text-sm font-sans text-black">
                            {analysis.questionPrompt}
                          </div>

                          {/* Student Answer with Live Green Highlight for Matched Keywords */}
                          <div className="space-y-1">
                            <span className="text-xs font-mono font-bold text-zinc-600">
                              Jawaban Siswa (Kata Kunci Terdeteksi Berwarna Hijau):
                            </span>
                            <div
                              className="p-3 bg-[#fcfaf5] neo-border-sm text-sm font-sans leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                            />
                          </div>

                          {/* Keywords Match Matrix */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs font-mono">
                            <div className="p-2.5 bg-[#eefaf3] border border-emerald-500 space-y-1">
                              <span className="font-bold text-emerald-900 flex items-center gap-1">
                                <Check className="w-4 h-4 text-emerald-700" />
                                Kata Kunci Ditemukan ({analysis.matchedKeywords.length}):
                              </span>
                              <div className="flex flex-wrap gap-1 pt-1">
                                {analysis.matchedKeywords.map((kw, kIdx) => (
                                  <span
                                    key={kIdx}
                                    className="bg-emerald-200 text-emerald-950 px-1.5 py-0.5 border border-emerald-400 font-bold"
                                  >
                                    {kw}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="p-2.5 bg-[#fff1f0] border border-red-300 space-y-1">
                              <span className="font-bold text-red-900 flex items-center gap-1">
                                <X className="w-4 h-4 text-red-700" />
                                Kata Kunci Belum Terjawab ({analysis.unmatchedKeywords.length}):
                              </span>
                              <div className="flex flex-wrap gap-1 pt-1">
                                {analysis.unmatchedKeywords.length > 0 ? (
                                  analysis.unmatchedKeywords.map((kw, kIdx) => (
                                    <span
                                      key={kIdx}
                                      className="bg-red-100 text-red-900 px-1.5 py-0.5 border border-red-300"
                                    >
                                      {kw}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-zinc-500 italic">Lengkap semua!</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right text-xs font-mono font-bold text-zinc-700">
                            Saran Nilai Soal Ini: {analysis.suggestedScore} / {analysis.maxScore} Poin
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white neo-border p-4 space-y-2">
                    <div className="font-bold text-sm">Berkas Jawaban Tugas Praktik:</div>
                    <div className="p-3 bg-[#f7f4ec] font-mono text-xs break-all neo-border-sm">
                      {selectedSub.answers?.submissionTextOrUrl || 'Tidak ada URL/berkas'}
                    </div>
                  </div>
                )}

                {/* Final Decision Form */}
                <div className="bg-[#f7f4ec] neo-border p-4 space-y-4">
                  <h4 className="font-black text-sm">Pengesahan Nilai Akhir oleh Guru:</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono font-bold mb-1">
                        Nilai Akhir Siswa (0 - 100):
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={teacherScore}
                        onChange={(e) => setTeacherScore(Number(e.target.value))}
                        className="w-full p-2 neo-border-sm font-mono font-black text-lg bg-white"
                      />
                      <span className="text-[11px] font-mono text-zinc-600">
                        Target Capaian Pembelajaran: 75
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-mono font-bold mb-1">
                        Catatan & Umpan Balik Guru:
                      </label>
                      <textarea
                        rows={2}
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        className="w-full p-2 neo-border-sm text-xs bg-white"
                      />
                    </div>
                  </div>

                  {/* OPSI KEBIJAKSANAAN GURU: Tampil jika skor siswa < 75 */}
                  {Number(teacherScore) < 75 && (
                    <div className="p-3 bg-[#eefaf3] border-2 border-emerald-600 neo-border-sm space-y-2">
                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={giveTeacherGrace}
                          onChange={(e) => setGiveTeacherGrace(e.target.checked)}
                          className="mt-0.5 w-4 h-4 text-emerald-600 border-black rounded-none focus:ring-0 cursor-pointer"
                        />
                        <div className="font-mono text-xs">
                          <span className="font-black text-emerald-950 flex items-center gap-1.5">
                            <span>🤝</span>
                            <span>Beri Kebijaksanaan Guru (Luluskan Bab Tanpa Bonus XP)</span>
                          </span>
                          <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                            Centang opsi ini jika Anda ingin meluluskan siswa ini pada bab ini berdasarkan pertimbangan keaktifan.
                            Siswa akan dinyatakan <strong>Tuntas Belajar</strong> dan Bab berikutnya otomatis terbuka tanpa perlu remedial, namun <strong>Bonus XP (30 XP) tidak akan diberikan</strong> (0 XP).
                          </p>
                        </div>
                      </label>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-mono text-zinc-600 max-w-lg leading-relaxed">
                      {Number(teacherScore) >= 75 ? (
                        <span className="text-emerald-800 font-bold">
                          ✓ Nilai memenuhi target ketuntasan belajar (&ge; 75). Siswa lulus murni dan berhak mendapatkan bonus XP.
                        </span>
                      ) : giveTeacherGrace ? (
                        <span className="text-teal-900 font-bold">
                          🤝 Kebijaksanaan Guru Aktif: Siswa dinyatakan tuntas kurikulum, remedial dikunci, dan tidak ada bonus XP.
                        </span>
                      ) : selectedSub.attemptNumber === 2 ? (
                        <span>
                          ⚠️ Karena ini Ujian Remedial (Percobaan 2/2), nilai ini akan menjadi nilai akhir permanen di rapor.
                        </span>
                      ) : (
                        <span>
                          💡 Nilai &lt; 75: Siswa otomatis diberikan 1 kali kesempatan ujian remedial.
                        </span>
                      )}
                    </span>

                    <RetroButton
                      variant={giveTeacherGrace ? 'teal' : 'yellow'}
                      onClick={handleApprove}
                      icon={<CheckCircle2 className="w-4 h-4 text-emerald-800" />}
                    >
                      {giveTeacherGrace
                        ? 'Sahkan Tuntas (Kebijaksanaan Guru)'
                        : 'Sahkan & Setujui Nilai Siswa'}
                    </RetroButton>
                  </div>
                </div>
              </div>
            </RetroWindow>
          ) : (
            <div className="text-center p-12 neo-border bg-white font-mono text-sm text-zinc-500">
              Pilih salah satu lembar jawaban siswa di sebelah kiri untuk mulai mengoreksi.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
