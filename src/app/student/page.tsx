'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DataProvider } from '@/lib/data/dataProvider';
import { checkSequentialAccess } from '@/lib/engine/sequential';
import { User, Course, Chapter, UserCourseProgress, BabLearningReport } from '@/types';
import { BabReportPdfModal } from '@/components/report/BabReportPdfModal';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { RetroBadge } from '@/components/ui/RetroBadge';
import {
  BookOpen,
  CheckCircle2,
  Lock,
  Play,
  FileText,
  HelpCircle,
  UploadCloud,
  Star,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  File,
  Link as LinkIcon,
  Calendar,
  Clock,
  AlertCircle,
  Printer,
} from 'lucide-react';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [progress, setProgress] = useState<UserCourseProgress | null>(null);

  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [selectedBabReport, setSelectedBabReport] = useState<BabLearningReport | null>(null);

  const loadDashboard = () => {
    let currentUser = DataProvider.getCurrentUser();
    if (currentUser?.id) {
      DataProvider.syncUserActivityPoints(currentUser.id);
      currentUser = DataProvider.getCurrentUser();
    }
    setUser(currentUser);

    // Guru diarahkan kembali ke panel guru jika mengakses halaman siswa
    if (currentUser?.role === 'teacher') {
      router.replace('/teacher');
      return;
    }

    // Redirect jika wajib ganti password
    if (currentUser?.mustChangePassword) {
      router.push('/auth/change-password');
      return;
    }

    const allCourses = DataProvider.getCourses();

    // Filter course berdasarkan kelas siswa (dengan normalisasi misal X RPL 1 vs 10 RPL 1)
    const studentClass = currentUser.gradeClass || '';
    const normalizeClass = (s: string) =>
      s.toLowerCase().replace(/\s+/g, '').replace(/^10/, 'x').replace(/^11/, 'xi').replace(/^12/, 'xii');

    const myCourses = allCourses.filter((c) => {
      if (!c.targetClasses || c.targetClasses.length === 0) return true;
      if (!studentClass) return true;
      const normStudent = normalizeClass(studentClass);
      return c.targetClasses.some(
        (tc) => normalizeClass(tc) === normStudent || tc.toLowerCase() === studentClass.toLowerCase()
      );
    });

    setAvailableCourses(myCourses);

    // Gunakan course yang sudah dipilih, atau pilih yang pertama
    const currentCourseId = course?.id;
    const primaryCourse = myCourses.find((c) => c.id === currentCourseId) || myCourses[0] || null;
    setCourse(primaryCourse);

    if (primaryCourse) {
      const chs = DataProvider.getChapters(primaryCourse.id);
      setChapters(chs);
      const prog = DataProvider.getUserProgress(currentUser.id, primaryCourse.id);
      setProgress(prog);

      DataProvider.getUserProgressAsync(currentUser.id, primaryCourse.id).then((asyncP) => {
        if (asyncP) setProgress(asyncP);
      }).catch(() => {});

      // Audit otomatis kedaluwarsa & catat ke catatan guru jika ada materi terlewat
      DataProvider.checkAndLogOverdueDeadlines(currentUser.id, currentUser.name, currentUser.gradeClass);
    } else {
      setChapters([]);
      setProgress(null);
    }
  };

  const handleSelectCourse = (selectedCourse: Course) => {
    if (!user) return;
    setCourse(selectedCourse);
    const chs = DataProvider.getChapters(selectedCourse.id);
    setChapters(chs);
    const prog = DataProvider.getUserProgress(user.id, selectedCourse.id);
    setProgress(prog);
  };

  useEffect(() => {
    loadDashboard();
    DataProvider.syncWithServer().then(() => {
      loadDashboard();
    }).catch(console.error);
    const interval = setInterval(loadDashboard, 4000);
    return () => clearInterval(interval);
  }, []);

  if (!user) {
    return (
      <div className="p-8 text-center font-mono font-bold">
        Memuat data pembelajaran siswa...
      </div>
    );
  }

  // Jika tidak ada course untuk kelas ini
  if (availableCourses.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="w-16 h-16 bg-[#ffde59] neo-border neo-shadow flex items-center justify-center text-3xl mx-auto">📚</div>
        <div className="space-y-2">
          <h2 className="text-xl font-black font-mono">Belum Ada Materi untuk Kelas Anda</h2>
          <p className="text-sm font-mono text-zinc-600">
            Halo, <strong>{user.name}</strong>! Belum ada kursus yang ditetapkan untuk kelas <strong>{user.gradeClass || '-'}</strong>.
            Guru pembimbing Anda sedang menyiapkan materi pembelajaran.
          </p>
        </div>
        <div className="p-4 bg-white neo-border font-mono text-xs text-zinc-500">
          Jika ada pertanyaan, silakan hubungi Administrator atau Guru Pembimbing Anda.
        </div>
      </div>
    );
  }



  const completedChaptersCount = Object.values(progress?.chapters || {}).filter(
    (c) => c.is_completed
  ).length;

  const totalChaptersCount = chapters.length;
  const progressPercentage =
    totalChaptersCount > 0
      ? Math.round((completedChaptersCount / totalChaptersCount) * 100)
      : 0;

  const currentStarSettings = course
    ? DataProvider.getCourseStarSettings(course.id)
    : DataProvider.getCourseStarSettings();
  const xpPerStar = currentStarSettings.xpPerStar || 100;
  const currentXpInCycle = (user.activityPoints || 0) % xpPerStar;
  const xpPercentInCycle = Math.min(100, Math.round((currentXpInCycle / xpPerStar) * 100));
  const xpNeededForNextStar = Math.max(0, xpPerStar - currentXpInCycle);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Welcome Banner */}
      <div className="bg-[#008080] text-white neo-border neo-shadow-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase bg-black text-[#79f2c0] px-2 py-0.5">
              RUANG BELAJAR SISWA
            </span>
            <span className="text-xs font-mono font-bold text-teal-100">{user.gradeClass}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Selamat Datang, {user.name}!
          </h1>
          <p className="text-sm font-sans text-teal-50 max-w-2xl">
            Sistem pembelajaran ini menerapkan <strong>Sequential Learning Path</strong>. Selesaikan setiap bab secara berurutan dan raih bintang prestasi!
          </p>
        </div>

        {/* Quick Stats Pill with XP Progress Bar */}
        <div className="flex items-center gap-3 bg-white neo-border-sm p-3 neo-shadow-sm text-black">
          <div className="text-center px-3 border-r-2 border-black">
            <div className="text-xs font-mono text-zinc-600">BINTANG</div>
            <div className="text-xl font-black flex items-center justify-center gap-1 text-amber-500">
              <Star className="w-4 h-4 fill-amber-400" />
              {user.starsCount || 0}
            </div>
          </div>

          <div className="text-center px-3 border-r-2 border-black min-w-[120px]">
            <div className="text-xs font-mono text-zinc-600 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3 text-[#008080]" />
              <span>KEAKTIFAN</span>
            </div>
            <div className="text-sm font-black text-[#008080]">
              {user.activityPoints || 0} XP
            </div>
            <div className="w-full bg-zinc-200 h-1.5 mt-1 border border-black/40 overflow-hidden">
              <div
                className="bg-[#008080] h-full transition-all duration-500"
                style={{ width: `${xpPercentInCycle}%` }}
              />
            </div>
            <div className="text-[9px] font-mono text-zinc-500 mt-0.5">
              {currentXpInCycle}/{xpPerStar} XP ke ⭐ berikutnya
            </div>
          </div>

          <div className="text-center px-3">
            <div className="text-xs font-mono text-zinc-600">PROGRES KURSUS</div>
            <div className="text-xl font-black text-black">
              {progressPercentage}%
            </div>
          </div>
        </div>
      </div>

      {/* Multi-Course Selector (tampil jika ada lebih dari 1 kursus untuk kelas ini) */}
      {availableCourses.length > 1 && (
        <div className="space-y-2">
          <div className="font-mono text-xs font-bold text-zinc-600 uppercase">
            📚 Mata Pelajaran Tersedia untuk Kelas {user.gradeClass} ({availableCourses.length} Kursus):
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCourses.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectCourse(c)}
                className={`px-3 py-2 neo-border-sm font-mono text-xs font-bold transition-all ${
                  course?.id === c.id
                    ? 'bg-[#008080] text-white neo-shadow-sm'
                    : 'bg-white text-black hover:bg-zinc-100'
                }`}
              >
                {c.subject} — {c.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Course Path View */}
      {course && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: The Sequential Learning Map */}
        <div className="lg:col-span-2 space-y-6">
          <RetroWindow
            title={`PETA JALUR BELAJAR: ${course.title.toUpperCase()}`}
            headerColor="navy"
            icon={<BookOpen className="w-4 h-4 text-yellow-300" />}
          >

            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b-2 border-black font-mono text-xs">
                <span>Pengampu: <strong>{course.teacherName}</strong></span>
                <span>Target Capaian Pembelajaran: <strong>75 Poin</strong></span>
              </div>

              {/* Sequential Path Chapters List - Structured as Book Hierarchy */}
              <div className="space-y-6 pt-2">
                {chapters.length === 0 ? (
                  <div className="p-8 bg-white neo-border text-center space-y-2 font-mono">
                    <p className="font-bold text-sm">Belum Ada Bab Materi / Tugas</p>
                    <p className="text-xs text-zinc-600">Guru pembimbing Anda sedang menyiapkan silabus materi pembelajaran.</p>
                  </div>
                ) : (
                  (() => {
                    // Grouping chapters by BAB like in a book
                    interface BabGroup {
                      babNumber: number;
                      babTitle: string;
                      subChapters: {
                        main: Chapter;
                        assignments: Chapter[];
                      }[];
                    }

                    const map = new Map<number, BabGroup>();
                    chapters.forEach((ch) => {
                      const bNum = ch.babNumber || 1;
                      const bTitle = ch.babTitle || `BAB ${bNum}`;
                      if (!map.has(bNum)) {
                        map.set(bNum, {
                          babNumber: bNum,
                          babTitle: bTitle,
                          subChapters: [],
                        });
                      }
                      const group = map.get(bNum)!;
                      if (ch.itemCategory === 'assignment' && ch.parentSubChapterId) {
                        const parent = group.subChapters.find((s) => s.main.id === ch.parentSubChapterId);
                        if (parent) {
                          parent.assignments.push(ch);
                          return;
                        }
                      }
                      group.subChapters.push({
                        main: ch,
                        assignments: [],
                      });
                    });

                    const sortedBabGroups = Array.from(map.values()).sort((a, b) => a.babNumber - b.babNumber);

                    return sortedBabGroups.map((bab) => {
                      return (
                        <div key={bab.babNumber} className="neo-border bg-[#fbfaf8] p-4 space-y-4">
                          {/* Header BAB Buku */}
                          <div className="bg-[#2a4365] text-white p-3 neo-border-sm flex items-center justify-between gap-2 shadow-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-black font-mono text-sm tracking-wide bg-amber-400 text-black px-2 py-0.5 neo-border-sm">
                                BAB {bab.babNumber}
                              </span>
                              <h2 className="font-black text-sm sm:text-base uppercase tracking-tight">
                                {bab.babTitle.replace(/^BAB\s*\d+\s*:\s*/i, '') || bab.babTitle}
                              </h2>
                            </div>
                            <span className="font-mono text-xs text-blue-100 hidden sm:inline">
                              {bab.subChapters.length} Pembahasan & Penugasan
                            </span>
                          </div>

                          {/* Sub-Bab List under BAB */}
                          <div className="space-y-3">
                            {bab.subChapters.map((sub) => {
                              const renderChapterItem = (ch: Chapter, isAssignmentChild: boolean = false) => {
                                const check = checkSequentialAccess(ch, chapters, progress);
                                const chProg = progress?.chapters?.[ch.id];
                                const isCompleted = chProg?.is_completed;
                                const isWaitingGrading = chProg?.status === 'waiting_grading';
                                const score = chProg?.score;

                                const getChapterIcon = () => {
                                  switch (ch.type) {
                                    case 'video':
                                      return <Play className="w-4 h-4 text-red-600" />;
                                    case 'text':
                                      return <FileText className="w-4 h-4 text-blue-600" />;
                                    case 'pdf':
                                      return <File className="w-4 h-4 text-amber-600" />;
                                    case 'link':
                                      return <LinkIcon className="w-4 h-4 text-sky-600" />;
                                    case 'quiz':
                                      return <HelpCircle className="w-4 h-4 text-amber-600" />;
                                    case 'assignment':
                                      return <UploadCloud className="w-4 h-4 text-purple-600" />;
                                    default:
                                      return <FileText className="w-4 h-4 text-zinc-600" />;
                                  }
                                };

                                return (
                                  <div
                                    key={ch.id}
                                    className={`neo-border p-3 sm:p-4 transition-all relative ${
                                      isAssignmentChild ? 'ml-4 sm:ml-8 border-l-4 border-l-purple-700 bg-[#faf5ff]' : ''
                                    } ${
                                      isCompleted
                                        ? 'bg-[#ecfbf3] border-black neo-shadow-sm'
                                        : check.canAccess
                                        ? 'bg-white border-black neo-shadow hover:translate-x-1'
                                        : 'bg-[#ebe7df] opacity-75 border-zinc-500'
                                    }`}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                      <div className="flex items-start gap-3">
                                        {/* Order Number / Sub-bab Badge */}
                                        <div
                                          className={`w-9 h-9 neo-border-sm shrink-0 flex items-center justify-center font-mono font-black text-sm ${
                                            isCompleted
                                              ? 'bg-[#79f2c0] text-[#0d4a2b]'
                                              : check.canAccess
                                              ? isAssignmentChild ? 'bg-purple-600 text-white' : 'bg-[#008080] text-white'
                                              : 'bg-[#dfdbd2] text-zinc-500'
                                          }`}
                                        >
                                          {ch.subChapterNumber || ch.order_index}
                                        </div>

                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-[11px] font-bold text-zinc-600 uppercase flex items-center gap-1">
                                              {getChapterIcon()}
                                              {isAssignmentChild ? 'TUGAS SUB-BAB' : ch.type.toUpperCase()}
                                            </span>

                                            {isCompleted && (
                                              <RetroBadge variant="green" size="sm" icon={<CheckCircle2 className="w-3 h-3" />}>
                                                SELESAI (SKOR: {score ?? 100})
                                              </RetroBadge>
                                            )}

                                            {isWaitingGrading && (
                                              <RetroBadge variant="yellow" size="sm">
                                                ⏳ MENUNGGU KOREKSI
                                              </RetroBadge>
                                            )}

                                            {ch.schedule?.isEnabled && ch.schedule.endDate && (
                                              <RetroBadge variant="purple" size="sm" icon={<Clock className="w-3 h-3" />}>
                                                TENGGAT: {new Date(ch.schedule.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                                              </RetroBadge>
                                            )}

                                            {!check.canAccess && (
                                              <RetroBadge
                                                variant={check.lockType === 'overdue' || check.lockType === 'cascade_overdue' ? 'red' : 'gray'}
                                                size="sm"
                                                icon={<Lock className="w-3 h-3" />}
                                              >
                                                {check.lockType === 'overdue'
                                                  ? 'KEDALUWARSA / TERKUNCI'
                                                  : check.lockType === 'cascade_overdue'
                                                  ? 'KUNCI OTOMATIS'
                                                  : check.lockType === 'not_started'
                                                  ? 'BELUM DIBUKA'
                                                  : 'TERKUNCI'}
                                              </RetroBadge>
                                            )}
                                          </div>

                                          <h3 className="font-black text-sm sm:text-base text-black flex items-center gap-1.5">
                                            {isAssignmentChild && <span className="text-purple-600 font-mono text-base">↳</span>}
                                            {ch.title}
                                          </h3>
                                          {ch.description && (
                                            <p className="text-xs text-zinc-600 max-w-xl font-sans">
                                              {ch.description}
                                            </p>
                                          )}

                                          {!check.canAccess && check.reason && (
                                            <div
                                              className={`text-[11px] font-mono p-2 border mt-1 flex items-start gap-1.5 ${
                                                check.lockType === 'overdue' || check.lockType === 'cascade_overdue'
                                                  ? 'text-red-900 bg-red-100 border-red-300'
                                                  : check.lockType === 'not_started'
                                                  ? 'text-blue-900 bg-blue-100 border-blue-300'
                                                  : 'text-amber-900 bg-amber-100 border-amber-300'
                                              }`}
                                            >
                                              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-600" />
                                              <span className="leading-tight">{check.reason}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Action Button */}
                                      <div className="sm:self-center shrink-0">
                                        {check.canAccess ? (
                                          <Link href={`/student/course/${course.id}/chapter/${ch.id}`}>
                                            <RetroButton
                                              variant={isCompleted ? 'white' : isAssignmentChild ? 'blue' : 'yellow'}
                                              size="sm"
                                              icon={<ArrowRight className="w-4 h-4" />}
                                            >
                                              {isCompleted ? 'Pelajari Ulang' : isAssignmentChild ? 'Kerjakan Tugas ✍️' : 'Buka Materi'}
                                            </RetroButton>
                                          </Link>
                                        ) : (
                                          <RetroButton variant="gray" size="sm" disabled icon={<Lock className="w-4 h-4" />}>
                                            Terkunci
                                          </RetroButton>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              };

                              return (
                                <div key={sub.main.id} className="space-y-2">
                                  {renderChapterItem(sub.main, false)}
                                  {sub.assignments.map((asg) => (
                                    <div key={asg.id}>
                                      {renderChapterItem(asg, true)}
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>

                          {/* Rapor Capaian Belajar Siswa BAB */}
                          {(() => {
                            const allBabChapters: Chapter[] = [];
                            bab.subChapters.forEach((sub) => {
                              allBabChapters.push(sub.main);
                              allBabChapters.push(...sub.assignments);
                            });
                            const totalBabChapters = allBabChapters.length;
                            const completedBabChapters = allBabChapters.filter(
                              (ch) => progress?.chapters?.[ch.id]?.is_completed
                            ).length;
                            const isBabFullyCompleted =
                              totalBabChapters > 0 && completedBabChapters === totalBabChapters;

                            return isBabFullyCompleted ? (
                              <div className="mt-4 p-4 bg-gradient-to-r from-amber-100 to-yellow-100 neo-border flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-amber-400 neo-border-sm flex items-center justify-center text-xl shrink-0">
                                    🎓
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono font-black uppercase bg-emerald-300 text-emerald-950 px-1.5 py-0.5 neo-border-sm">
                                        Capaian BAB Tuntas (100%)
                                      </span>
                                    </div>
                                    <h4 className="font-black text-sm text-gray-900 mt-1">
                                      Rapor Capaian Belajar BAB {bab.babNumber} (Kurikulum Merdeka)
                                    </h4>
                                    <p className="text-[11px] font-mono text-gray-700">
                                      Memuat akumulasi XP, bintang apresiasi, dan rincian asesmen butir soal capaian belajar.
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    if (!course || !user) return;
                                    const rep = DataProvider.getBabLearningReport(user.id, course.id, bab.babNumber);
                                    setSelectedBabReport(rep);
                                  }}
                                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-black font-mono font-black text-xs neo-border shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-x-0.5 active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 shrink-0"
                                >
                                  <Printer className="w-4 h-4" />
                                  <span>🖨️ Cetak & Unduh Rapor (PDF)</span>
                                </button>
                              </div>
                            ) : (
                              <div className="mt-4 p-3 bg-zinc-100 border-2 border-zinc-300 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 opacity-80">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-zinc-200 border border-zinc-400 rounded-md flex items-center justify-center text-sm text-zinc-500 shrink-0">
                                    🔒
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-xs text-zinc-700">
                                      Rapor Capaian Belajar BAB {bab.babNumber} (Terkunci)
                                    </h4>
                                    <p className="text-[11px] text-zinc-500 font-mono">
                                      Selesaikan seluruh materi & penugasan di BAB ini untuk membuka cetak rapor ({completedBabChapters}/{totalBabChapters} selesai).
                                    </p>
                                  </div>
                                </div>
                                <button
                                  disabled
                                  className="w-full sm:w-auto px-3 py-1.5 bg-zinc-200 text-zinc-500 font-mono font-bold text-xs border border-zinc-400 rounded cursor-not-allowed flex items-center justify-center gap-1"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Rapor Terkunci</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          </RetroWindow>
        </div>

        {/* Right 1 Col: Student Info & Star Achievements Highlights */}
        <div className="space-y-6">
          <RetroWindow
            title="KARTU PRESTASI BINTANG"
            headerColor="mustard"
            icon={<Star className="w-4 h-4 fill-black" />}
          >
            <div className="space-y-4">
              {/* Kartu Bintang & Poin Keaktifan */}
              <div className="p-4 bg-[#fff8db] neo-border-sm space-y-3">
                <div className="text-center">
                  <div className="text-4xl font-black text-amber-500 flex items-center justify-center gap-2">
                    <Star className="w-8 h-8 fill-amber-400" />
                    {user.starsCount || 0}
                  </div>
                  <div className="font-mono text-xs font-bold text-amber-900 mt-0.5">
                    TOTAL BINTANG TERKUMPUL
                  </div>
                </div>

                {/* Progress Bar XP Menuju Bintang Berikutnya */}
                <div className="bg-white p-3 neo-border-sm space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1 text-[#008080]">
                      <Sparkles className="w-3.5 h-3.5" />
                      Poin Keaktifan (XP):
                    </span>
                    <span className="text-black">{user.activityPoints || 0} XP</span>
                  </div>

                  <div className="w-full bg-zinc-200 h-2.5 border border-black overflow-hidden">
                    <div
                      className="bg-amber-400 h-full transition-all duration-500"
                      style={{ width: `${xpPercentInCycle}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-zinc-600">
                    <span>{currentXpInCycle} / {xpPerStar} XP</span>
                    <span className="font-bold text-amber-800">
                      {xpNeededForNextStar} XP lagi menuju ⭐ baru
                    </span>
                  </div>
                </div>
              </div>

              {/* Panduan Perolehan XP Keaktifan */}
              <div className="space-y-1.5 text-xs font-mono bg-white p-3 neo-border-sm">
                <div className="font-bold border-b border-black pb-1 flex items-center justify-between text-[#008080]">
                  <span>💡 Poin Keaktifan ({course?.subject || 'Mapel'}):</span>
                  <span className="text-[10px] bg-amber-100 text-amber-900 px-1 py-0.2 neo-border-sm">
                    1 ⭐ = {xpPerStar} XP
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-zinc-700 pt-1">
                  <div className="flex items-center justify-between">
                    <span>• Menonton Video Materi</span>
                    <span className="font-bold text-emerald-800">+{currentStarSettings.defaultVideoXp} XP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>• Membaca Modul / PDF</span>
                    <span className="font-bold text-emerald-800">+{currentStarSettings.defaultPdfXp} XP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>• Mengumpulkan Tugas</span>
                    <span className="font-bold text-emerald-800">+{currentStarSettings.defaultAssignmentXp} XP</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>• Selesai Sebelum Deadline</span>
                    <span className="font-bold text-purple-800">+{currentStarSettings.onTimeBonusXp} XP Bonus</span>
                  </div>
                </div>
              </div>

              <Link href="/student/achievements" className="block pt-1">
                <RetroButton variant="white" size="sm" className="w-full">
                  Lihat Rapor Bintang Lengkap →
                </RetroButton>
              </Link>
            </div>
          </RetroWindow>

          {/* Sequential Rule Information Box */}
          <div className="bg-white neo-border neo-shadow-sm p-4 space-y-2 font-mono text-xs">
            <div className="font-bold text-sm text-black flex items-center gap-1.5 border-b-2 border-black pb-1">
              <span>ℹ️</span> ATURAN ALUR BERURUTAN
            </div>
            <p className="text-zinc-700 leading-relaxed">
              1. Bab 1 selalu dibuka pertama kali.<br />
              2. Bab selanjutnya hanya terbuka jika bab sebelumnya telah selesai dan memperoleh nilai minimal 75.<br />
              3. Kuis essay uraian membutuhkan konfirmasi koreksi nilai dari Guru.
            </p>
          </div>
        </div>
      </div>
      )}

      {/* MODAL RAPOR PDF PER BAB */}
      {selectedBabReport && (
        <BabReportPdfModal
          report={selectedBabReport}
          onClose={() => setSelectedBabReport(null)}
        />
      )}
    </div>
  );
}
