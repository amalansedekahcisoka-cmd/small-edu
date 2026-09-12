'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { DataProvider } from '@/lib/data/dataProvider';
import { ActivityLog, ClassRoom, User, Course, Chapter, UserCourseProgress } from '@/types';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { RetroBadge } from '@/components/ui/RetroBadge';
import {
  Activity,
  ArrowLeft,
  Clock,
  User as UserIcon,
  Filter,
  RefreshCw,
  Search,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Layers,
  Lock,
  Unlock,
  Check,
  X,
  FileText,
  File,
  Video,
  Link as LinkIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Award,
} from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function TeacherActivityLogPage() {
  const { user: authUser, isAuthorized, isLoading: isAuthLoading } = useAuthGuard({
    allowedRoles: ['teacher', 'admin'],
  });
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [progressMap, setProgressMap] = useState<Record<string, UserCourseProgress>>({});

  // Filter States
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    setLogs(DataProvider.getActivityLogs());
    setClasses(DataProvider.getClasses());
    setStudents(DataProvider.getUsers().filter((u) => u.role === 'student'));
    setCourses(DataProvider.getCourses());
  }, []);

  // Map user for fast lookup (fallback if log doesn't contain userClass)
  const userMap = useMemo(() => {
    const map = new Map<string, User>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const loadData = async (manual = false) => {
    if (manual) setIsSyncing(true);
    try {
      await DataProvider.syncWithServer();
      const me = DataProvider.getCurrentUser();
      const [allLogs, allClasses, allUsers, allCourses] = await Promise.all([
        DataProvider.getActivityLogsAsync(),
        DataProvider.getClassesAsync(),
        DataProvider.getUsersAsync(),
        DataProvider.getCoursesAsync(),
      ]);

      // Pastikan bab-bab materi tersinkronisasi untuk inspeksi progres siswa
      Promise.all(allCourses.map((c) => DataProvider.getChaptersAsync(c.id))).catch(() => {});

      // Dapatkan hanya kelas-kelas yang diampu oleh Guru yang sedang login
      let taughtClassNames: string[] = [];
      if (me?.assignedClasses && me.assignedClasses.length > 0) {
        taughtClassNames = me.assignedClasses;
      } else {
        const myCourses = allCourses.filter((c) => c.teacherId === me?.id);
        taughtClassNames = Array.from(
          new Set(myCourses.flatMap((c) => c.targetClasses || []))
        );
      }

      const normalize = (val?: string) =>
        (val || '').toLowerCase().replace(/kelas\s*/i, '').replace(/[-\s]/g, '').trim();
      const taughtNormalized = new Set(taughtClassNames.map(normalize));
      const myCourseIds = new Set(allCourses.filter((c) => c.teacherId === me?.id).map((c) => c.id));

      // Filter kelas yang diampu
      const relevantClasses =
        taughtClassNames.length > 0
          ? allClasses.filter((c) => taughtClassNames.includes(c.name) || taughtNormalized.has(normalize(c.name)))
          : allClasses;

      // Filter siswa dari kelas yang diampu
      const allStudents = allUsers.filter((u) => u.role === 'student');
      const relevantStudents =
        taughtClassNames.length > 0
          ? allStudents.filter(
              (s) =>
                s.gradeClass &&
                (taughtClassNames.includes(s.gradeClass) || taughtNormalized.has(normalize(s.gradeClass)))
            )
          : allStudents;

      // Filter log aktivitas hanya dari kelas atau materi milik guru yang bersangkutan
      const relevantLogs =
        me?.role === 'admin' || taughtClassNames.length === 0
          ? allLogs
          : allLogs.filter((l) => {
              // 1. Jika aktivitas pada materi pelajaran milik guru ini
              if (l.courseId && myCourseIds.has(l.courseId)) return true;
              // 2. Jika aktivitas oleh siswa pada kelas yang diampu
              const student = allUsers.find((u) => u.id === l.userId);
              const cls = l.userClass || student?.gradeClass;
              if (cls && (taughtClassNames.includes(cls) || taughtNormalized.has(normalize(cls)))) return true;
              // 3. Jika siswa tercatat di daftar siswa yang diajar
              if (relevantStudents.some((s) => s.id === l.userId)) return true;
              return false;
            });

      setLogs(relevantLogs);
      setClasses(relevantClasses);
      setStudents(relevantStudents);
      setCourses(allCourses.filter((c) => c.teacherId === me?.id || taughtClassNames.length === 0));
      setLastSyncTime(new Date().toLocaleTimeString('id-ID'));
    } catch (err) {
      console.error('Error syncing logs:', err);
    } finally {
      setIsLoading(false);
      if (manual) setTimeout(() => setIsSyncing(false), 600);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Ambil progres belajar siswa langsung dari Cloud Firestore saat siswa dipilih
  useEffect(() => {
    if (selectedStudentId !== 'ALL') {
      const student = students.find((s) => s.id === selectedStudentId);
      const studentCourses = courses.filter((c) => {
        if (!student?.gradeClass) return true;
        return !c.targetClasses || c.targetClasses.length === 0 || c.targetClasses.includes(student.gradeClass);
      });
      const pMap: Record<string, UserCourseProgress> = {};
      Promise.all(
        studentCourses.map(async (c) => {
          const p = await DataProvider.getUserProgressAsync(selectedStudentId, c.id);
          pMap[c.id] = p;
        })
      ).then(() => {
        setProgressMap((prev) => ({ ...prev, ...pMap }));
      }).catch(console.error);
    }
  }, [selectedStudentId, courses, students]);

  // Filter student dropdown options based on selected class
  const availableStudentsForDropdown = useMemo(() => {
    if (selectedClass === 'ALL') return students;
    return students.filter((s) => s.gradeClass === selectedClass);
  }, [students, selectedClass]);

  // If class changes, ensure selected student is valid
  const handleClassChange = (newClass: string) => {
    setSelectedClass(newClass);
    if (newClass !== 'ALL' && selectedStudentId !== 'ALL') {
      const student = students.find((s) => s.id === selectedStudentId);
      if (student && student.gradeClass !== newClass) {
        setSelectedStudentId('ALL');
      }
    }
  };

  const getStudentClass = (log: ActivityLog): string => {
    if (log.userClass) return log.userClass;
    const u = userMap.get(log.userId);
    return u?.gradeClass || 'Umum';
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const studentClass = getStudentClass(log);

      // Filter Kelas
      if (selectedClass !== 'ALL' && studentClass !== selectedClass) {
        return false;
      }

      // Filter Siswa
      if (selectedStudentId !== 'ALL' && log.userId !== selectedStudentId) {
        return false;
      }

      // Filter Kategori Aksi
      if (selectedCategory !== 'ALL') {
        const act = log.action.toUpperCase();
        if (selectedCategory === 'EXAM' && !act.includes('UJIAN') && !act.includes('EXAM') && !act.includes('KUIS')) {
          return false;
        }
        if (selectedCategory === 'MODULE' && !act.includes('MODUL') && !act.includes('PDF') && !act.includes('TEXT')) {
          return false;
        }
        if (selectedCategory === 'LINK' && !act.includes('TAUTAN') && !act.includes('LINK')) {
          return false;
        }
        if (selectedCategory === 'VIDEO' && !act.includes('VIDEO') && !act.includes('WATCH')) {
          return false;
        }
        if (
          selectedCategory === 'SUBMISSION' &&
          !act.includes('SUBMIT') &&
          !act.includes('ASSIGNMENT') &&
          !act.includes('TUGAS')
        ) {
          return false;
        }
        if (
          selectedCategory === 'STAR' &&
          !act.includes('STAR') &&
          !act.includes('BINTANG') &&
          !act.includes('XP')
        ) {
          return false;
        }
        if (
          selectedCategory === 'DEADLINE' &&
          !act.includes('DEADLINE') &&
          !act.includes('BATAS') &&
          !act.includes('TERKUNCI')
        ) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = log.userName.toLowerCase().includes(q);
        const matchDetails = log.details.toLowerCase().includes(q);
        const matchClass = studentClass.toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        if (!matchName && !matchDetails && !matchClass && !matchAction) {
          return false;
        }
      }

      return true;
    });
  }, [logs, selectedClass, selectedStudentId, selectedCategory, searchQuery, userMap]);

  // View Mode: 'grouped' (Accordion kartu per siswa - Simpel & Elegan) vs 'raw' (Semua Riwayat Log)
  const [viewMode, setViewMode] = useState<'grouped' | 'raw'>('grouped');
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());

  const toggleStudentExpand = (studentId: string) => {
    setExpandedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const expandAllStudents = () => {
    setExpandedStudentIds(new Set(students.map((s) => s.id)));
  };

  const collapseAllStudents = () => {
    setExpandedStudentIds(new Set());
  };

  // Group filtered logs by student with key milestones and statistics
  const studentGroupedData = useMemo(() => {
    const studentMap = new Map<string, {
      student: User;
      studentClass: string;
      logs: ActivityLog[];
      latestActivityTime: string;
      completedChaptersCount: number;
      examSubmissionsCount: number;
      starsCount: number;
      activityPoints: number;
    }>();

    // Inisialisasi daftar siswa yang relevan dengan filter
    const activeStudentList = students.filter((s) => {
      if (selectedClass !== 'ALL' && s.gradeClass !== selectedClass) return false;
      if (selectedStudentId !== 'ALL' && s.id !== selectedStudentId) return false;
      return true;
    });

    activeStudentList.forEach((s) => {
      studentMap.set(s.id, {
        student: s,
        studentClass: s.gradeClass || 'Umum',
        logs: [],
        latestActivityTime: '',
        completedChaptersCount: 0,
        examSubmissionsCount: 0,
        starsCount: s.starsCount || 0,
        activityPoints: s.activityPoints || 0,
      });
    });

    // Masukkan log ke masing-masing siswa
    filteredLogs.forEach((log) => {
      let group = studentMap.get(log.userId);
      if (!group) {
        // Siswa mungkin tidak ada di daftar siswa aktif tapi punya log
        const u = userMap.get(log.userId) || {
          id: log.userId,
          name: log.userName,
          role: 'student',
          gradeClass: getStudentClass(log),
        } as User;
        group = {
          student: u,
          studentClass: getStudentClass(log),
          logs: [],
          latestActivityTime: log.timestamp,
          completedChaptersCount: 0,
          examSubmissionsCount: 0,
          starsCount: u.starsCount || 0,
          activityPoints: u.activityPoints || 0,
        };
        studentMap.set(log.userId, group);
      }

      group.logs.push(log);
      if (!group.latestActivityTime || new Date(log.timestamp) > new Date(group.latestActivityTime)) {
        group.latestActivityTime = log.timestamp;
      }

      const act = log.action.toUpperCase();
      if (act.includes('COMPLETE') || act.includes('SELESAI') || act.includes('TUNTAS')) {
        group.completedChaptersCount++;
      }
      if (act.includes('SUBMIT') || act.includes('UJIAN')) {
        group.examSubmissionsCount++;
      }
    });

    // Urutkan siswa berdasarkan aktivitas terbaru
    return Array.from(studentMap.values()).sort((a, b) => {
      const timeA = a.latestActivityTime ? new Date(a.latestActivityTime).getTime() : 0;
      const timeB = b.latestActivityTime ? new Date(b.latestActivityTime).getTime() : 0;
      return timeB - timeA;
    });
  }, [filteredLogs, students, selectedClass, selectedStudentId, userMap]);

  // Selected student details for Susunan Materi & Progress inspector
  const activeStudent = useMemo(() => {
    if (selectedStudentId === 'ALL') return null;
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [selectedStudentId, students]);

  // Courses applicable for the selected student
  const studentApplicableCourses = useMemo(() => {
    if (!activeStudent) return [];
    return courses.filter((c) => {
      if (!c.targetClasses || c.targetClasses.length === 0) return true;
      if (!activeStudent.gradeClass) return true;
      return c.targetClasses.includes(activeStudent.gradeClass);
    });
  }, [activeStudent, courses]);

  const resetFilters = () => {
    setSelectedClass('ALL');
    setSelectedStudentId('ALL');
    setSelectedCategory('ALL');
    setSearchQuery('');
  };

  const getActionBadgeVariant = (action: string): 'teal' | 'green' | 'yellow' | 'blue' | 'purple' | 'gray' | 'red' => {
    const act = action.toUpperCase();
    if (act.includes('EARNED_STAR') || act.includes('BINTANG')) return 'yellow';
    if (act.includes('ACTIVITY_XP') || act.includes('XP_GAINED')) return 'teal';
    if (act.includes('DEADLINE') || act.includes('KEDALUWARSA')) return 'red';
    if (act.includes('LULUS') || act.includes('SELESAI') || act.includes('FINISHED')) return 'teal';
    if (act.includes('PENDING') || act.includes('WAITING')) return 'yellow';
    if (act.includes('REMEDIAL') || act.includes('FAILED')) return 'yellow';
    if (act.includes('WATCH') || act.includes('READ')) return 'blue';
    if (act.includes('SUBMIT') || act.includes('UPLOAD')) return 'purple';
    return 'gray';
  };

  const getChapterTypeBadge = (type: string) => {
    switch (type) {
      case 'pdf':
        return <RetroBadge variant="red" size="sm" icon={<File className="w-3 h-3" />}>PDF</RetroBadge>;
      case 'video':
        return <RetroBadge variant="purple" size="sm" icon={<Video className="w-3 h-3" />}>VIDEO</RetroBadge>;
      case 'link':
        return <RetroBadge variant="blue" size="sm" icon={<LinkIcon className="w-3 h-3" />}>LINK</RetroBadge>;
      case 'quiz':
        return <RetroBadge variant="teal" size="sm" icon={<Sparkles className="w-3 h-3" />}>UJIAN</RetroBadge>;
      default:
        return <RetroBadge variant="yellow" size="sm" icon={<FileText className="w-3 h-3" />}>TEKS</RetroBadge>;
    }
  };

  if (!mounted || isAuthLoading || !isAuthorized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center font-mono text-sm font-bold text-zinc-600 gap-2">
        <div className="w-8 h-8 border-4 border-[#008080] border-t-transparent animate-spin"></div>
        <span>Memverifikasi sesi rekam jejak guru...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Breadcrumb & Live Sync Indicator */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <RetroButton href="/teacher" variant="white" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
          Kembali ke Dashboard Guru
        </RetroButton>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold bg-[#008080] text-white px-2.5 py-1 neo-border-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            TERKONEKSI REAL-TIME API
          </span>
          {lastSyncTime && (
            <span className="text-[11px] font-mono text-zinc-600">
              Sinkron: {lastSyncTime}
            </span>
          )}
        </div>
      </div>

      {/* Main Filter & Selection Card */}
      <RetroWindow
        title="FILTER REKAM JEJAK: PEMILIHAN KELAS & NAMA SISWA"
        headerColor="navy"
        icon={<Filter className="w-4 h-4 text-yellow-300" />}
        actions={
          <button
            onClick={() => loadData(true)}
            title="Sinkronisasi Manual"
            disabled={isSyncing}
            className="text-xs bg-white text-black px-2.5 py-0.5 neo-border-sm font-mono font-bold hover:bg-zinc-100 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-teal-600' : ''}`} />
            <span>{isSyncing ? 'Menyinkron...' : 'Sinkron Sekarang'}</span>
          </button>
        }
      >
        <div className="space-y-4">
          <p className="text-xs font-mono text-zinc-700">
            Pilih <strong>Kelas</strong> dan <strong>Nama Siswa</strong> di bawah ini untuk memfilter rekam jejak aktivitas, 
            memeriksa kedisiplinan belajar, serta memantau perkembangan pada setiap <strong>susunan materi</strong> secara terarah.
          </p>

          {/* Filter Bar Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#fbf9f4] p-3 neo-border-sm">
            {/* 1. Pemilihan Kelas */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold flex items-center gap-1 text-black">
                <GraduationCap className="w-3.5 h-3.5 text-[#008080]" />
                <span>1. Pemilihan Kelas:</span>
              </label>
              <select
                value={selectedClass}
                onChange={(e) => handleClassChange(e.target.value)}
                className="w-full text-xs font-mono p-2 neo-border-sm bg-white font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#008080]"
              >
                <option value="ALL">🏫 Semua Kelas yang Diampu ({classes.length} Kelas)</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.name}>
                    {cls.name} {cls.gradeLevel ? `(${cls.gradeLevel})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Pemilihan Nama Siswa */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold flex items-center gap-1 text-black">
                <UserIcon className="w-3.5 h-3.5 text-[#008080]" />
                <span>2. Nama Siswa:</span>
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full text-xs font-mono p-2 neo-border-sm bg-white font-bold text-black focus:outline-none focus:ring-2 focus:ring-[#008080]"
              >
                <option value="ALL">
                  👤 Semua Siswa ({availableStudentsForDropdown.length} Siswa)
                </option>
                {availableStudentsForDropdown.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.gradeClass ? `[${s.gradeClass}]` : ''} {s.nisn_nip ? `(${s.nisn_nip})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Jenis Aktivitas Materi */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold flex items-center gap-1 text-black">
                <Layers className="w-3.5 h-3.5 text-[#008080]" />
                <span>3. Kategori Aktivitas:</span>
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full text-xs font-mono p-2 neo-border-sm bg-white text-black focus:outline-none"
              >
                <option value="ALL">Semua Aktivitas</option>
                <option value="STAR">⭐ Bintang & Poin Keaktifan (XP)</option>
                <option value="DEADLINE">⚠️ Batas Waktu & Kunci Otomatis</option>
                <option value="EXAM">Ujian, Kuis & Remedial</option>
                <option value="MODULE">Modul Bacaan & PDF</option>
                <option value="LINK">Tautan Materi Luar</option>
                <option value="VIDEO">Tontonan Video</option>
                <option value="SUBMISSION">Pengumpulan Portofolio</option>
              </select>
            </div>

            {/* 4. Pencarian Teks */}
            <div className="space-y-1">
              <label className="text-xs font-mono font-bold flex items-center gap-1 text-black">
                <Search className="w-3.5 h-3.5 text-[#008080]" />
                <span>4. Cari Rincian:</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari materi / keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs font-mono p-2 pr-7 neo-border-sm bg-white text-black focus:outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-zinc-400 hover:text-black"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Filter Info & Reset */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 font-mono text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-600">Menampilkan:</span>
              <span className="font-bold bg-[#ffde59] px-2 py-0.5 neo-border-sm">
                {filteredLogs.length} dari total {logs.length} catatan aktivitas
              </span>
              {selectedClass !== 'ALL' && (
                <span className="bg-blue-100 text-blue-900 px-2 py-0.5 neo-border-sm font-bold">
                  Kelas: {selectedClass}
                </span>
              )}
              {activeStudent && (
                <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 neo-border-sm font-bold">
                  Siswa: {activeStudent.name}
                </span>
              )}
            </div>

            {(selectedClass !== 'ALL' || selectedStudentId !== 'ALL' || selectedCategory !== 'ALL' || searchQuery) && (
              <button
                onClick={resetFilters}
                className="text-xs bg-zinc-200 hover:bg-zinc-300 text-black px-2 py-1 neo-border-sm font-bold transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>
        </div>
      </RetroWindow>

      {/* SUSUNAN MATERI SISWA (Khusus jika 1 Siswa Spesifik Dipilih) */}
      {activeStudent && (
        <RetroWindow
          title={`INSPEKSI SUSUNAN MATERI: ${activeStudent.name.toUpperCase()} (${activeStudent.gradeClass || 'KELAS UMUM'})`}
          headerColor="mustard"
          icon={<BookOpen className="w-4 h-4 text-black" />}
        >
          <div className="space-y-4">
            <div className="bg-white neo-border-sm p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-black">{activeStudent.name}</span>
                  <RetroBadge variant="teal" size="sm">
                    {activeStudent.gradeClass || 'Kelas Terdaftar'}
                  </RetroBadge>
                </div>
                <div className="text-zinc-600">
                  NISN: <strong>{activeStudent.nisn_nip || '-'}</strong> • Email: {activeStudent.email}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-[#FFE169] px-3 py-1 neo-border-sm font-bold text-black flex items-center gap-1">
                  ⭐ {activeStudent.starsCount || 0} Bintang Prestasi
                </span>
                <span className="bg-[#e6fffa] text-teal-900 border border-teal-700 px-3 py-1 neo-border-sm font-bold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-teal-700" />
                  {activeStudent.activityPoints || 0} Poin Keaktifan (XP)
                </span>
              </div>
            </div>

            {studentApplicableCourses.length === 0 ? (
              <div className="p-6 bg-white neo-border text-center font-mono text-xs text-zinc-500">
                Tidak ada mata pelajaran / kursus yang ditujukan untuk kelas {activeStudent.gradeClass}.
              </div>
            ) : (
              <div className="space-y-4">
                {studentApplicableCourses.map((course) => {
                  const courseChapters = DataProvider.getChapters(course.id);
                  const progress: UserCourseProgress = progressMap[course.id] || DataProvider.getUserProgress(activeStudent.id, course.id);
                  const completedCount = courseChapters.filter(
                    (ch) => progress.chapters && progress.chapters[ch.id]?.is_completed
                  ).length;
                  const percent = courseChapters.length > 0 ? Math.round((completedCount / courseChapters.length) * 100) : 0;

                  return (
                    <div key={course.id} className="bg-white neo-border p-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-black">
                        <div>
                          <span className="text-[11px] font-mono text-zinc-600 font-bold uppercase">
                            {course.subject} • {course.gradeLevel}
                          </span>
                          <h4 className="text-base font-black text-black">{course.title}</h4>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <span className="font-bold text-teal-800">
                            Progres: {completedCount} / {courseChapters.length} Bab ({percent}%)
                          </span>
                        </div>
                      </div>

                      {/* Susunan Bab Materi List */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {courseChapters.map((ch) => {
                          const chProgress = progress.chapters?.[ch.id];
                          const isCompleted = !!chProgress?.is_completed;
                          const isUnlocked = chProgress?.status === 'unlocked' || ch.order_index === 1;
                          const score = chProgress?.score;

                          // Periksa status batas waktu materi
                          let isDeadlinePassed = false;
                          if (ch.schedule?.isEnabled && ch.schedule.endDate && !isCompleted) {
                            const end = new Date(ch.schedule.endDate);
                            end.setHours(23, 59, 59, 999);
                            if (new Date() > end) {
                              isDeadlinePassed = true;
                            }
                          }

                          return (
                            <div
                              key={ch.id}
                              className={`p-3 neo-border-sm text-xs font-mono space-y-1.5 transition-all ${
                                isCompleted
                                  ? 'bg-emerald-50 border-emerald-800'
                                  : isDeadlinePassed
                                  ? 'bg-red-50 border-red-700 shadow-xs'
                                  : isUnlocked
                                  ? 'bg-yellow-50 border-yellow-800'
                                  : 'bg-zinc-100 opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-zinc-700">Bab #{ch.order_index}</span>
                                <div className="flex items-center gap-1">
                                  {isDeadlinePassed && (
                                    <span className="bg-red-600 text-white px-1.5 py-0.2 text-[9px] font-bold">
                                      DEADLINE LEWAT
                                    </span>
                                  )}
                                  {getChapterTypeBadge(ch.type)}
                                </div>
                              </div>
                              <p className="font-bold text-black line-clamp-1">{ch.title}</p>
                              {ch.schedule?.isEnabled && ch.schedule.endDate && (
                                <p className="text-[10px] text-zinc-500">
                                  Batas: {new Date(ch.schedule.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </p>
                              )}
                              <div className="flex items-center justify-between pt-1 border-t border-black/10 text-[11px]">
                                <span className="flex items-center gap-1 font-bold">
                                  {isCompleted ? (
                                    <>
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="text-emerald-800">Lulus ({score ?? 100})</span>
                                    </>
                                  ) : isDeadlinePassed ? (
                                    <>
                                      <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                      <span className="text-red-700 font-bold">Terkunci (Melewati Waktu)</span>
                                    </>
                                  ) : isUnlocked ? (
                                    <>
                                      <Unlock className="w-3.5 h-3.5 text-amber-600" />
                                      <span className="text-amber-800">Terbuka</span>
                                    </>
                                  ) : (
                                    <>
                                      <Lock className="w-3.5 h-3.5 text-zinc-500" />
                                      <span className="text-zinc-500">Terkunci</span>
                                    </>
                                  )}
                                </span>
                                <span className="text-zinc-500 text-[10px]">
                                  Target: {ch.passing_grade || 75}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </RetroWindow>
      )}

      {/* Bagian Jurnal Rekam Jejak Belajar Siswa */}
      <RetroWindow
        title={`JURNAL KEAKTIFAN BELAJAR SISWA (${studentGroupedData.length} SISWA TERPANTAU)`}
        headerColor="navy"
        icon={<Activity className="w-4 h-4 text-yellow-300" />}
        actions={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('grouped')}
              className={`px-2 py-0.5 text-xs font-mono font-bold neo-border-sm transition-all ${
                viewMode === 'grouped' ? 'bg-[#ffde59] text-black' : 'bg-white text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              👥 Kartu per Siswa
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2 py-0.5 text-xs font-mono font-bold neo-border-sm transition-all ${
                viewMode === 'raw' ? 'bg-[#ffde59] text-black' : 'bg-white text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              📋 Riwayat Detail ({filteredLogs.length})
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Header Kontrol Tampilan Kartu Siswa */}
          {viewMode === 'grouped' && (
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono border-b border-black/10 pb-2">
              <span className="text-zinc-600">
                Menampilkan rekam jejak ringkas per siswa. Klik kartu siswa untuk membuka / menutup rincian aktivitasnya.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={expandAllStudents}
                  className="px-2 py-1 bg-white hover:bg-zinc-100 neo-border-sm font-bold text-[11px]"
                >
                  Buka Semua Dropdown
                </button>
                <button
                  onClick={collapseAllStudents}
                  className="px-2 py-1 bg-white hover:bg-zinc-100 neo-border-sm font-bold text-[11px]"
                >
                  Tutup Semua
                </button>
              </div>
            </div>
          )}

          {/* TAMPILAN 1: KARTU SISWA ELEGAN & COLLAPSIBLE (DEFAULT) */}
          {viewMode === 'grouped' && (
            <div className="space-y-3">
              {studentGroupedData.length === 0 ? (
                <div className="p-8 text-center bg-white neo-border font-mono text-zinc-500 text-xs">
                  Tidak ditemukan aktivitas siswa dengan filter yang dipilih.
                </div>
              ) : (
                studentGroupedData.map((item) => {
                  const isExpanded = expandedStudentIds.has(item.student.id);
                  const hasLogs = item.logs.length > 0;

                  return (
                    <div
                      key={item.student.id}
                      className={`neo-border transition-all bg-white overflow-hidden ${
                        isExpanded ? 'neo-shadow-sm ring-1 ring-black' : 'hover:bg-zinc-50'
                      }`}
                    >
                      {/* Kartu Ringkasan Siswa (Header Accordion) */}
                      <div
                        onClick={() => toggleStudentExpand(item.student.id)}
                        className="p-3.5 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#fcfaf5] border-b border-black/10"
                      >
                        <div className="flex items-center gap-3">
                          {/* Inisial Avatar */}
                          <div className="w-10 h-10 neo-border-sm bg-[#008080] text-white flex items-center justify-center font-mono font-black text-sm shrink-0">
                            {item.student.name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-black text-sm text-black">
                                {item.student.name}
                              </h4>
                              <span className="px-1.5 py-0.2 bg-blue-100 text-blue-900 border border-blue-400 font-mono text-[10px] font-bold">
                                {item.studentClass}
                              </span>
                              {item.student.nisn_nip && (
                                <span className="text-[10px] font-mono text-zinc-500">
                                  NISN: {item.student.nisn_nip}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-zinc-600 flex items-center gap-3 mt-1 flex-wrap">
                              <span>
                                🕒 Terakhir Aktif:{' '}
                                <strong>
                                  {item.latestActivityTime
                                    ? new Date(item.latestActivityTime).toLocaleString('id-ID', {
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : 'Belum ada'}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                📝 Total Aktivitas: <strong>{item.logs.length} kali</strong>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Statistik Singkat & Indikator Dropdown */}
                        <div className="flex items-center gap-3 self-end md:self-center">
                          <div className="flex items-center gap-2 font-mono text-xs">
                            <span className="px-2 py-1 bg-amber-100 text-amber-950 border border-amber-400 font-bold flex items-center gap-1">
                              ⭐ {item.starsCount} Bintang
                            </span>
                            <span className="px-2 py-1 bg-teal-50 text-teal-950 border border-teal-400 font-bold flex items-center gap-1">
                              ⚡ {item.activityPoints} XP
                            </span>
                          </div>

                          <div className="w-7 h-7 neo-border-sm bg-white flex items-center justify-center text-black">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-black" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-black" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Dropdown Isi: Timeline Aktivitas Penting Siswa */}
                      {isExpanded && (
                        <div className="p-4 bg-white space-y-3 font-mono">
                          <div className="flex items-center justify-between text-xs border-b border-black/10 pb-2">
                            <span className="font-bold text-zinc-700 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#008080]" />
                              Riwayat & Milestone Belajar Terverifikasi ({item.logs.length}):
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedStudentId(item.student.id);
                                if (item.studentClass && item.studentClass !== 'Umum') {
                                  setSelectedClass(item.studentClass);
                                }
                              }}
                              className="text-[11px] text-[#008080] hover:underline font-bold"
                            >
                              🔍 Periksa Detail Susunan Materi Bab →
                            </button>
                          </div>

                          {item.logs.length === 0 ? (
                            <div className="text-xs text-zinc-500 italic p-3 text-center bg-zinc-50">
                              Belum ada catatan aktivitas untuk siswa ini.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                              {item.logs.map((log) => {
                                const isStar = log.action.includes('STAR') || log.action.includes('BINTANG') || log.action.includes('XP');
                                const isExam = log.action.includes('EXAM') || log.action.includes('UJIAN') || log.action.includes('SUBMIT');
                                const isPass = log.details.includes('Tuntas') || log.details.includes('Lulus');

                                return (
                                  <div
                                    key={log.id}
                                    className={`p-2.5 neo-border-sm text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                                      isStar
                                        ? 'bg-amber-50 border-amber-300'
                                        : isExam && isPass
                                        ? 'bg-emerald-50 border-emerald-300'
                                        : isExam
                                        ? 'bg-purple-50 border-purple-300'
                                        : 'bg-[#fbf9f4]'
                                    }`}
                                  >
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <RetroBadge variant={getActionBadgeVariant(log.action)} size="sm">
                                          {log.action}
                                        </RetroBadge>
                                        <span className="text-[11px] text-zinc-500">
                                          {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                          })} WIB
                                        </span>
                                      </div>
                                      <p className="font-sans text-xs text-zinc-900 leading-snug">
                                        {log.details}
                                      </p>
                                    </div>

                                    <div className="text-[10px] text-zinc-500 shrink-0 text-right">
                                      {new Date(log.timestamp).toLocaleDateString('id-ID', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAMPILAN 2: TABEL RIWAYAT RAW / LENGKAP (BISA DIAKSES JIKA DIBUTUHKAN) */}
          {viewMode === 'raw' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono neo-border">
                <thead className="bg-[#dfdbd2] border-b-2 border-black">
                  <tr>
                    <th className="p-3 whitespace-nowrap">Waktu (WIB)</th>
                    <th className="p-3 whitespace-nowrap">Kelas</th>
                    <th className="p-3 whitespace-nowrap">Nama Siswa</th>
                    <th className="p-3 whitespace-nowrap">Aksi Sistem</th>
                    <th className="p-3">Rincian Aktivitas & Materi Terkait</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center bg-white text-zinc-500 font-mono">
                        Tidak ditemukan aktivitas yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => {
                      const studentClass = getStudentClass(log);
                      return (
                        <tr
                          key={log.id}
                          className={`border-b border-black hover:bg-yellow-50 transition-colors ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-[#fbf9f4]'
                          }`}
                        >
                          <td className="p-3 whitespace-nowrap text-zinc-600">
                            {new Date(log.timestamp).toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-bold px-2 py-0.5 bg-blue-100 text-blue-900 neo-border-sm text-[11px]">
                              {studentClass}
                            </span>
                          </td>
                          <td className="p-3 whitespace-nowrap font-bold text-black">
                            {log.userName}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <RetroBadge variant={getActionBadgeVariant(log.action)} size="sm">
                              {log.action}
                            </RetroBadge>
                          </td>
                          <td className="p-3 font-sans text-xs text-zinc-800 leading-relaxed">
                            {log.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </RetroWindow>
    </div>
  );
}
