'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Chapter, Question, Submission, UserCourseProgress, getP5ProgressInfo } from '@/types';
import { gradeQuizSubmission } from '@/lib/engine/quizGrader';
import { DataProvider } from '@/lib/data/dataProvider';
import { RetroWindow } from '../ui/RetroWindow';
import { RetroButton } from '../ui/RetroButton';
import { RetroBadge } from '../ui/RetroBadge';
import {
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  RotateCcw,
  Send,
  FileCheck2,
} from 'lucide-react';

interface ExamRunnerProps {
  chapter: Chapter;
  courseId: string;
  userId: string;
  userName: string;
  onComplete: () => void;
}

export const ExamRunner: React.FC<ExamRunnerProps> = ({
  chapter,
  courseId,
  userId,
  userName,
  onComplete,
}) => {
  const questions = chapter.questions || [];
  const durationSec = (chapter.durationMinutes || 20) * 60;
  const storageKeyTimer = `smalledu_timer_${userId}_${chapter.id}`;

  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(durationSec);
  const [isExamStarted, setIsExamStarted] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submissionResult, setSubmissionResult] = useState<Submission | null>(null);
  const [attemptNumber, setAttemptNumber] = useState<number>(1);

  // Cek ketersediaan rentang hari
  const now = new Date();
  const startDate = chapter.schedule?.startDate ? new Date(chapter.schedule.startDate) : null;
  const endDate = chapter.schedule?.endDate ? new Date(chapter.schedule.endDate) : null;

  const isBeforeSchedule = startDate ? now < startDate : false;
  const isAfterSchedule = endDate ? now > endDate : false;

  // Sinkronisasi progres dan riwayat submission (Lokal & Firestore)
  const syncExamState = async () => {
    // 1. Cek data lokal terlebih dahulu untuk respon instan
    const localSubs = DataProvider.getSubmissions()
      .filter((s) => s.chapterId === chapter.id && s.studentId === userId)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    if (localSubs.length > 0) {
      const latest = localSubs[0];
      setSubmissionResult(latest);
      setIsSubmitted(true);
      setAttemptNumber(latest.attemptNumber || localSubs.length);
    }

    // 2. Sinkronkan dengan Cloud Firestore untuk multi-device / multi-tab
    try {
      const [asyncProg, asyncSubs] = await Promise.all([
        DataProvider.getUserProgressAsync(userId, courseId),
        DataProvider.getSubmissionsAsync(),
      ]);

      const studentSubs = (asyncSubs || [])
        .filter((s) => s.chapterId === chapter.id && s.studentId === userId)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

      if (studentSubs.length > 0) {
        const latest = studentSubs[0];
        setSubmissionResult(latest);
        setIsSubmitted(true);
        setAttemptNumber(latest.attemptNumber || studentSubs.length);
      }
    } catch (err) {
      console.warn('Error syncing exam state with Firestore:', err);
    }
  };

  useEffect(() => {
    syncExamState();
  }, [chapter.id, courseId, userId]);

  // Load timer dari localStorage agar tahan refresh
  useEffect(() => {
    if (!isExamStarted) return;

    const savedStartTime = localStorage.getItem(storageKeyTimer);
    let startTime = Date.now();

    if (savedStartTime) {
      startTime = parseInt(savedStartTime, 10);
    } else {
      localStorage.setItem(storageKeyTimer, startTime.toString());
    }

    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
      const remaining = durationSec - elapsedSec;

      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
        handleSubmit(); // Auto-submit when time expires
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isExamStarted]);

  const handleStartExam = () => {
    setIsExamStarted(true);
    setAttemptNumber(1);
    localStorage.setItem(storageKeyTimer, Date.now().toString());
  };

  const handleStartRemedial = () => {
    setIsSubmitted(false);
    setIsExamStarted(true);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setAttemptNumber(2);
    setTimeLeft(durationSec);
    localStorage.setItem(storageKeyTimer, Date.now().toString());
  };

  const handleSelectSingleChoice = (qId: string, optId: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: optId }));
  };

  const handleToggleMCMA = (qId: string, optId: string) => {
    setAnswers((prev) => {
      const currentList: string[] = prev[qId] || [];
      const exists = currentList.includes(optId);
      const updated = exists ? currentList.filter((id) => id !== optId) : [...currentList, optId];
      return { ...prev, [qId]: updated };
    });
  };

  const handleSetMatrixValue = (qId: string, rowId: string, category: string) => {
    setAnswers((prev) => {
      const currentMap = prev[qId] || {};
      return {
        ...prev,
        [qId]: { ...currentMap, [rowId]: category },
      };
    });
  };

  const handleSetTextAnswer = (qId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: text }));
  };

  const handleSubmit = () => {
    const grading = gradeQuizSubmission(questions, answers);
    const passingScore = chapter.passing_grade ?? 75;
    const isPassed = grading.finalPercentage >= passingScore;
    const currentAttempt = attemptNumber;
    const maxAttempts = 2;
    const remedialAllowed = !isPassed && currentAttempt < maxAttempts;

    // Simpan submission dengan nomor percobaan (Attempt Number)
    const newSub = DataProvider.saveSubmission({
      courseId,
      chapterId: chapter.id,
      studentId: userId,
      studentName: userName,
      answers,
      autoScore: grading.finalPercentage,
      finalScore: grading.finalPercentage,
      status: grading.hasLongEssayPending ? 'pending' : 'graded',
      modeBAnalysis: grading.modeBAnalyses,
      attemptNumber: currentAttempt,
    });

    localStorage.removeItem(storageKeyTimer);
    setIsSubmitted(true);
    setSubmissionResult(newSub);

    if (grading.hasLongEssayPending) {
      // Bab menunggu koreksi guru
      DataProvider.updateChapterProgress(userId, courseId, chapter.id, {
        is_completed: false,
        score: grading.finalPercentage,
        status: 'waiting_grading',
        attemptCount: currentAttempt,
        maxAttempts,
        remedialAllowed: false,
      });
      DataProvider.logActivity(
        userId,
        userName,
        'student',
        currentAttempt === 2 ? 'SUBMIT_EXAM_REMEDIAL' : 'SUBMIT_EXAM_PENDING_GRADING',
        `Mengirim lembar ujian ${chapter.title} (${currentAttempt === 2 ? 'Remedial' : 'Percobaan 1'}). Menunggu verifikasi essay dari guru.`,
        courseId,
        chapter.id
      );
    } else {
      // Auto-graded completely
      const p5Status = getP5ProgressInfo(grading.finalPercentage);

      // Cek apakah bab ini sudah pernah selesai atau klaim XP sebelumnya
      const existingProg = DataProvider.getUserProgress(userId, courseId);
      const wasAlreadyCompleted =
        existingProg.chapters?.[chapter.id]?.is_completed ||
        existingProg.chapters?.[chapter.id]?.xpClaimed;

      DataProvider.updateChapterProgress(userId, courseId, chapter.id, {
        is_completed: isPassed,
        score: grading.finalPercentage,
        status: isPassed ? 'passed' : 'failed',
        attemptCount: currentAttempt,
        maxAttempts,
        remedialAllowed,
      });

      DataProvider.logActivity(
        userId,
        userName,
        'student',
        'UJIAN_SELESAI',
        `Menyelesaikan kuis/penilaian ${chapter.title} (${currentAttempt === 2 ? 'Remedial' : 'Percobaan 1'}) dengan skor ${grading.finalPercentage} (${isPassed ? 'Lulus' : 'Belum Lulus'} - ${p5Status.label}).`,
        courseId,
        chapter.id
      );

      // HANYA berikan XP jika LULUS dan BELUM pernah klaim XP sebelumnya!
      if (isPassed && !wasAlreadyCompleted) {
        // Cek apakah submit tepat waktu
        let isOnTime = true;
        if (chapter.schedule?.endDate) {
          const deadline = new Date(chapter.schedule.endDate);
          deadline.setHours(23, 59, 59, 999);
          isOnTime = new Date() <= deadline;
        }

        const starSettings = DataProvider.getCourseStarSettings(courseId);
        const basePoints = chapter.activityRewardPoints ?? starSettings.defaultQuizXp ?? 30;
        const bonusXp = starSettings.onTimeBonusXp ?? 15;
        const xpEarned = isOnTime ? basePoints + bonusXp : basePoints;
        const reasonTitle = isOnTime ? 'Asesmen & Ujian Tepat Waktu (Disiplin)' : 'Asesmen & Ujian Tuntas';
        const reasonDesc = isOnTime
          ? `Menyelesaikan ujian ${chapter.title} (Nilai: ${grading.finalPercentage}) sebelum batas waktu (+${bonusXp} XP Bonus)`
          : `Menyelesaikan ujian ${chapter.title} (Nilai: ${grading.finalPercentage})`;

        const result = DataProvider.addActivityPoints(
          userId,
          xpEarned,
          reasonTitle,
          reasonDesc,
          isOnTime ? 'ON_TIME' : 'ACADEMIC_EXCELLENCE',
          courseId,
          chapter.id
        );

        if (result.earnedNewStar || isPassed) {
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
        }
      } else if (isPassed) {
        confetti({ particleCount: 40, spread: 50 });
      }
    }

    onComplete();
  };

  // Format detik ke format mm:ss
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Tampilan 1: Belum Mulai / Jadwal Tidak Aktif
  if (!isExamStarted && !isSubmitted) {
    return (
      <RetroWindow
        title={`UJIAN / ASESMEN: ${chapter.title}`}
        headerColor="mustard"
        icon={<HelpCircle className="w-4 h-4" />}
      >
        <div className="space-y-6">
          <div className="bg-[#fffde6] neo-border-sm p-4 space-y-3">
            <h3 className="font-black text-lg">Peraturan & Ketentuan Pengerjaan</h3>
            <ul className="text-sm space-y-2 font-mono list-disc list-inside">
              <li>
                <strong>Target Capaian Pembelajaran (KKM):</strong> {chapter.passing_grade || 75} Poin.
              </li>
              <li>
                <strong>Batas Kesempatan Pengerjaan:</strong> Maksimal 2 Kali (1x Ujian Reguler + 1x Ujian Remedial jika nilai belum mencapai KKM).
              </li>
              <li>
                <strong>Batas Waktu Pengerjaan:</strong> {chapter.durationMinutes || 20} Menit.
                (Timer akan terus berjalan dan auto-submit saat habis).
              </li>
              <li>
                <strong>Tipe Soal:</strong> {questions.length} butir soal (Pilihan Ganda, MCMA, Tabel
                Benar/Salah, Essay Singkat & Uraian).
              </li>
              <li>
                <strong>Koreksi Essay Mode B:</strong> Soal essay uraian akan dianalisis kata
                kuncinya dan divalidasi oleh Guru sebelum Bab berikutnya dibuka.
              </li>
            </ul>

            {chapter.schedule && (chapter.schedule.startDate || chapter.schedule.endDate) && (
              <div className="border-t border-black pt-2 flex items-center gap-2 text-xs font-mono">
                <Calendar className="w-4 h-4 text-zinc-700" />
                <span>
                  Rentang Jadwal:{' '}
                  {chapter.schedule.startDate
                    ? new Date(chapter.schedule.startDate).toLocaleDateString('id-ID')
                    : 'Sekarang'}{' '}
                  s/d{' '}
                  {chapter.schedule.endDate
                    ? new Date(chapter.schedule.endDate).toLocaleDateString('id-ID')
                    : 'Seterusnya'}
                </span>
              </div>
            )}
          </div>

          {isBeforeSchedule ? (
            <div className="bg-[#ff7675] text-white p-3 neo-border-sm font-bold text-center">
              ⏳ Ujian ini belum dibuka. Silakan kembali saat jadwal pelaksanaan dimulai.
            </div>
          ) : isAfterSchedule ? (
            <div className="bg-[#ff7675] text-white p-3 neo-border-sm font-bold text-center">
              ❌ Batas rentang hari pelaksanaan ujian telah berakhir.
            </div>
          ) : (
            <div className="text-center pt-2">
              <RetroButton
                variant="teal"
                size="lg"
                onClick={handleStartExam}
                icon={<Clock className="w-5 h-5" />}
              >
                Mulai Kerjakan Ujian Sekarang ({chapter.durationMinutes || 20} Menit)
              </RetroButton>
            </div>
          )}
        </div>
      </RetroWindow>
    );
  }

  // Tampilan 2: Lembar Hasil Ujian (Menunggu Koreksi, Lulus KKM, Remedial, atau Kesempatan Habis)
  if (isSubmitted && submissionResult) {
    const isPending = submissionResult.status === 'pending';
    const passingScore = chapter.passing_grade ?? 75;
    const finalScore = submissionResult.finalScore ?? 0;
    const isPassed = finalScore >= passingScore;
    const currentAttempt = submissionResult.attemptNumber || attemptNumber || 1;
    const canRemedial = !isPassed && currentAttempt < 2;
    const p5 = getP5ProgressInfo(finalScore);

    return (
      <RetroWindow
        title={`LEMBAR HASIL: ${chapter.title}`}
        headerColor={isPending ? 'mustard' : isPassed ? 'teal' : canRemedial ? 'mustard' : 'gray'}
        icon={<FileCheck2 className="w-4 h-4" />}
      >
        <div className="space-y-6">
          {/* Status Utama */}
          <div
            className={`p-6 neo-border text-center space-y-3 ${
              isPending
                ? 'bg-[#fffde6]'
                : isPassed
                ? 'bg-[#ecfbf3]'
                : canRemedial
                ? 'bg-[#fff5f5]'
                : 'bg-[#f4f4f4]'
            }`}
          >
            <h2 className="text-xl font-black text-black">
              {isPending
                ? '📝 JAWABAN BERHASIL DIKIRIM (MENUNGGU VERIFIKASI GURU)'
                : isPassed
                ? '🎉 CAPAIAN PEMBELAJARAN TUNTAS (LULUS)'
                : canRemedial
                ? '⚠️ NILAI BELUM MENCAPAI KKM (KESEMPATAN REMEDIAL TERSEDIA)'
                : '❌ HASIL AKHIR: BELUM MENCAPAI KKM'}
            </h2>

            <div
              className={`text-5xl font-mono font-black py-2 ${
                isPassed ? 'text-emerald-700' : isPending ? 'text-blue-900' : 'text-red-600'
              }`}
            >
              SKOR: {finalScore} / 100
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap font-mono text-xs">
              <span className="px-3 py-1 bg-white neo-border-sm font-bold text-black">
                Target KKM: {passingScore} Poin
              </span>

              <span
                className={`px-3 py-1 neo-border-sm font-bold ${
                  currentAttempt === 2
                    ? 'bg-purple-200 text-purple-950'
                    : 'bg-blue-100 text-blue-950'
                }`}
              >
                {currentAttempt === 2 ? 'Percobaan 2 (Remedial)' : 'Percobaan 1 (Ujian Reguler)'}
              </span>

              {!isPending && (
                <span
                  className={`px-3 py-1 neo-border-sm font-black ${
                    isPassed
                      ? 'bg-emerald-300 text-emerald-950'
                      : 'bg-red-200 text-red-950'
                  }`}
                >
                  {isPassed ? 'LULUS KKM' : 'BELUM CAPAI KKM'}
                </span>
              )}
            </div>

            <p className="font-mono text-xs sm:text-sm max-w-xl mx-auto text-zinc-700 leading-relaxed pt-1">
              {isPending
                ? 'Soal essay uraian telah tersimpan dan dianalisis kata kuncinya oleh sistem. Menunggu konfirmasi dan pengesahan nilai akhir dari Guru Pengampu.'
                : isPassed
                ? p5.encouragement
                : canRemedial
                ? `Nilai Anda (${finalScore}) belum mencapai batas KKM (${passingScore}). Anda memiliki 1 kali kesempatan ujian remedial untuk memperbaiki nilai dan membuka bab selanjutnya.`
                : `Anda telah menggunakan seluruh kesempatan pengerjaan (2 dari 2 kali). Nilai ini telah terkunci permanen di sistem rapor.`}
            </p>
          </div>

          {/* Catatan & Evaluasi Guru (JIKA SUDAH DIKOREKSI GURU) */}
          {!isPending && submissionResult.teacherFeedback && (
            <div className="bg-[#fff9db] neo-border p-4 text-left space-y-2">
              <div className="font-mono font-bold text-xs text-amber-950 flex items-center gap-1.5">
                <span>💬 Catatan & Umpan Balik Guru ({submissionResult.gradedBy || 'Guru Pengampu'}):</span>
              </div>
              <div className="p-3 bg-white neo-border-sm text-sm font-sans italic text-zinc-900 leading-relaxed">
                "{submissionResult.teacherFeedback}"
              </div>
            </div>
          )}

          {/* KOTAK AKSI UJIAN REMEDIAL (JIKA BELUM LULUS & MASIH ADA KESEMPATAN) */}
          {!isPending && canRemedial && (
            <div className="bg-[#e6fffa] neo-border p-5 text-center space-y-3">
              <div className="inline-block px-3 py-1 bg-[#008080] text-white font-mono font-black text-xs neo-border-sm">
                KESEMPATAN TERAKHIR: 1x UJIAN REMEDIAL
              </div>
              <h3 className="font-black text-lg text-teal-950">
                Ambil Ujian Remedial Sekarang
              </h3>
              <p className="font-mono text-xs text-zinc-700 max-w-lg mx-auto leading-relaxed">
                Pelajari kembali materi dan catatan dari guru di atas. Klik tombol di bawah untuk memulai kesempatan ujian remedial ke-2 (terakhir).
              </p>
              <div className="pt-2">
                <RetroButton
                  variant="teal"
                  size="lg"
                  onClick={handleStartRemedial}
                  icon={<RotateCcw className="w-5 h-5" />}
                >
                  Mulai Ujian Remedial (Percobaan 2 / Terakhir)
                </RetroButton>
              </div>
            </div>
          )}

          {/* Rincian Analisis Kata Kunci (Mode B Preview untuk Siswa) */}
          {submissionResult.modeBAnalysis && submissionResult.modeBAnalysis.length > 0 && (
            <div className="bg-white neo-border p-4 space-y-3">
              <h4 className="font-bold text-sm border-b-2 border-black pb-1">
                🔍 Analisis Kata Kunci Jawaban Essay Kamu (Mode B):
              </h4>
              {submissionResult.modeBAnalysis.map((item, idx) => (
                <div key={idx} className="bg-[#f9f8f4] p-3 neo-border-sm text-xs font-mono space-y-2">
                  <div className="font-bold">{item.questionPrompt}</div>
                  <div className="p-2 bg-white border border-zinc-400 italic">
                    "{item.studentText}"
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold">Kata Kunci Ditemukan:</span>
                    {item.matchedKeywords.length > 0 ? (
                      item.matchedKeywords.map((kw, kIdx) => (
                        <span
                          key={kIdx}
                          className="bg-[#79f2c0] text-emerald-950 px-1.5 py-0.5 border border-black font-bold"
                        >
                          ✓ {kw}
                        </span>
                      ))
                    ) : (
                      <span className="text-red-600">Tidak ada kata kunci yang cocok</span>
                    )}
                  </div>
                  <div className="text-zinc-600">
                    Saran Skor Sistem: {item.suggestedScore} / {item.maxScore}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </RetroWindow>
    );
  }

  // Tampilan 3: Lembar Pengerjaan Soal (Exam In Progress)
  const currentQ = questions[currentQuestionIndex];

  return (
    <div className="space-y-4">
      {/* Floating Neobrutalism Sticky Countdown Timer */}
      <div className="sticky top-[80px] z-40 bg-[#008080] text-white neo-border neo-shadow-sm p-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 font-mono font-bold text-sm flex-wrap">
          <Clock className={`w-5 h-5 ${timeLeft < 300 ? 'text-red-300 animate-bounce' : 'text-white'}`} />
          <span>SISA WAKTU:</span>
          <span
            className={`px-2 py-0.5 border border-black font-black text-base ${
              timeLeft < 300 ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-black'
            }`}
          >
            {formatTime(timeLeft)}
          </span>
          {attemptNumber === 2 && (
            <span className="px-2 py-0.5 bg-yellow-300 text-black border border-black text-xs font-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
              🔴 REMEDIAL (PERCOBAAN 2/2)
            </span>
          )}
        </div>

        {/* Soal Navigator Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono font-bold hidden sm:inline">Peta Soal:</span>
          {questions.map((q, idx) => {
            const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
            const isCurrent = idx === currentQuestionIndex;
            return (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`w-7 h-7 font-mono font-bold text-xs neo-border-sm transition-all ${
                  isCurrent
                    ? 'bg-[#141414] text-white ring-2 ring-yellow-400'
                    : isAnswered
                    ? 'bg-[#79f2c0] text-black'
                    : 'bg-white text-black hover:bg-zinc-100'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Question Box */}
      <RetroWindow
        title={`SOAL NOMOR ${currentQuestionIndex + 1} DARI ${questions.length} (${currentQ.type})`}
        headerColor="navy"
        icon={<HelpCircle className="w-4 h-4 text-yellow-300" />}
      >
        <div className="space-y-6">
          {/* Question Prompt */}
          <div className="bg-[#f7f4ec] neo-border-sm p-4 text-base font-semibold leading-relaxed">
            {currentQ.prompt}
            <div className="mt-2 text-xs font-mono text-zinc-600">Bobot: {currentQ.points} Poin</div>
          </div>

          {/* Form Input based on Question Type */}
          <div className="space-y-3">
            {/* 1. SINGLE CHOICE */}
            {currentQ.type === 'SINGLE_CHOICE' && currentQ.options && (
              <div className="space-y-2">
                {currentQ.options.map((opt) => {
                  const isSelected = answers[currentQ.id] === opt.id;
                  return (
                    <label
                      key={opt.id}
                      onClick={() => handleSelectSingleChoice(currentQ.id, opt.id)}
                      className={`flex items-center gap-3 p-3 neo-border-sm cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#e6f4f4] border-[#008080] neo-shadow-sm font-bold text-teal-950'
                          : 'bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name={currentQ.id}
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 accent-black"
                      />
                      <span className="text-sm">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* 2. MCMA (Multiple Choice Multiple Answers) */}
            {currentQ.type === 'MCMA' && currentQ.options && (
              <div className="space-y-2">
                <p className="text-xs font-mono text-zinc-600">
                  💡 Kamu dapat mencentang lebih dari satu opsi jawaban.
                </p>
                {currentQ.options.map((opt) => {
                  const selectedArr: string[] = answers[currentQ.id] || [];
                  const isSelected = selectedArr.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      onClick={() => handleToggleMCMA(currentQ.id, opt.id)}
                      className={`flex items-center gap-3 p-3 neo-border-sm cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#79f2c0] neo-shadow-sm font-bold'
                          : 'bg-white hover:bg-zinc-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 accent-black"
                      />
                      <span className="text-sm">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* 3. CATEGORY MATRIX (Tabel Benar/Salah) */}
            {currentQ.type === 'CATEGORY_MATRIX' && currentQ.matrixRows && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left neo-border">
                  <thead className="bg-[#dfdbd2] font-mono text-xs border-b-2 border-black">
                    <tr>
                      <th className="p-3">Pernyataan</th>
                      {(currentQ.matrixColumns || ['Benar', 'Salah']).map((col) => (
                        <th key={col} className="p-3 text-center w-28">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentQ.matrixRows.map((row, rIdx) => {
                      const currentSelected = (answers[currentQ.id] || {})[row.id];
                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-black ${
                            rIdx % 2 === 0 ? 'bg-white' : 'bg-[#fcfaf5]'
                          }`}
                        >
                          <td className="p-3 font-medium">{row.statement}</td>
                          {(currentQ.matrixColumns || ['Benar', 'Salah']).map((col) => (
                            <td key={col} className="p-3 text-center">
                              <label className="cursor-pointer inline-flex items-center justify-center p-2">
                                <input
                                  type="radio"
                                  name={`${currentQ.id}_${row.id}`}
                                  checked={currentSelected === col}
                                  onChange={() => handleSetMatrixValue(currentQ.id, row.id, col)}
                                  className="w-4 h-4 accent-black"
                                />
                              </label>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. SHORT ESSAY */}
            {currentQ.type === 'SHORT_ESSAY' && (
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Ketik jawaban singkat kamu di sini..."
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => handleSetTextAnswer(currentQ.id, e.target.value)}
                  className="w-full p-3 neo-border-sm font-mono text-sm bg-white focus:bg-[#fffde6] focus:outline-none"
                />
              </div>
            )}

            {/* 5. LONG ESSAY (Mode B) */}
            {currentQ.type === 'LONG_ESSAY' && (
              <div className="space-y-2">
                <textarea
                  rows={6}
                  placeholder="Tuliskan uraian penjelasan lengkap kamu di sini..."
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => handleSetTextAnswer(currentQ.id, e.target.value)}
                  className="w-full p-3 neo-border-sm text-sm bg-white focus:bg-[#fffde6] focus:outline-none"
                />
                <div className="flex items-center justify-between text-xs font-mono text-zinc-600">
                  <span>
                    Jumlah kata:{' '}
                    {
                      (answers[currentQ.id] || '')
                        .trim()
                        .split(/\s+/)
                        .filter(Boolean).length
                    }{' '}
                    kata
                  </span>
                  <span>Minimal: {currentQ.minWords || 15} kata</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation & Submit Buttons */}
          <div className="pt-4 border-t-2 border-black flex items-center justify-between flex-wrap gap-2">
            <RetroButton
              variant="white"
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
            >
              ← Soal Sebelumnya
            </RetroButton>

            {currentQuestionIndex < questions.length - 1 ? (
              <RetroButton
                variant="teal"
                onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
              >
                Soal Berikutnya →
              </RetroButton>
            ) : (
              <RetroButton
                variant="coral"
                onClick={handleSubmit}
                icon={<Send className="w-4 h-4" />}
              >
                Kumpulkan Jawaban Ujian Selesai!
              </RetroButton>
            )}
          </div>
        </div>
      </RetroWindow>
    </div>
  );
};
