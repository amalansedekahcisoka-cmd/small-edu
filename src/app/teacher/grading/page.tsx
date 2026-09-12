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
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null);
  const [teacherScore, setTeacherScore] = useState<number>(85);
  const [feedback, setFeedback] = useState<string>('Jawaban sangat baik dan kata kunci esensial lengkap.');
  const [user, setUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const loadSubmissions = async () => {
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
    if (filtered.length > 0 && (!selectedSub || !filtered.some((s) => s.id === selectedSub.id))) {
      setSelectedSub(filtered[0]);
      setTeacherScore(filtered[0].finalScore || 85);
    } else if (filtered.length === 0) {
      setSelectedSub(null);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const handleSelectSubmission = (sub: Submission) => {
    setSelectedSub(sub);
    setTeacherScore(sub.finalScore || 85);
    setFeedback(sub.teacherFeedback || 'Jawaban relevan dan memenuhi indikator penilaian.');
  };

  const handleApprove = () => {
    if (!selectedSub || !user) return;

    const updated = DataProvider.approveSubmission(
      selectedSub.id,
      Number(teacherScore),
      feedback,
      user.name
    );

    if (updated) {
      confetti({ particleCount: 70, spread: 60 });
      const isPassed = Number(teacherScore) >= 75;
      const isRemedial = selectedSub.attemptNumber === 2;
      setNotification(
        isPassed
          ? `Nilai untuk ${selectedSub.studentName} berhasil disahkan (${teacherScore}/100 - LULUS)! Bab berikutnya untuk siswa ini telah terbuka.`
          : isRemedial
          ? `Nilai remedial ${selectedSub.studentName} (${teacherScore}/100) disahkan. Batas kesempatan ujian (2/2) selesai.`
          : `Nilai ${selectedSub.studentName} (${teacherScore}/100) disahkan. Siswa diberikan 1x kesempatan ujian remedial.`
      );
      loadSubmissions();
      setSelectedSub(updated);

      setTimeout(() => setNotification(null), 6000);
    }
  };

  if (isAuthLoading || !isAuthorized || !user) {
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
        {/* Left Column: Submissions Queue */}
        <div className="space-y-4">
          <RetroWindow
            title="ANTREAN JAWABAN SISWA"
            headerColor="gray"
            icon={<ClipboardCheck className="w-4 h-4" />}
          >
            <div className="space-y-3">
              {submissions.map((sub) => {
                const isSelected = selectedSub?.id === sub.id;
                const isPending = sub.status === 'pending';
                const isRemedial = sub.attemptNumber === 2;
                return (
                  <div
                    key={sub.id}
                    onClick={() => handleSelectSubmission(sub)}
                    className={`p-3 neo-border-sm cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#ffde59] neo-shadow-sm'
                        : 'bg-white hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{sub.studentName}</span>
                      <div className="flex items-center gap-1">
                        {isRemedial && (
                          <span className="px-1.5 py-0.5 bg-purple-200 text-purple-950 font-mono text-[10px] font-bold border border-black">
                            REMEDIAL
                          </span>
                        )}
                        <RetroBadge variant={isPending ? 'yellow' : 'green'} size="sm">
                          {isPending ? 'MENUNGGU' : 'TERVERIFIKASI'}
                        </RetroBadge>
                      </div>
                    </div>
                    <div className="text-xs font-mono text-zinc-600 mt-1">
                      Skor Rekomendasi: <strong>{sub.autoScore} / 100</strong>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 mt-0.5 flex items-center justify-between">
                      <span>Sesi: {isRemedial ? 'Percobaan 2 (Remedial)' : 'Percobaan 1 (Reguler)'}</span>
                      <span>{new Date(sub.submittedAt).toLocaleTimeString('id-ID')}</span>
                    </div>
                  </div>
                );
              })}

              {submissions.length === 0 && (
                <div className="text-center p-6 text-xs font-mono text-zinc-500">
                  Belum ada jawaban siswa yang dikirimkan.
                </div>
              )}
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
                        <span className="text-purple-800 font-black">🔴 UJIAN REMEDIAL (PERCOBAAN 2/2)</span>
                      ) : (
                        <span className="text-blue-900 font-black">🔵 PERCOBAAN 1 (REGULER)</span>
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

                  <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-mono text-zinc-600 max-w-lg leading-relaxed">
                      💡 Nilai &ge; 75 otomatis meluluskan siswa dan membuka Bab berikutnya.
                      {selectedSub.attemptNumber === 2
                        ? ' Karena ini Ujian Remedial (Percobaan 2/2), nilai ini akan menjadi nilai akhir permanen.'
                        : ' Jika nilai < 75, siswa akan otomatis diberikan 1 kali kesempatan ujian remedial.'}
                    </span>

                    <RetroButton
                      variant="yellow"
                      onClick={handleApprove}
                      icon={<CheckCircle2 className="w-4 h-4 text-emerald-800" />}
                    >
                      Sahkan & Setujui Nilai Siswa
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
