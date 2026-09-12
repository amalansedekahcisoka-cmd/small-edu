'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DataProvider } from '@/lib/data/dataProvider';
import { checkSequentialAccess } from '@/lib/engine/sequential';
import { Chapter, Course, User, UserCourseProgress } from '@/types';
import { YouTubePlayer } from '@/components/player/YouTubePlayer';
import { TextReader } from '@/components/player/TextReader';
import { ExamRunner } from '@/components/quiz/ExamRunner';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { RetroBadge } from '@/components/ui/RetroBadge';
import {
  ArrowLeft,
  Lock,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
  FileCheck,
  Sparkles,
  FileText,
  File,
  ExternalLink,
  Link as LinkIcon,
  Star,
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function ChapterPlayerPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.courseId as string;
  const chapterId = params.chapterId as string;

  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [allChapters, setAllChapters] = useState<Chapter[]>([]);
  const [progress, setProgress] = useState<UserCourseProgress | null>(null);
  const [assignmentFile, setAssignmentFile] = useState<string>('');
  const [assignmentSubmitted, setAssignmentSubmitted] = useState<boolean>(false);

  const loadData = () => {
    let currentUser = DataProvider.getCurrentUser();
    setUser(currentUser);

    const c = DataProvider.getCourseById(courseId);
    setCourse(c || null);

    const chs = DataProvider.getChapters(courseId);
    setAllChapters(chs);

    const currentCh = chs.find((ch) => ch.id === chapterId);
    setChapter(currentCh || null);

    if (currentUser) {
      DataProvider.syncUserActivityPoints(currentUser.id);
      currentUser = DataProvider.getCurrentUser();
      setUser(currentUser);
      const p = DataProvider.getUserProgress(currentUser.id, courseId);
      setProgress(p);

      DataProvider.getUserProgressAsync(currentUser.id, courseId).then((asyncP) => {
        if (asyncP) setProgress(asyncP);
      }).catch(() => {});
    }
  };

  useEffect(() => {
    loadData();
  }, [courseId, chapterId]);

  if (!user || !course || !chapter) {
    return (
      <div className="max-w-4xl mx-auto p-8 font-mono text-center">
        Memuat konten pembelajaran...
      </div>
    );
  }

  // VALIDASI SEQUENTIAL ACCESS (Guru & Admin bebas pratinjau seluruh materi tanpa terkunci)
  const isTeacher = user.role === 'teacher' || user.role === 'admin';
  const accessCheck = isTeacher
    ? { canAccess: true, reason: '' }
    : checkSequentialAccess(chapter, allChapters, progress);
  const chProgress = progress?.chapters?.[chapter.id];
  const isCompleted = isTeacher ? true : (chProgress?.is_completed || false);

  // Handler saat bab video selesai (+25 XP)
  const handleVideoCompleted = () => {
    if (isTeacher) return;
    const wasAlreadyCompleted = chProgress?.is_completed || chProgress?.xpClaimed;

    DataProvider.updateChapterProgress(user.id, courseId, chapter.id, {
      is_completed: true,
      score: 100,
      watchPercentage: 100,
      status: 'passed',
    });

    if (!wasAlreadyCompleted) {
      DataProvider.logActivity(
        user.id,
        user.name,
        'student',
        'VIDEO_WATCH_FINISHED',
        `Menyelesaikan tontonan video ${chapter.title} (Target tercapai).`,
        courseId,
        chapter.id
      );

      const starSettings = DataProvider.getCourseStarSettings(courseId);
      const xpPoints = chapter.activityRewardPoints ?? starSettings.defaultVideoXp ?? 25;

      const result = DataProvider.addActivityPoints(
        user.id,
        xpPoints,
        'Video Pembelajaran Tuntas',
        `Menonton penuh video pembahasan ${chapter.title}`,
        'ACADEMIC_EXCELLENCE',
        courseId,
        chapter.id
      );

      if (result.earnedNewStar) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      } else {
        confetti({ particleCount: 40, spread: 50 });
      }
    }

    loadData();
  };

  // Handler saat bab teks selesai (+20 XP)
  const handleTextCompleted = () => {
    if (isTeacher) return;
    const wasAlreadyCompleted = chProgress?.is_completed || chProgress?.xpClaimed;

    DataProvider.updateChapterProgress(user.id, courseId, chapter.id, {
      is_completed: true,
      score: 100,
      status: 'passed',
    });

    if (!wasAlreadyCompleted) {
      DataProvider.logActivity(
        user.id,
        user.name,
        'student',
        'TEXT_READING_FINISHED',
        `Menyelesaikan modul bacaan ${chapter.title} (Dwell time & scroll tuntas).`,
        courseId,
        chapter.id
      );

      const starSettings = DataProvider.getCourseStarSettings(courseId);
      const xpPoints = chapter.activityRewardPoints ?? starSettings.defaultTextXp ?? 20;

      const result = DataProvider.addActivityPoints(
        user.id,
        xpPoints,
        'Literasi Digital Tuntas',
        `Membaca materi teks ${chapter.title}`,
        'ACADEMIC_EXCELLENCE',
        courseId,
        chapter.id
      );

      if (result.earnedNewStar) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      } else {
        confetti({ particleCount: 40, spread: 50 });
      }
    }

    loadData();
  };

  // Handler saat modul PDF selesai dipelajari (+20 XP)
  const handlePdfCompleted = () => {
    if (isTeacher) return;
    const wasAlreadyCompleted = chProgress?.is_completed || chProgress?.xpClaimed;

    DataProvider.updateChapterProgress(user.id, courseId, chapter.id, {
      is_completed: true,
      score: 100,
      status: 'passed',
    });

    if (!wasAlreadyCompleted) {
      DataProvider.logActivity(
        user.id,
        user.name,
        'student',
        'MODUL_PDF_SELESAI',
        `Menyelesaikan dan mempelajari dokumen modul ${chapter.title} (Status: Lulus).`,
        courseId,
        chapter.id
      );

      const starSettings = DataProvider.getCourseStarSettings(courseId);
      const xpPoints = chapter.activityRewardPoints ?? starSettings.defaultPdfXp ?? 20;

      const result = DataProvider.addActivityPoints(
        user.id,
        xpPoints,
        'Modul PDF Tuntas',
        `Mempelajari dokumen modul ${chapter.title}`,
        'ACADEMIC_EXCELLENCE',
        courseId,
        chapter.id
      );

      if (result.earnedNewStar) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      } else {
        confetti({ particleCount: 70, spread: 60 });
      }
    }

    loadData();
  };

  // Handler saat materi Link/Web selesai dipelajari (+15 XP)
  const handleLinkCompleted = () => {
    if (isTeacher) return;
    const wasAlreadyCompleted = chProgress?.is_completed || chProgress?.xpClaimed;

    DataProvider.updateChapterProgress(user.id, courseId, chapter.id, {
      is_completed: true,
      score: 100,
      status: 'passed',
    });

    if (!wasAlreadyCompleted) {
      DataProvider.logActivity(
        user.id,
        user.name,
        'student',
        'TAUTAN_MATERI_SELESAI',
        `Menyelesaikan penugasan tautan materi eksternal ${chapter.title} (Status: Lulus).`,
        courseId,
        chapter.id
      );

      const starSettings = DataProvider.getCourseStarSettings(courseId);
      const xpPoints = chapter.activityRewardPoints ?? starSettings.defaultLinkXp ?? 15;

      const result = DataProvider.addActivityPoints(
        user.id,
        xpPoints,
        'Referensi Web Tuntas',
        `Mempelajari tautan materi ${chapter.title}`,
        'ACADEMIC_EXCELLENCE',
        courseId,
        chapter.id
      );

      if (result.earnedNewStar) {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      } else {
        confetti({ particleCount: 70, spread: 60 });
      }
    }

    loadData();
  };

  // Handler saat kuis selesai
  const handleQuizCompleted = () => {
    loadData();
  };

  // Handler pengumpulan tugas praktik (+30 XP + 15 XP On-Time)
  const handleUploadAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTeacher) {
      alert('Mode Pratinjau Guru: Anda dapat memeriksa form penugasan ini tanpa mengirim jawaban siswa.');
      return;
    }
    if (!assignmentFile.trim()) return;

    DataProvider.saveSubmission({
      courseId,
      chapterId: chapter.id,
      studentId: user.id,
      studentName: user.name,
      answers: { submissionTextOrUrl: assignmentFile },
      autoScore: 0,
      finalScore: 0,
      status: 'pending',
    });

    DataProvider.updateChapterProgress(user.id, courseId, chapter.id, {
      is_completed: false,
      status: 'waiting_grading',
    });

    DataProvider.logActivity(
      user.id,
      user.name,
      'student',
      'SUBMIT_ASSIGNMENT_FILE',
      `Mengunggah berkas portofolio ${chapter.title}. Menunggu penilaian guru.`,
      courseId,
      chapter.id
    );

    const wasAlreadyCompleted = chProgress?.is_completed || chProgress?.xpClaimed;

    // Cek apakah submit tepat waktu sebelum deadline
    let isOnTime = true;
    if (chapter.schedule?.endDate) {
      const deadline = new Date(chapter.schedule.endDate);
      deadline.setHours(23, 59, 59, 999);
      isOnTime = new Date() <= deadline;
    }

    if (!wasAlreadyCompleted) {
      const starSettings = DataProvider.getCourseStarSettings(courseId);
      const basePoints = chapter.activityRewardPoints ?? starSettings.defaultAssignmentXp ?? 30;
      const bonusXp = starSettings.onTimeBonusXp ?? 15;
      const xpEarned = isOnTime ? basePoints + bonusXp : basePoints;
      const reasonTitle = isOnTime ? 'Tugas Terkumpul Tepat Waktu (Disiplin)' : 'Tugas Terkumpul';
      const reasonDesc = isOnTime
        ? `Mengunggah berkas tugas ${chapter.title} sebelum batas waktu (+${bonusXp} XP Bonus)`
        : `Mengunggah berkas tugas ${chapter.title}`;

      const result = DataProvider.addActivityPoints(
        user.id,
        xpEarned,
        reasonTitle,
        reasonDesc,
        isOnTime ? 'ON_TIME' : 'ACADEMIC_EXCELLENCE',
        courseId,
        chapter.id
      );

      if (result.earnedNewStar) {
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.6 } });
      } else {
        confetti({ particleCount: 70, spread: 60 });
      }
    }

    setAssignmentSubmitted(true);
    loadData();
  };

  // JIKA AKSES DITOLAK (BAB TERKUNCI OLEH SEQUENTIAL CHECK / DEADLINE EXPIRED)
  if (!accessCheck.canAccess) {
    const isOverdue = accessCheck.lockType === 'overdue' || accessCheck.lockType === 'cascade_overdue';
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <RetroWindow
          title={isOverdue ? 'AKSES DITOLAK: MELEWATI BATAS WAKTU (TERKUNCI OTOMATIS)' : 'AKSES DITOLAK: BAB MASIH TERKUNCI'}
          headerColor={isOverdue ? 'coral' : 'coral'}
          icon={<Lock className="w-4 h-4 text-white" />}
        >
          <div className="p-6 text-center space-y-4">
            <div className={`w-16 h-16 neo-border flex items-center justify-center mx-auto ${isOverdue ? 'bg-[#ff4757]' : 'bg-[#ff7675]'}`}>
              <Lock className="w-8 h-8 text-black" />
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-black">
              {isOverdue ? 'Batas Waktu Belajar Telah Berakhir!' : 'Bab Ini Belum Dapat Kamu Buka!'}
            </h2>

            <div className="bg-[#fff8db] neo-border-sm p-4 text-sm font-mono text-zinc-900 max-w-lg mx-auto text-left">
              <p className="font-bold text-red-600 mb-1 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Status & Alasan Kunci:</span>
              </p>
              <p className="leading-relaxed">{accessCheck.reason}</p>
            </div>

            <p className="text-xs text-zinc-600 font-mono max-w-md mx-auto">
              {isOverdue
                ? 'Small-Edu menerapkan aturan kedisiplinan belajar. Jika batas waktu bab terlewat tanpa kamu selesaikan, materi di bawahnya akan terkunci. Silakan laporkan kepada Guru Pembimbing untuk verifikasi atau pembukaan dispensasi.'
                : 'Small-Edu menerapkan prinsip Sequential Learning. Kamu wajib menyelesaikan materi atau lulus ujian bab sebelumnya dengan nilai minimal 75.'}
            </p>

            <div className="pt-4 flex items-center justify-center gap-3 flex-wrap">
              <Link href="/student">
                <RetroButton variant="white" icon={<ArrowLeft className="w-4 h-4" />}>
                  Kembali ke Peta Belajar
                </RetroButton>
              </Link>

              {accessCheck.overdueChapter && (
                <Link
                  href={`/student/course/${courseId}/chapter/${accessCheck.overdueChapter.id}`}
                >
                  <RetroButton variant="yellow">
                    Inspeksi Bab {accessCheck.overdueChapter.order_index} →
                  </RetroButton>
                </Link>
              )}

              {!isOverdue && accessCheck.previousChapter && (
                <Link
                  href={`/student/course/${courseId}/chapter/${accessCheck.previousChapter.id}`}
                >
                  <RetroButton variant="teal">
                    Buka Bab {accessCheck.previousChapter.order_index} Sekarang →
                  </RetroButton>
                </Link>
              )}
            </div>
          </div>
        </RetroWindow>
      </div>
    );
  }

  // JIKA AKSES DIIZINKAN: TAMPILKAN KONTEN SESUAI TIPE
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Teacher Preview Banner */}
      {isTeacher && (
        <div className="bg-[#ffde59] neo-border p-3 flex items-center justify-between flex-wrap gap-2 text-xs font-mono font-bold">
          <div className="flex items-center gap-2">
            <span className="bg-black text-white px-2 py-0.5 neo-border-sm">PRATINJAU GURU</span>
            <span>Anda sedang menguji materi ajar ini sebagai Guru Pembimbing (Akses Tidak Dibatasi).</span>
          </div>
          <Link href="/teacher">
            <RetroButton variant="teal" size="sm" icon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Kembali ke Panel Guru
            </RetroButton>
          </Link>
        </div>
      )}

      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href={isTeacher ? '/teacher' : '/student'}>
          <RetroButton variant="white" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            {isTeacher ? 'Kembali ke Panel Guru' : 'Kembali ke Peta Bab'}
          </RetroButton>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {(() => {
            const starSettings = DataProvider.getCourseStarSettings(courseId);
            const rewardPoints =
              chapter.activityRewardPoints ||
              (chapter.type === 'video'
                ? starSettings.defaultVideoXp
                : chapter.type === 'pdf'
                ? starSettings.defaultPdfXp
                : chapter.type === 'text'
                ? starSettings.defaultTextXp
                : chapter.type === 'link'
                ? starSettings.defaultLinkXp
                : chapter.type === 'quiz'
                ? starSettings.defaultQuizXp
                : starSettings.defaultAssignmentXp);
            return (
              <span className="text-xs font-mono font-bold px-2 py-1 bg-amber-100 text-amber-900 neo-border-sm flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                Hadiah: +{rewardPoints} XP
              </span>
            );
          })()}
          <span className="text-xs font-mono font-bold text-zinc-600">
            BAB {chapter.order_index} DARI {allChapters.length}
          </span>
          {isCompleted ? (
            <RetroBadge variant="green" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
              TELAH SELESAI
            </RetroBadge>
          ) : (
            <RetroBadge variant="yellow" size="sm">
              SEDANG BERJALAN
            </RetroBadge>
          )}
        </div>
      </div>

      {/* Main Chapter Content Component */}
      {chapter.type === 'video' && (
        <YouTubePlayer
          title={chapter.title}
          videoUrl={chapter.videoUrl || ''}
          minWatchPercentage={chapter.min_watch_percentage || 80}
          isCompleted={isCompleted}
          onComplete={handleVideoCompleted}
        />
      )}

      {chapter.type === 'text' && (
        <div className="space-y-4">
          <TextReader
            title={chapter.title}
            textContent={chapter.textContent || ''}
            minReadingSeconds={chapter.min_reading_seconds || 30}
            isCompleted={isCompleted}
            onComplete={handleTextCompleted}
          />
          {!isCompleted && (
            <div className="bg-[#f0f9f9] neo-border p-4 flex items-center justify-between flex-wrap gap-3 font-mono">
              <div>
                <h4 className="font-bold text-sm">Sudah Selesai Membaca Modul Ini?</h4>
                <p className="text-xs text-zinc-600">
                  Konfirmasikan pemahamanmu untuk membuka bab materi atau tugas berikutnya.
                </p>
              </div>
              <RetroButton
                variant="teal"
                size="md"
                icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={handleTextCompleted}
              >
                Tandai Selesai Mempelajari ✅
              </RetroButton>
            </div>
          )}
        </div>
      )}

      {chapter.type === 'pdf' && (
        <RetroWindow
          title={`MODUL DOKUMEN PDF: ${chapter.title.toUpperCase()}`}
          headerColor="coral"
          icon={<File className="w-4 h-4 text-white" />}
        >
          <div className="space-y-6">
            <div className="bg-[#f8f9fa] neo-border-sm p-4 space-y-3 font-mono">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-zinc-700">Berkas Dokumen Pembelajaran:</span>
                {chapter.fileUrl && (
                  <a
                    href={chapter.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-black text-[#79f2c0] px-3 py-1 font-mono font-bold hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka Dokumen di Tab Baru
                  </a>
                )}
              </div>

              {chapter.description && (
                <p className="text-sm font-sans text-zinc-800 leading-relaxed">
                  {chapter.description}
                </p>
              )}

              {/* Embedded Document Viewer Preview */}
              {chapter.fileUrl ? (
                <div className="w-full h-[500px] neo-border bg-zinc-100 overflow-hidden">
                  <iframe
                    src={chapter.fileUrl}
                    className="w-full h-full border-none"
                    title={chapter.title}
                  />
                </div>
              ) : (
                <div className="p-8 text-center bg-white neo-border text-xs text-zinc-600">
                  Tautan berkas belum ditentukan oleh guru.
                </div>
              )}
            </div>

            {/* Action Button to Complete & Unlock Next */}
            <div className="bg-[#f0f9f9] neo-border p-4 flex items-center justify-between flex-wrap gap-3 font-mono">
              <div>
                <h4 className="font-bold text-sm">Konfirmasi Penyelesaian Modul PDF</h4>
                <p className="text-xs text-zinc-600">
                  Klik tombol di samping setelah selesai membaca dokumen untuk membuka bab / tugas berikutnya.
                </p>
              </div>

              {isCompleted ? (
                <RetroBadge variant="green" size="md" icon={<CheckCircle2 className="w-4 h-4" />}>
                  TELAH SELESAI DIPELAJARI
                </RetroBadge>
              ) : (
                <RetroButton
                  variant="teal"
                  size="md"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={handlePdfCompleted}
                >
                  Selesai Mempelajari Dokumen Ini ✅
                </RetroButton>
              )}
            </div>
          </div>
        </RetroWindow>
      )}

      {chapter.type === 'link' && (
        <RetroWindow
          title={`TAUTAN MATERI / REFERENSI WEB: ${chapter.title.toUpperCase()}`}
          headerColor="navy"
          icon={<LinkIcon className="w-4 h-4 text-yellow-300" />}
        >
          <div className="space-y-6 font-mono">
            <div className="bg-[#f0f7ff] neo-border-sm p-5 space-y-3">
              <h3 className="font-bold text-base text-blue-950">Arahan Pembelajaran:</h3>
              <p className="text-sm font-sans text-zinc-800 leading-relaxed">
                {chapter.description || 'Silakan buka dan pelajari tautan materi eksternal berikut untuk memahami topik bahasan bab ini.'}
              </p>

              {chapter.externalUrl && (
                <div className="pt-2">
                  <a
                    href={chapter.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#54a0ff] text-white px-4 py-2.5 neo-border-sm font-bold text-sm hover:bg-blue-600 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Kunjungi Tautan Materi: {chapter.externalUrl}
                  </a>
                </div>
              )}
            </div>

            {/* Action Button to Complete & Unlock Next */}
            <div className="bg-[#f0f9f9] neo-border p-4 flex items-center justify-between flex-wrap gap-3">
              <div>
                <h4 className="font-bold text-sm">Konfirmasi Penyelesaian Materi</h4>
                <p className="text-xs text-zinc-600">
                  Setelah selesai mempelajari tautan di atas, klik tombol di bawah untuk membuka bab selanjutnya.
                </p>
              </div>

              {isCompleted ? (
                <RetroBadge variant="green" size="md" icon={<CheckCircle2 className="w-4 h-4" />}>
                  TELAH SELESAI DIPELAJARI
                </RetroBadge>
              ) : (
                <RetroButton
                  variant="teal"
                  size="md"
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  onClick={handleLinkCompleted}
                >
                  Selesai Mempelajari Tautan Ini ✅
                </RetroButton>
              )}
            </div>
          </div>
        </RetroWindow>
      )}

      {chapter.type === 'quiz' && (
        <ExamRunner
          chapter={chapter}
          courseId={courseId}
          userId={user.id}
          userName={user.name}
          onComplete={handleQuizCompleted}
        />
      )}

      {/* LATIHAN BUTIR SOAL TERPASANG (JIKA MATERI MEMILIKI BUTIR SOAL UJIAN/LATIHAN) */}
      {chapter.type !== 'quiz' && chapter.questions && chapter.questions.length > 0 && (
        <div className="pt-2 space-y-3">
          <div className="bg-[#fffde6] neo-border p-3.5 flex items-center justify-between flex-wrap gap-2 font-mono">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">📝</span>
              <div>
                <h4 className="font-black text-sm text-black">
                  Uji Pemahaman Materi: {chapter.questions.length} Butir Soal Terpasang
                </h4>
                <p className="text-xs text-zinc-700">
                  Kerjakan butir-butir soal di bawah ini untuk menguji pemahaman dan mencatatkan skor capaian belajar ke rapor.
                </p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 bg-purple-200 text-purple-950 neo-border-sm">
              Total Bobot: {chapter.questions.reduce((sum, q) => sum + (q.points || 0), 0)} Poin
            </span>
          </div>

          <ExamRunner
            chapter={chapter}
            courseId={courseId}
            userId={user.id}
            userName={user.name}
            onComplete={handleQuizCompleted}
          />
        </div>
      )}

      {chapter.type === 'assignment' && (
        <RetroWindow
          title={`TUGAS PRAKTIK: ${chapter.title}`}
          headerColor="navy"
          icon={<UploadCloud className="w-4 h-4 text-yellow-300" />}
        >
          <div className="space-y-6">
            <div className="bg-[#f0f9f9] neo-border-sm p-4 space-y-2">
              <h3 className="font-bold text-base">Instruksi Tugas dari Guru:</h3>
              <p className="text-sm font-sans text-zinc-800 leading-relaxed">
                {chapter.assignmentPrompt}
              </p>
              <div className="text-xs font-mono text-zinc-600 pt-1">
                Standar Kelulusan: Nilai minimal {chapter.passing_grade || 75} setelah dinilai oleh
                Guru.
              </div>
            </div>

            {assignmentSubmitted || chProgress?.status === 'waiting_grading' ? (
              <div className="bg-[#79f2c0] neo-border p-6 text-center space-y-2">
                <FileCheck className="w-10 h-10 text-emerald-900 mx-auto" />
                <h3 className="text-lg font-black text-emerald-950">
                  Tugas Berhasil Dikirimkan!
                </h3>
                <p className="text-xs font-mono text-emerald-900 max-w-md mx-auto">
                  Tugas portofolio kamu telah masuk ke antrean Meja Koreksi Guru. Guru akan
                  memeriksa dan memberikan nilai serta masukan.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUploadAssignment} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold mb-1">
                    Tautan Proyek GitHub / Google Drive / URL File:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="https://github.com/username/projek-web-anda atau link drive..."
                    value={assignmentFile}
                    onChange={(e) => setAssignmentFile(e.target.value)}
                    className="w-full p-3 neo-border-sm font-mono text-sm bg-white focus:bg-[#f0fdfa] focus:border-[#008080] focus:outline-none"
                  />
                </div>

                <div className="pt-2 text-right">
                  <RetroButton
                    type="submit"
                    variant="teal"
                    icon={<UploadCloud className="w-4 h-4" />}
                  >
                    Kumpulkan Tugas ke Guru
                  </RetroButton>
                </div>
              </form>
            )}
          </div>
        </RetroWindow>
      )}
    </div>
  );
}
