'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { DataProvider, DEFAULT_STAR_SETTINGS } from '@/lib/data/dataProvider';
import { Course, Chapter, ChapterType, Submission, User, CourseStarSettings, Question } from '@/types';
import { exportBabReportToExcel } from '@/lib/export/excelExporter';
import { QuestionBuilderModal } from '@/components/teacher/QuestionBuilderModal';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { RetroBadge } from '@/components/ui/RetroBadge';
import {
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Plus,
  FileText,
  File,
  Video,
  Link as LinkIcon,
  Trash2,
  Edit3,
  CheckCircle2,
  Lock,
  ArrowRight,
  Eye,
  AlertCircle,
  HelpCircle,
  X,
  Layers,
  Activity,
  FolderOpen,
  Sparkles,
  Calendar,
  Clock,
  Star,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';

export default function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [pendingSubs, setPendingSubs] = useState<Submission[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // State Modal Konfirmasi Hapus (Retro)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: 'chapter' | 'course';
    id: string;
    name: string;
  } | null>(null);

  // State Modal Tambah / Edit Bab
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);

  // Hierarchy Modal States (Buku: BAB -> Sub-Bab -> Tugas)
  const [modalMode, setModalMode] = useState<'new_bab' | 'sub_chapter' | 'assignment' | 'edit'>('new_bab');
  const [babNumberInput, setBabNumberInput] = useState<number>(1);
  const [babTitleInput, setBabTitleInput] = useState<string>('');
  const [subChapterNumInput, setSubChapterNumInput] = useState<string>('1.1');
  const [itemCategoryInput, setItemCategoryInput] = useState<'sub_chapter' | 'assignment'>('sub_chapter');
  const [targetSubChapterId, setTargetSubChapterId] = useState<string>('');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [orderIndex, setOrderIndex] = useState<number>(1);
  const [chapterType, setChapterType] = useState<ChapterType>('text');
  const [passingGrade, setPassingGrade] = useState<number>(75);

  // Content specific fields
  const [textContent, setTextContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [assignmentPrompt, setAssignmentPrompt] = useState('');

  // Rentang Waktu Aktif State (Schedule Window)
  const [scheduleEnabled, setScheduleEnabled] = useState<boolean>(false);
  const [scheduleStartDate, setScheduleStartDate] = useState<string>('');
  const [scheduleEndDate, setScheduleEndDate] = useState<string>('');

  // Kustomisasi Poin Keaktifan Khusus Bab / Tugas
  const [activityRewardPoints, setActivityRewardPoints] = useState<string>('');

  // State Modal Pengaturan Poin Bintang Kursus
  const [isStarSettingsModalOpen, setIsStarSettingsModalOpen] = useState(false);
  const [starSettingsForm, setStarSettingsForm] = useState<CourseStarSettings>(DEFAULT_STAR_SETTINGS);

  // Question Builder States
  const [questionsInput, setQuestionsInput] = useState<Question[]>([]);
  const [isQuestionBuilderOpen, setIsQuestionBuilderOpen] = useState<boolean>(false);

  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [newCourseSubject, setNewCourseSubject] = useState('');
  const [newCourseGrade, setNewCourseGrade] = useState('Kelas X');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseTargetClasses, setNewCourseTargetClasses] = useState<string[]>([]);

  // Daftar kelas yang tersedia di sistem
  const [availableClasses, setAvailableClasses] = useState<import('@/types').ClassRoom[]>([]);
  const [courseClassFilter, setCourseClassFilter] = useState<string>('ALL');

  const loadData = (courseToSelect?: Course) => {
    const currentUser = DataProvider.getCurrentUser();
    setUser(currentUser);
    const allCourses = DataProvider.getCourses();
    setCourses(allCourses);

    // Muat daftar kelas dari sistem
    const classList = DataProvider.getClasses();
    setAvailableClasses(classList);

    let currentC = courseToSelect || selectedCourse;
    if (!currentC && allCourses.length > 0) {
      currentC = allCourses[0];
    }

    if (currentC) {
      setSelectedCourse(currentC);
      const chs = DataProvider.getChapters(currentC.id);
      setChapters(chs);
    } else {
      setSelectedCourse(null);
      setChapters([]);
    }

    const subs = DataProvider.getSubmissions().filter((s) => s.status === 'pending');
    setPendingSubs(subs);
  };

  useEffect(() => {
    loadData();
    DataProvider.getCoursesAsync().then((serverCourses) => {
      if (serverCourses && serverCourses.length > 0) {
        setCourses(serverCourses);
      }
    });
    DataProvider.getSubmissionsAsync().then((serverSubs) => {
      if (serverSubs) {
        setPendingSubs(serverSubs.filter((s) => s.status === 'pending'));
      }
    });
    DataProvider.getClassesAsync().then((serverClasses) => {
      if (serverClasses && serverClasses.length > 0) {
        setAvailableClasses(serverClasses);
      }
    });
  }, []);

  const handleSelectCourse = (c: Course) => {
    setSelectedCourse(c);
    setChapters(DataProvider.getChapters(c.id));
  };

  // Strukturkan materi-materi ke dalam hierarki buku: BAB -> Sub-Bab -> Tugas
  const babGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        babNumber: number;
        babTitle: string;
        subChapters: { main: Chapter; assignments: Chapter[] }[];
        standaloneAssignments: Chapter[];
      }
    >();

    chapters.forEach((ch) => {
      let bNum = ch.babNumber;
      let bTitle = ch.babTitle;

      if (!bNum || !bTitle) {
        const match = ch.title.match(/BAB\s*(\d+)[:\s-]*(.*)/i);
        if (match) {
          bNum = parseInt(match[1], 10) || 1;
          bTitle = `BAB ${bNum}: ${match[2] || ch.title}`;
        } else if (ch.title.toUpperCase().startsWith('TUGAS')) {
          bNum = 1;
          bTitle = `BAB 1: ${selectedCourse?.title || 'Dasar Pembelajaran'}`;
        } else {
          bNum = 1;
          bTitle = `BAB 1: ${selectedCourse?.title || 'Dasar Pembelajaran'}`;
        }
      }

      const key = `BAB_${bNum}_${bTitle}`;
      if (!map.has(key)) {
        map.set(key, {
          babNumber: bNum,
          babTitle: bTitle,
          subChapters: [],
          standaloneAssignments: [],
        });
      }

      const group = map.get(key)!;
      const isAssignment =
        ch.itemCategory === 'assignment' ||
        ch.type === 'assignment' ||
        ch.title.toUpperCase().startsWith('TUGAS') ||
        !!ch.parentSubChapterId;

      if (isAssignment) {
        if (ch.parentSubChapterId) {
          const parent = group.subChapters.find((s) => s.main.id === ch.parentSubChapterId);
          if (parent) {
            parent.assignments.push(ch);
          } else {
            group.standaloneAssignments.push(ch);
          }
        } else if (group.subChapters.length > 0) {
          group.subChapters[group.subChapters.length - 1].assignments.push(ch);
        } else {
          group.standaloneAssignments.push(ch);
        }
      } else {
        group.subChapters.push({
          main: ch,
          assignments: [],
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.babNumber - b.babNumber);
  }, [chapters, selectedCourse]);

  // Helper hitung default XP per jenis materi
  const getDefaultXpForType = (type: ChapterType) => {
    const settings = selectedCourse?.starSettings || DEFAULT_STAR_SETTINGS;
    switch (type) {
      case 'video':
        return settings.defaultVideoXp ?? 25;
      case 'pdf':
        return settings.defaultPdfXp ?? 20;
      case 'text':
        return settings.defaultTextXp ?? 20;
      case 'link':
        return settings.defaultLinkXp ?? 15;
      case 'assignment':
        return settings.defaultAssignmentXp ?? 30;
      case 'quiz':
        return settings.defaultQuizXp ?? 30;
      default:
        return 20;
    }
  };

  // Open Modal Pengaturan Bintang Mata Pelajaran
  const handleOpenStarSettings = (c: Course) => {
    const settings = DataProvider.getCourseStarSettings(c.id);
    setStarSettingsForm(settings);
    setIsStarSettingsModalOpen(true);
  };

  // Simpan Pengaturan Bintang Mata Pelajaran
  const handleSaveStarSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    const updated = DataProvider.updateCourseStarSettings(selectedCourse.id, starSettingsForm);
    setSelectedCourse({ ...selectedCourse, starSettings: updated });
    setCourses((prev) =>
      prev.map((c) => (c.id === selectedCourse.id ? { ...c, starSettings: updated } : c))
    );
    setIsStarSettingsModalOpen(false);
    setNotification('Pengaturan Skor Bintang & Poin Keaktifan berhasil diperbarui! ⭐');
    setTimeout(() => setNotification(null), 5000);
  };

  // Open Modal untuk Buat BAB Baru
  const handleOpenAddBabModal = () => {
    if (!selectedCourse) return;
    setEditingChapterId(null);
    setModalMode('new_bab');
    const nextBab = babGroups.length > 0 ? Math.max(...babGroups.map((b) => b.babNumber)) + 1 : 1;
    const nextOrder = chapters.length > 0 ? Math.max(...chapters.map((c) => c.order_index)) + 1 : 1;

    setBabNumberInput(nextBab);
    setBabTitleInput(`BAB ${nextBab}: `);
    setSubChapterNumInput(`${nextBab}.1`);
    setItemCategoryInput('sub_chapter');
    setTargetSubChapterId('');

    setTitle(`Sub-Bab ${nextBab}.1: `);
    setDescription('');
    setOrderIndex(nextOrder);
    setChapterType('pdf');
    setPassingGrade(75);
    setTextContent('');
    setFileUrl('');
    setExternalUrl('');
    setVideoUrl('');
    setAssignmentPrompt('');
    setActivityRewardPoints('');
    setScheduleEnabled(false);
    setScheduleStartDate('');
    setScheduleEndDate('');
    setQuestionsInput([]);
    setIsModalOpen(true);
  };

  // Open Modal untuk Tambah Sub-Bab Pembahasan
  const handleOpenAddSubChapterModal = (bNum: number, bTitle: string) => {
    if (!selectedCourse) return;
    setEditingChapterId(null);
    setModalMode('sub_chapter');
    const bab = babGroups.find((b) => b.babNumber === bNum);
    const nextSubIndex = (bab?.subChapters.length || 0) + 1;
    const nextOrder = chapters.length > 0 ? Math.max(...chapters.map((c) => c.order_index)) + 1 : 1;

    setBabNumberInput(bNum);
    setBabTitleInput(bTitle);
    setSubChapterNumInput(`${bNum}.${nextSubIndex}`);
    setItemCategoryInput('sub_chapter');
    setTargetSubChapterId('');

    setTitle(`Sub-Bab ${bNum}.${nextSubIndex}: `);
    setDescription('');
    setOrderIndex(nextOrder);
    setChapterType('pdf');
    setPassingGrade(75);
    setTextContent('');
    setFileUrl('');
    setExternalUrl('');
    setVideoUrl('');
    setAssignmentPrompt('');
    setActivityRewardPoints('');
    setScheduleEnabled(false);
    setScheduleStartDate('');
    setScheduleEndDate('');
    setQuestionsInput([]);
    setIsModalOpen(true);
  };

  // Open Modal untuk Tambah Tugas Sub-Bab
  const handleOpenAddAssignmentModal = (bNum: number, bTitle: string, parentSubId?: string) => {
    if (!selectedCourse) return;
    setEditingChapterId(null);
    setModalMode('assignment');
    const nextOrder = chapters.length > 0 ? Math.max(...chapters.map((c) => c.order_index)) + 1 : 1;

    const parentSub = chapters.find((c) => c.id === parentSubId);
    const subNum = parentSub?.subChapterNumber || `${bNum}.1`;

    setBabNumberInput(bNum);
    setBabTitleInput(bTitle);
    setSubChapterNumInput(subNum);
    setItemCategoryInput('assignment');
    setTargetSubChapterId(parentSubId || '');

    setTitle(`Tugas Praktik ${subNum}: `);
    setDescription('');
    setOrderIndex(nextOrder);
    setChapterType('link');
    setPassingGrade(80);
    setTextContent('');
    setFileUrl('');
    setExternalUrl('');
    setVideoUrl('');
    setAssignmentPrompt('');
    setActivityRewardPoints('');
    setScheduleEnabled(false);
    setScheduleStartDate('');
    setScheduleEndDate('');
    setQuestionsInput([]);
    setIsModalOpen(true);
  };

  // Open Modal untuk Edit
  const handleOpenEditModal = (ch: Chapter) => {
    setEditingChapterId(ch.id);
    setModalMode('edit');
    setTitle(ch.title);
    setDescription(ch.description || '');
    setOrderIndex(ch.order_index);
    setChapterType(ch.type);
    setPassingGrade(ch.passing_grade || 75);

    setBabNumberInput(ch.babNumber || 1);
    setBabTitleInput(ch.babTitle || `BAB ${ch.babNumber || 1}`);
    setSubChapterNumInput(ch.subChapterNumber || '1.1');
    setItemCategoryInput(ch.itemCategory || (ch.type === 'assignment' ? 'assignment' : 'sub_chapter'));
    setTargetSubChapterId(ch.parentSubChapterId || '');

    setTextContent(ch.textContent || '');
    setFileUrl(ch.fileUrl || '');
    setExternalUrl(ch.externalUrl || '');
    setVideoUrl(ch.videoUrl || '');
    setAssignmentPrompt(ch.assignmentPrompt || '');
    setActivityRewardPoints(ch.activityRewardPoints !== undefined ? String(ch.activityRewardPoints) : '');

    // Jadwal
    setScheduleEnabled(!!ch.schedule?.isEnabled);
    setScheduleStartDate(ch.schedule?.startDate ? ch.schedule.startDate.split('T')[0] : '');
    setScheduleEndDate(ch.schedule?.endDate ? ch.schedule.endDate.split('T')[0] : '');

    // Questions
    setQuestionsInput(ch.questions ? JSON.parse(JSON.stringify(ch.questions)) : []);

    setIsModalOpen(true);
  };

  // Simpan Bab Baru atau Perbarui Bab
  const handleSaveChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !title.trim()) return;

    const nextOrder = editingChapterId
      ? orderIndex
      : chapters.length > 0
      ? Math.max(...chapters.map((c) => c.order_index)) + 1
      : 1;

    const scheduleData = scheduleEnabled
      ? {
          isEnabled: true,
          startDate: scheduleStartDate ? new Date(scheduleStartDate).toISOString() : undefined,
          endDate: scheduleEndDate ? new Date(scheduleEndDate).toISOString() : undefined,
        }
      : undefined;

    const chapterPayload: Omit<Chapter, 'id'> = {
      courseId: selectedCourse.id,
      title: title.trim(),
      description: description.trim(),
      order_index: Number(nextOrder),
      type: chapterType,
      passing_grade: Number(passingGrade),
      babNumber: Number(babNumberInput),
      babTitle: babTitleInput.trim() || `BAB ${babNumberInput}`,
      subChapterNumber: subChapterNumInput.trim() || undefined,
      itemCategory: itemCategoryInput,
      parentSubChapterId: targetSubChapterId || undefined,
      textContent: chapterType === 'text' ? textContent.trim() : undefined,
      fileUrl: chapterType === 'pdf' ? fileUrl.trim() : undefined,
      externalUrl: chapterType === 'link' ? externalUrl.trim() : undefined,
      videoUrl: chapterType === 'video' ? videoUrl.trim() : undefined,
      assignmentPrompt: chapterType === 'assignment' ? assignmentPrompt.trim() : undefined,
      activityRewardPoints: activityRewardPoints.trim() ? Math.max(1, Number(activityRewardPoints)) : undefined,
      schedule: scheduleData,
      questions: questionsInput.length > 0 ? questionsInput : undefined,
    };

    if (editingChapterId) {
      // Update
      DataProvider.updateChapter(editingChapterId, chapterPayload);
      setNotification(`Materi "${title.trim()}" berhasil diperbarui!`);
    } else {
      // Tambah Baru
      DataProvider.addChapter(chapterPayload);
      setNotification(`Berhasil menambahkan "${title.trim()}" ke dalam ${babTitleInput}!`);
    }

    setIsModalOpen(false);
    loadData();
    setTimeout(() => setNotification(null), 5000);
  };

  // Hapus Bab
  const handleDeleteChapter = (ch: Chapter) => {
    setDeleteConfirm({ type: 'chapter', id: ch.id, name: ch.title });
  };

  // Hapus Kursus
  const handleDeleteCourse = (c: Course) => {
    setDeleteConfirm({ type: 'course', id: c.id, name: c.title });
  };

  const executeDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'chapter') {
      DataProvider.deleteChapter(deleteConfirm.id);
      setNotification(`Materi "${deleteConfirm.name}" telah dihapus.`);
    } else if (deleteConfirm.type === 'course') {
      DataProvider.deleteCourse(deleteConfirm.id);
      if (selectedCourse?.id === deleteConfirm.id) {
        setSelectedCourse(null);
        setChapters([]);
      }
      setNotification(`Mata Pelajaran "${deleteConfirm.name}" beserta seluruh materinya telah dihapus.`);
    }
    setDeleteConfirm(null);
    loadData();
    setTimeout(() => setNotification(null), 5000);
  };

  // Tambah Kursus Baru
  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseTitle.trim() || !newCourseSubject.trim()) return;
    if (newCourseTargetClasses.length === 0) {
      alert('Pilih minimal satu kelas target terlebih dahulu.');
      return;
    }

    const created = DataProvider.addCourse({
      title: newCourseTitle.trim(),
      subject: newCourseSubject.trim(),
      gradeLevel: newCourseGrade,
      description: newCourseDesc.trim() || 'Mata pelajaran pembelajaran mandiri berurutan.',
      thumbnailBg: '#FFE169',
      teacherId: user?.id || 'user-teacher-rudiansyah',
      teacherName: user?.name || 'Guru',
      chaptersCount: 0,
      isPublished: true,
      targetClasses: newCourseTargetClasses,
    });

    setNotification(`Mata pelajaran "${created.title}" berhasil dibuat untuk kelas: ${newCourseTargetClasses.join(', ')}!`);
    setIsCourseModalOpen(false);
    setNewCourseTitle('');
    setNewCourseSubject('');
    setNewCourseDesc('');
    setNewCourseTargetClasses([]);
    loadData(created);
    setTimeout(() => setNotification(null), 6000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="p-4 bg-[#79f2c0] neo-border neo-shadow-sm font-mono text-xs sm:text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-950 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Teacher Header Banner */}
      <div className="bg-[#4ecdc4] neo-border neo-shadow-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase bg-black text-white px-2 py-0.5">
              PANEL KELOLA GURU
            </span>
            <span className="text-xs font-mono font-bold">{user?.nisn_nip || 'NIP Terdaftar'}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-black">
            Selamat Bertugas, {user?.name || 'Guru Pembimbing'}! 📚
          </h1>
          <p className="text-sm text-zinc-900 max-w-2xl font-sans">
            Kelola materi ajar, modul PDF, tautan, dan penugasan siswa dengan alur belajar berurutan bergaya Moodle.
          </p>
        </div>

        {/* Action Shortcuts */}
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/teacher/activity-log">
            <RetroButton
              variant="white"
              size="md"
              icon={<Activity className="w-4 h-4 text-[#008080]" />}
            >
              Log Aktivitas Siswa
            </RetroButton>
          </Link>
          <Link href="/teacher/grading">
            <RetroButton
              variant="yellow"
              size="md"
              icon={<ClipboardCheck className="w-4 h-4" />}
            >
              Meja Koreksi ({pendingSubs.length} Menunggu)
            </RetroButton>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Course List & Selector */}
        <div className="space-y-4">
          <RetroWindow
            title="MATA PELAJARAN / KURSUS"
            headerColor="gray"
            icon={<GraduationCap className="w-4 h-4" />}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b-2 border-black font-mono text-xs">
                <span className="font-bold">Daftar Kursus ({courses.length})</span>
                <button
                  onClick={() => setIsCourseModalOpen(true)}
                  className="text-xs bg-black text-[#ffde59] px-2 py-1 font-mono font-bold hover:bg-zinc-800 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Tambah
                </button>
              </div>

              {/* Filter Kelas Kursus */}
              <div className="bg-[#fbf9f4] p-2 neo-border-sm space-y-1">
                <label className="text-[11px] font-mono font-bold text-zinc-700 block">
                  Pilih / Filter Kelas:
                </label>
                <select
                  value={courseClassFilter}
                  onChange={(e) => setCourseClassFilter(e.target.value)}
                  className="w-full text-xs font-mono p-1.5 neo-border-sm bg-white font-bold text-black focus:outline-none"
                >
                  <option value="ALL">🏫 Semua Kelas</option>
                  {availableClasses.map((cls) => (
                    <option key={cls.id} value={cls.name}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              {courses
                .filter((c) => {
                  if (courseClassFilter === 'ALL') return true;
                  return c.targetClasses && c.targetClasses.includes(courseClassFilter);
                })
                .map((c) => (
                <div
                  key={c.id}
                  className={`p-3 neo-border-sm transition-all ${
                    selectedCourse?.id === c.id
                      ? 'bg-[#008080] text-white neo-shadow-sm'
                      : 'bg-white text-black hover:bg-zinc-50'
                  }`}
                >
                  <div
                    onClick={() => handleSelectCourse(c)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-mono font-bold ${selectedCourse?.id === c.id ? 'text-teal-100' : 'text-zinc-600'}`}>
                        {c.gradeLevel} • {c.subject}
                      </span>
                      <RetroBadge variant="green" size="sm">
                        AKTIF
                      </RetroBadge>
                    </div>
                    <h4 className="font-black text-sm mt-1">{c.title}</h4>
                    {/* Target Classes */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(c.targetClasses && c.targetClasses.length > 0) ? (
                        c.targetClasses.map((cls) => (
                          <span key={cls} className="text-[10px] font-mono font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 neo-border-sm">
                            🏫 {cls}
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-400 italic">Semua Kelas</span>
                      )}
                    </div>
                  </div>
                  {/* Delete course button */}
                  <div className="mt-2 pt-2 border-t border-black/20 flex justify-end">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCourse(c); }}
                      className="p-1 neo-border-sm bg-[#ff7675] hover:bg-red-500 text-white transition-colors"
                      title="Hapus Kursus Ini"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </RetroWindow>

          {/* Sequential Path Education Card */}
          <div className="p-4 bg-[#fffde6] neo-border font-mono text-xs space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-zinc-900">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>Prinsip Pembelajaran Berurutan:</span>
            </div>
            <p className="text-zinc-700 leading-relaxed">
              Materi pertama (Urutan 1) otomatis terbuka bagi siswa. Siswa harus menyelesaikan materi di atas agar materi di bawahnya terbuka.
            </p>
          </div>
        </div>

        {/* Right 2 Cols: Chapters Management & Builder */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCourse && (
            <RetroWindow
              title={`SUSUNAN BAB & MATERI: ${selectedCourse.title.toUpperCase()}`}
              headerColor="navy"
              icon={<BookOpen className="w-4 h-4 text-yellow-300" />}
            >
              <div className="space-y-4">
                {/* Header Action Bar */}
                <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b-2 border-black">
                  <div className="font-mono text-xs space-y-1">
                    <div className="space-x-2">
                      <span>Mata Pelajaran: <strong>{selectedCourse.subject}</strong></span>
                      <span>•</span>
                      <span>Total: <strong>{babGroups.length} BAB</strong> ({chapters.length} Pembahasan & Tugas)</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 neo-border-sm flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                        Target Bintang: 1 ⭐ = {selectedCourse.starSettings?.xpPerStar || 100} XP
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <RetroButton
                      variant="white"
                      size="sm"
                      icon={<Star className="w-4 h-4 text-amber-500 fill-amber-400" />}
                      onClick={() => handleOpenStarSettings(selectedCourse)}
                    >
                      ⭐ Atur Poin Bintang
                    </RetroButton>
                    <RetroButton
                      variant="yellow"
                      size="sm"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={handleOpenAddBabModal}
                    >
                      + Buat BAB Baru
                    </RetroButton>
                  </div>
                </div>

                {/* Empty State */}
                {chapters.length === 0 ? (
                  <div className="bg-white neo-border p-8 text-center space-y-3 font-mono">
                    <div className="w-12 h-12 bg-[#008080] text-white neo-border flex items-center justify-center mx-auto text-xl font-bold">
                      📝
                    </div>
                    <h3 className="font-black text-base">Belum Ada Bab Materi / Tugas</h3>
                    <p className="text-xs text-zinc-600 max-w-md mx-auto">
                      Mata pelajaran ini belum memiliki susunan materi. Mulai dengan membuat BAB 1 dan Sub-Bab pertamanya menggunakan tombol di bawah ini.
                    </p>
                    <RetroButton
                      variant="teal"
                      size="sm"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={handleOpenAddBabModal}
                    >
                      Mulai Buat BAB Pertama
                    </RetroButton>
                  </div>
                ) : (
                  /* Hierarchical BAB Book Groups */
                  <div className="space-y-4">
                    {babGroups.map((bab) => (
                      <div key={bab.babTitle} className="bg-[#fcfbf9] neo-border p-4 space-y-3">
                        {/* Header BAB */}
                        <div className="flex items-center justify-between pb-2 border-b-2 border-black flex-wrap gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 bg-[#008080] text-white neo-border-sm flex items-center justify-center font-mono font-black text-sm shrink-0">
                              B{bab.babNumber}
                            </div>
                            <div>
                              <span className="text-[10px] font-mono font-bold uppercase text-zinc-500">
                                BAB KE-{bab.babNumber}
                              </span>
                              <h3 className="font-black text-sm sm:text-base text-black">{bab.babTitle}</h3>
                            </div>
                          </div>

                          {/* Quick Actions inside this BAB */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => {
                                if (!selectedCourse) return;
                                const reports = DataProvider.getClassBabReports(selectedCourse.id, bab.babNumber);
                                if (reports.length === 0) {
                                  alert(`Belum ada data nilai peserta didik pada BAB ${bab.babNumber}.`);
                                  return;
                                }
                                exportBabReportToExcel(
                                  reports,
                                  selectedCourse.title,
                                  bab.babTitle,
                                  user?.name || selectedCourse.teacherName
                                );
                              }}
                              className="px-2.5 py-1 bg-emerald-400 hover:bg-emerald-300 neo-border-sm font-mono text-xs font-bold flex items-center gap-1 text-black shadow-sm"
                              title="Unduh Rekap Nilai & Capaian Belajar BAB dalam format Excel (.xlsx)"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>Unduh Rekap BAB (Excel)</span>
                            </button>
                            <button
                              onClick={() => handleOpenAddSubChapterModal(bab.babNumber, bab.babTitle)}
                              className="px-2.5 py-1 bg-white hover:bg-zinc-100 neo-border-sm font-mono text-xs font-bold flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5 text-teal-700" />
                              <span>+ Sub-Bab Pembahasan</span>
                            </button>
                            <button
                              onClick={() => handleOpenAddAssignmentModal(bab.babNumber, bab.babTitle)}
                              className="px-2.5 py-1 bg-[#ffde59] hover:bg-yellow-400 neo-border-sm font-mono text-xs font-bold flex items-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5 text-black" />
                              <span>+ Tugas Bab</span>
                            </button>
                          </div>
                        </div>

                        {/* Sub-Chapters & Attached Assignments */}
                        <div className="space-y-2.5">
                          {bab.subChapters.map(({ main, assignments }) => (
                            <div key={main.id} className="space-y-2">
                              {/* Sub-Bab Card */}
                              <div className="bg-white neo-border-sm p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-zinc-50/80 transition-colors">
                                <div className="flex items-start gap-2.5 w-full sm:w-auto">
                                  <div className="w-7 h-7 bg-zinc-200 neo-border-sm flex items-center justify-center font-mono font-black text-xs shrink-0">
                                    {main.order_index}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {main.type === 'text' && (
                                        <RetroBadge variant="yellow" size="sm" icon={<FileText className="w-3 h-3" />}>
                                          TEKS MANUAL
                                        </RetroBadge>
                                      )}
                                      {main.type === 'pdf' && (
                                        <RetroBadge variant="red" size="sm" icon={<File className="w-3 h-3" />}>
                                          DOKUMEN PDF
                                        </RetroBadge>
                                      )}
                                      {main.type === 'link' && (
                                        <RetroBadge variant="blue" size="sm" icon={<LinkIcon className="w-3 h-3" />}>
                                          LINK URL / WEB
                                        </RetroBadge>
                                      )}
                                      {main.type === 'video' && (
                                        <RetroBadge variant="purple" size="sm" icon={<Video className="w-3 h-3" />}>
                                          VIDEO
                                        </RetroBadge>
                                      )}
                                      <span className="text-[11px] font-mono text-zinc-500">
                                        Pembahasan Materi
                                      </span>
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-amber-50 text-amber-900 neo-border-sm flex items-center gap-1">
                                        <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                        {main.activityRewardPoints ? `${main.activityRewardPoints} XP (Khusus)` : `${getDefaultXpForType(main.type)} XP`}
                                      </span>
                                    </div>
                                    <h4 className="font-bold text-sm text-black">{main.title}</h4>
                                    {main.description && (
                                      <p className="text-xs text-zinc-600 font-sans line-clamp-1">{main.description}</p>
                                    )}

                                    {/* Rentang Waktu Aktif Info */}
                                    {main.schedule?.isEnabled && (
                                      <div className="flex items-center gap-1.5 pt-0.5 text-[11px] font-mono text-zinc-700">
                                        <Calendar className="w-3 h-3 text-[#008080]" />
                                        <span>
                                          Aktif: {main.schedule.startDate ? new Date(main.schedule.startDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : 'Sekarang'} s/d {main.schedule.endDate ? new Date(main.schedule.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Seterusnya'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Action buttons */}
                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                  <Link href={`/student/course/${selectedCourse.id}/chapter/${main.id}`}>
                                    <button
                                      title="Pratinjau Siswa"
                                      className="p-1.5 px-2 bg-white hover:bg-zinc-100 neo-border-sm text-black flex items-center gap-1 font-mono text-xs font-bold"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>Pratinjau</span>
                                    </button>
                                  </Link>
                                  <button
                                    onClick={() => handleOpenAddAssignmentModal(bab.babNumber, bab.babTitle, main.id)}
                                    title="Tambah Tugas untuk Sub-Bab ini"
                                    className="p-1.5 px-2 bg-emerald-100 hover:bg-emerald-200 neo-border-sm text-emerald-950 flex items-center gap-1 font-mono text-xs font-bold"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Tugas</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditModal(main)}
                                    title="Edit Sub-Bab"
                                    className="p-1.5 bg-[#008080] hover:bg-[#006666] neo-border-sm text-white"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteChapter(main)}
                                    title="Hapus Sub-Bab"
                                    className="p-1.5 bg-[#ff7675] hover:bg-red-400 neo-border-sm text-white"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Attached Assignments (Indented) */}
                              {assignments.map((asg) => (
                                <div
                                  key={asg.id}
                                  className="ml-6 sm:ml-10 bg-[#fffde6] neo-border-sm p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                                >
                                  <div className="flex items-start gap-2.5">
                                    <div className="text-zinc-400 text-sm font-black shrink-0">↳</div>
                                    <div className="w-6 h-6 bg-emerald-700 text-white neo-border-sm flex items-center justify-center font-mono font-black text-[11px] shrink-0">
                                      {asg.order_index}
                                    </div>
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <RetroBadge variant="green" size="sm" icon={<ClipboardCheck className="w-3 h-3" />}>
                                          {asg.type === 'quiz' ? 'KUIS EVALUASI' : asg.type === 'link' ? 'TUGAS LINK' : 'TUGAS SISWA'}
                                        </RetroBadge>
                                        <span className="text-[11px] font-mono font-bold text-emerald-900">
                                          Target Capaian: {asg.passing_grade || 75}
                                        </span>
                                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 neo-border-sm flex items-center gap-1">
                                          <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                          {asg.activityRewardPoints ? `${asg.activityRewardPoints} XP (Khusus)` : `${getDefaultXpForType(asg.type)} XP`}
                                        </span>
                                      </div>
                                      <h5 className="font-bold text-xs text-black">{asg.title}</h5>
                                      {asg.description && (
                                        <p className="text-[11px] text-zinc-600 font-sans line-clamp-1">{asg.description}</p>
                                      )}
                                      {asg.schedule?.isEnabled && (
                                        <div className="flex items-center gap-1.5 pt-0.5 text-[10px] font-mono text-zinc-600">
                                          <Clock className="w-2.5 h-2.5 text-amber-700" />
                                          <span>
                                            Tenggat: {asg.schedule.endDate ? new Date(asg.schedule.endDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    <Link href={`/student/course/${selectedCourse.id}/chapter/${asg.id}`}>
                                      <button
                                        title="Pratinjau Tugas"
                                        className="p-1 px-2 bg-white hover:bg-zinc-100 neo-border-sm text-black flex items-center gap-1 font-mono text-[11px] font-bold"
                                      >
                                        <Eye className="w-3 h-3" />
                                        <span>Pratinjau</span>
                                      </button>
                                    </Link>
                                    <button
                                      onClick={() => handleOpenEditModal(asg)}
                                      title="Edit Tugas"
                                      className="p-1 bg-[#008080] hover:bg-[#006666] neo-border-sm text-white"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteChapter(asg)}
                                      title="Hapus Tugas"
                                      className="p-1 bg-[#ff7675] hover:bg-red-400 neo-border-sm text-white"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}

                          {/* Standalone Assignments in this BAB */}
                          {bab.standaloneAssignments.map((asg) => (
                            <div
                              key={asg.id}
                              className="bg-[#fffde6] neo-border-sm p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-start gap-2.5">
                                <div className="w-6 h-6 bg-emerald-700 text-white neo-border-sm flex items-center justify-center font-mono font-black text-[11px] shrink-0">
                                  {asg.order_index}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <RetroBadge variant="green" size="sm" icon={<ClipboardCheck className="w-3 h-3" />}>
                                      TUGAS BAB
                                    </RetroBadge>
                                    <span className="text-[11px] font-mono font-bold text-emerald-900">
                                      KKM: {asg.passing_grade || 75}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-amber-100 text-amber-900 neo-border-sm flex items-center gap-1">
                                      <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                                      {asg.activityRewardPoints ? `${asg.activityRewardPoints} XP (Khusus)` : `${getDefaultXpForType(asg.type)} XP`}
                                    </span>
                                  </div>
                                  <h5 className="font-bold text-xs text-black">{asg.title}</h5>
                                  {asg.description && (
                                    <p className="text-[11px] text-zinc-600 font-sans line-clamp-1">{asg.description}</p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                <Link href={`/student/course/${selectedCourse.id}/chapter/${asg.id}`}>
                                  <button
                                    title="Pratinjau Tugas"
                                    className="p-1 px-2 bg-white hover:bg-zinc-100 neo-border-sm text-black flex items-center gap-1 font-mono text-[11px] font-bold"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Pratinjau</span>
                                  </button>
                                </Link>
                                <button
                                  onClick={() => handleOpenEditModal(asg)}
                                  title="Edit Tugas"
                                  className="p-1 bg-[#008080] hover:bg-[#006666] neo-border-sm text-white"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteChapter(asg)}
                                  title="Hapus Tugas"
                                  className="p-1 bg-[#ff7675] hover:bg-red-400 neo-border-sm text-white"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </RetroWindow>
          )}
        </div>
      </div>

      {/* MODAL FORM TAMBAH / EDIT HIERARKI BUKU */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-5xl my-auto">
            <RetroWindow
              title={
                modalMode === 'new_bab'
                  ? 'BUAT BAB BARU & SUB-BAB PERTAMA'
                  : modalMode === 'sub_chapter'
                  ? `TAMBAH SUB-BAB PEMBAHASAN (${babTitleInput})`
                  : modalMode === 'assignment'
                  ? `TAMBAH TUGAS / LATIHAN SUB-BAB (${babTitleInput})`
                  : 'EDIT MATERI / TUGAS KURIKULUM'
              }
              headerColor="mustard"
              icon={<BookOpen className="w-4 h-4" />}
            >
              <form onSubmit={handleSaveChapter} className="space-y-3 font-mono text-xs">
                {/* ── 2-Column Responsive Flex/Grid Layout ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
                  {/* ── KOLOM KIRI: Struktur, Tipe, & Konten Materi ── */}
                  <div className="space-y-3">
                    {/* Informasi BAB Induk */}
                    <div className="bg-[#f0ece1] p-2.5 neo-border-sm space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="font-bold text-black flex items-center gap-1.5">
                          <FolderOpen className="w-4 h-4 text-[#008080]" />
                          Induk BAB:
                        </span>
                        <span className="text-[11px] text-zinc-600">Urutan Alur: #{orderIndex}</span>
                      </div>

                      {modalMode === 'new_bab' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold mb-0.5">Nomor BAB:</label>
                            <input
                              type="number"
                              min={1}
                              required
                              value={babNumberInput}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setBabNumberInput(val);
                                setBabTitleInput(`BAB ${val}: `);
                                setSubChapterNumInput(`${val}.1`);
                              }}
                              className="w-full p-2 neo-border-sm bg-white font-bold"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-bold mb-0.5">Nama / Judul BAB:</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. BAB 2: STRUKTUR LOGIKA PERCABANGAN"
                              value={babTitleInput}
                              onChange={(e) => setBabTitleInput(e.target.value)}
                              className="w-full p-2 neo-border-sm bg-white font-bold"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="bg-[#008080] text-white px-2 py-0.5 font-bold neo-border-sm">
                            BAB {babNumberInput}
                          </span>
                          <span className="font-bold text-black">{babTitleInput}</span>
                        </div>
                      )}
                    </div>

                    {/* Kategori Item: Pembahasan vs Tugas */}
                    {modalMode === 'assignment' && (
                      <div className="bg-[#fffde6] p-2.5 neo-border-sm space-y-2">
                        <label className="block font-bold text-black">Pilih Sub-Bab yang Ditugaskan:</label>
                        <select
                          value={targetSubChapterId}
                          onChange={(e) => setTargetSubChapterId(e.target.value)}
                          className="w-full p-2 neo-border-sm bg-white text-xs font-bold"
                        >
                          <option value="">Tugas Umum / Evaluasi Bab</option>
                          {chapters
                            .filter((c) => (c.babNumber || 1) === babNumberInput && c.itemCategory !== 'assignment')
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* Judul & Urutan Sub-Bab/Tugas */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2">
                        <label className="block font-bold mb-1">
                          {modalMode === 'assignment' ? 'Judul Tugas / Latihan:' : 'Judul Sub-Bab Pembahasan:'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={
                            modalMode === 'assignment'
                              ? 'e.g. Tugas Praktik 1.1: Lembar Latihan Spreadsheet'
                              : 'e.g. Sub-Bab 1.1: Memahami Konsep Variabel'
                          }
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full p-2 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block font-bold mb-1">Nomor Sub-Bab:</label>
                        <input
                          type="text"
                          placeholder="e.g. 1.1"
                          value={subChapterNumInput}
                          onChange={(e) => setSubChapterNumInput(e.target.value)}
                          className="w-full p-2 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Pilihan Tipe Konten */}
                    <div>
                      <label className="block font-bold mb-1">Pilih Tipe Materi / Format Tugas:</label>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {modalMode !== 'assignment' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setChapterType('pdf')}
                              className={`p-2 neo-border-sm flex flex-col items-center justify-center gap-1 font-mono font-bold transition-all text-center ${
                                chapterType === 'pdf' ? 'bg-[#ff7675] text-white neo-shadow-sm' : 'bg-white hover:bg-zinc-100'
                              }`}
                            >
                              <File className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Modul PDF</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setChapterType('video')}
                              className={`p-2 neo-border-sm flex flex-col items-center justify-center gap-1 font-mono font-bold transition-all text-center ${
                                chapterType === 'video' ? 'bg-[#a29bfe] text-black neo-shadow-sm' : 'bg-white hover:bg-zinc-100'
                              }`}
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Video YouTube</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setChapterType('text')}
                              className={`p-2 neo-border-sm flex flex-col items-center justify-center gap-1 font-mono font-bold transition-all text-center ${
                                chapterType === 'text' ? 'bg-[#ffde59] neo-shadow-sm' : 'bg-white hover:bg-zinc-100'
                              }`}
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Teks Manual</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setChapterType('link')}
                              className={`p-2 neo-border-sm flex flex-col items-center justify-center gap-1 font-mono font-bold transition-all text-center ${
                                chapterType === 'link' ? 'bg-[#54a0ff] text-white neo-shadow-sm' : 'bg-white hover:bg-zinc-100'
                              }`}
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Link Web</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setChapterType('quiz')}
                              className={`p-2 neo-border-sm flex flex-col items-center justify-center gap-1 font-mono font-bold transition-all text-center ${
                                chapterType === 'quiz' ? 'bg-[#ffde59] text-black neo-shadow-sm' : 'bg-white hover:bg-zinc-100'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Kuis / Ujian</span>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setChapterType('link')}
                              className={`p-2 neo-border-sm flex flex-col items-center justify-center gap-1 font-mono font-bold transition-all text-center ${
                                chapterType === 'link' ? 'bg-[#54a0ff] text-white neo-shadow-sm' : 'bg-white hover:bg-zinc-100'
                              }`}
                            >
                              <LinkIcon className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Link Berkas/Form</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setChapterType('assignment')}
                              className={`p-2 neo-border-sm flex flex-col items-center justify-center gap-1 font-mono font-bold transition-all text-center ${
                                chapterType === 'assignment' ? 'bg-[#79f2c0] text-emerald-950 neo-shadow-sm' : 'bg-white hover:bg-zinc-100'
                              }`}
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Upload Tugas</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setChapterType('quiz')}
                              className={`p-2 neo-border-sm flex flex-col items-center justify-center gap-1 font-mono font-bold transition-all text-center ${
                                chapterType === 'quiz' ? 'bg-[#ffde59] text-black neo-shadow-sm' : 'bg-white hover:bg-zinc-100'
                              }`}
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Kuis / Ujian</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {chapterType === 'quiz' && (
                      <div className="bg-[#fffde6] p-2.5 neo-border-sm text-xs font-mono space-y-1">
                        <div className="font-bold text-amber-900 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <span>Tipe Kuis / Ujian Dipilih</span>
                        </div>
                        <p className="text-[11px] text-zinc-700">
                          Gunakan tombol <strong>&quot;+ Susun Butir Soal&quot;</strong> di panel kanan untuk merancang butir-butir pertanyaan (PG Tunggal, MCMA, Menjodohkan, Isian, &amp; Uraian).
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block font-bold mb-1">Deskripsi Singkat / Arahan Belajar:</label>
                      <input
                        type="text"
                        placeholder="Ringkasan singkat tentang materi atau capaian pembelajaran ini..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-2 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                      />
                    </div>

                    {/* KONTEN BERDASARKAN TIPE */}
                    {chapterType === 'text' && (
                      <div className="space-y-1">
                        <label className="block font-bold">Ketik Materi Pembelajaran (Teks / Markdown):</label>
                        <textarea
                          rows={4}
                          required
                          placeholder="Ketikkan materi ajar di sini..."
                          value={textContent}
                          onChange={(e) => setTextContent(e.target.value)}
                          className="w-full p-2.5 neo-border-sm bg-white text-xs font-mono focus:bg-[#fffde6] focus:outline-none leading-relaxed"
                        />
                      </div>
                    )}

                    {chapterType === 'pdf' && (
                      <div className="space-y-1.5">
                        <label className="block font-bold">Tautan URL Berkas Dokumen PDF Materi:</label>
                        <input
                          type="url"
                          required
                          placeholder="https://drive.google.com/... atau tautan file PDF publik..."
                          value={fileUrl}
                          onChange={(e) => setFileUrl(e.target.value)}
                          className="w-full p-2 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                        />
                        <p className="text-[11px] text-zinc-600">
                          Siswa dapat membaca dokumen PDF ini secara terintegrasi di LMS.
                        </p>
                      </div>
                    )}

                    {chapterType === 'video' && (
                      <div className="space-y-1.5">
                        <label className="block font-bold">Tautan URL Video YouTube Pembelajaran:</label>
                        <input
                          type="url"
                          required
                          placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
                          value={videoUrl}
                          onChange={(e) => setVideoUrl(e.target.value)}
                          className="w-full p-2 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                        />
                      </div>
                    )}

                    {chapterType === 'link' && (
                      <div className="space-y-1.5">
                        <label className="block font-bold">Tautan URL Eksternal / Referensi Web / Form / Sheet:</label>
                        <input
                          type="url"
                          required
                          placeholder="https://docs.google.com/spreadsheets/... atau link referensi..."
                          value={externalUrl}
                          onChange={(e) => setExternalUrl(e.target.value)}
                          className="w-full p-2 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                        />
                      </div>
                    )}

                    {(chapterType === 'assignment' || modalMode === 'assignment') && (
                      <div className="space-y-2 bg-[#f8f9fa] p-2.5 neo-border-sm">
                        <div>
                          <label className="block font-bold mb-1">Instruksi Pengerjaan Tugas untuk Siswa:</label>
                          <textarea
                            rows={3}
                            required
                            placeholder="Contoh: Buatlah portofolio atau selesaikan lembar kerja di atas..."
                            value={assignmentPrompt}
                            onChange={(e) => setAssignmentPrompt(e.target.value)}
                            className="w-full p-2 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold mb-1">Target Ketercapaian Pembelajaran:</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={passingGrade}
                              onChange={(e) => setPassingGrade(Number(e.target.value))}
                              className="w-20 p-1.5 neo-border-sm bg-white text-sm"
                            />
                            <span className="text-zinc-600 text-[11px]">Skor pemahaman agar materi berikutnya terbuka.</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── KOLOM KANAN: Akses Waktu, XP & Soal Ujian ── */}
                  <div className="space-y-3">
                    {/* RENTANG WAKTU AKTIF (DEADLINE & SCHEDULE WINDOW) */}
                    <div className="bg-[#fcf8e3] p-3 neo-border-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="font-black text-xs flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={scheduleEnabled}
                            onChange={(e) => setScheduleEnabled(e.target.checked)}
                            className="w-4 h-4 accent-[#008080]"
                          />
                          <Calendar className="w-4 h-4 text-[#008080]" />
                          <span>Rentang Waktu Pengerjaan / Deadline</span>
                        </label>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-white neo-border-sm text-zinc-700">
                          {scheduleEnabled ? 'AKTIF' : 'NON-AKTIF'}
                        </span>
                      </div>

                      {scheduleEnabled && (
                        <div className="space-y-2 pt-1">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-bold text-zinc-700 mb-0.5">
                                📅 Mulai Dibuka:
                              </label>
                              <input
                                type="date"
                                value={scheduleStartDate}
                                onChange={(e) => setScheduleStartDate(e.target.value)}
                                className="w-full p-1.5 neo-border-sm bg-white text-xs font-mono focus:bg-yellow-50"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-zinc-700 mb-0.5">
                                ⏰ Batas Akhir (Deadline):
                              </label>
                              <input
                                type="date"
                                value={scheduleEndDate}
                                onChange={(e) => setScheduleEndDate(e.target.value)}
                                className="w-full p-1.5 neo-border-sm bg-white text-xs font-mono focus:bg-yellow-50"
                              />
                            </div>
                          </div>
                          <p className="text-[11px] text-amber-900 bg-amber-100 p-2 neo-border-sm font-sans leading-relaxed">
                            💡 <strong>Aturan Kedisiplinan:</strong> Jika melewati batas akhir pengerjaan, materi berikutnya otomatis terkunci sementara dan dicatat di Log Jurnal Guru.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Poin Keaktifan (XP) Khusus Bab / Tugas */}
                    <div className="p-3 bg-[#e8f4fd] neo-border-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                          <span>Skor / Poin Keaktifan (XP):</span>
                        </label>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 bg-white neo-border-sm text-blue-800">
                          {activityRewardPoints ? `⭐ ${activityRewardPoints} XP` : `⭐ ${getDefaultXpForType(chapterType)} XP (DEFAULT)`}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            placeholder={`Standar: ${getDefaultXpForType(chapterType)} XP`}
                            value={activityRewardPoints}
                            onChange={(e) => setActivityRewardPoints(e.target.value)}
                            className="w-full p-2 neo-border-sm bg-white text-xs font-mono font-bold focus:bg-[#fffde6] focus:outline-none"
                          />
                          <span className="absolute right-3 top-2 text-xs font-mono font-bold text-zinc-400">
                            XP
                          </span>
                        </div>
                        {activityRewardPoints && (
                          <button
                            type="button"
                            onClick={() => setActivityRewardPoints('')}
                            className="text-[11px] font-mono font-bold px-2 py-2 bg-zinc-200 hover:bg-zinc-300 neo-border-sm whitespace-nowrap"
                            title="Kembalikan ke tarif standar mata pelajaran"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-700 font-sans leading-relaxed">
                        💡 Siswa otomatis meraih <strong>{activityRewardPoints || getDefaultXpForType(chapterType)} XP</strong> saat menyelesaikan bagian ini. Setiap 100 XP dikonversi menjadi 1 Bintang Prestasi.
                      </p>
                    </div>

                    {/* Butir Soal & Ujian (5 Jenis Format Soal) */}
                    <div className="p-3 bg-[#f3e8ff] neo-border-sm space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-purple-700" />
                            <span>Butir Soal &amp; Latihan ({questionsInput.length} Terpasang):</span>
                          </label>
                          <p className="text-[11px] text-zinc-600 mt-0.5">
                            PG Tunggal, MCMA, Menjodohkan, Isian, &amp; Uraian (Mode B).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsQuestionBuilderOpen(true)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-mono font-bold text-xs neo-border-sm flex items-center gap-1.5 shadow-sm"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{questionsInput.length > 0 ? 'Edit Butir Soal' : '+ Susun Butir Soal'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Action Buttons ── */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-black">
                  <RetroButton
                    type="button"
                    variant="white"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Batal
                  </RetroButton>
                  <RetroButton
                    type="submit"
                    variant="yellow"
                    size="sm"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                  >
                    {editingChapterId ? 'Simpan Perubahan' : 'Terbitkan ke Kurikulum'}
                  </RetroButton>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* MODAL PENGATURAN SKOR BINTANG & KEAKTIFAN MATA PELAJARAN */}
      {isStarSettingsModalOpen && selectedCourse && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg my-8">
            <RetroWindow
              title={`PENGATURAN SKOR BINTANG: ${selectedCourse.title.toUpperCase()}`}
              headerColor="mustard"
              icon={<Star className="w-4 h-4 text-black fill-amber-400" />}
            >
              <form onSubmit={handleSaveStarSettings} className="space-y-4 font-mono text-xs p-1">
                <div className="bg-[#fff9db] neo-border-sm p-3 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                    <Sliders className="w-4 h-4 text-amber-600" />
                    <span>Otoritas Penilaian Guru:</span>
                  </div>
                  <p className="text-[11px] text-zinc-700 font-sans leading-relaxed">
                    Sebagai guru pengampu, Anda dapat menentukan berapa XP yang dibutuhkan siswa untuk meraih 1 Bintang, serta besaran poin keaktifan default untuk setiap aktivitas belajar.
                  </p>
                </div>

                {/* 1. Target XP per Bintang */}
                <div className="p-3 bg-white neo-border-sm space-y-2">
                  <label className="block font-black text-sm text-black flex items-center justify-between">
                    <span>🌟 Ambang Poin per 1 Bintang (XP):</span>
                    <span className="text-xs bg-amber-200 px-2 py-0.5 neo-border-sm">
                      1 ⭐ = {starSettingsForm.xpPerStar} XP
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="10"
                      max="1000"
                      step="5"
                      value={starSettingsForm.xpPerStar}
                      onChange={(e) =>
                        setStarSettingsForm({
                          ...starSettingsForm,
                          xpPerStar: Math.max(10, Number(e.target.value)),
                        })
                      }
                      className="w-full p-2.5 neo-border-sm bg-white text-sm font-black focus:bg-yellow-50 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-zinc-400">
                      XP / Bintang
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-600 font-sans">
                    Contoh: Jika diatur 100 XP, maka siswa mengumpulkan 200 XP = 2 Bintang. Jika diatur 50 XP, siswa lebih cepat memperoleh bintang apresiasi.
                  </p>
                </div>

                {/* 2. Standar Poin per Jenis Aktivitas */}
                <div className="space-y-2">
                  <div className="font-black text-xs uppercase text-zinc-700 tracking-wider">
                    Bobot Poin Keaktifan Default per Aktivitas:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Video */}
                    <div className="p-2.5 bg-white neo-border-sm space-y-1">
                      <label className="block text-[11px] font-bold text-zinc-800 flex items-center gap-1">
                        <Video className="w-3.5 h-3.5 text-purple-600" />
                        <span>Menonton Video:</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={starSettingsForm.defaultVideoXp}
                          onChange={(e) =>
                            setStarSettingsForm({
                              ...starSettingsForm,
                              defaultVideoXp: Number(e.target.value),
                            })
                          }
                          className="w-full p-1.5 neo-border-sm text-xs font-bold focus:bg-yellow-50"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 font-bold">XP</span>
                      </div>
                    </div>

                    {/* PDF */}
                    <div className="p-2.5 bg-white neo-border-sm space-y-1">
                      <label className="block text-[11px] font-bold text-zinc-800 flex items-center gap-1">
                        <File className="w-3.5 h-3.5 text-red-600" />
                        <span>Membaca Modul PDF:</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={starSettingsForm.defaultPdfXp}
                          onChange={(e) =>
                            setStarSettingsForm({
                              ...starSettingsForm,
                              defaultPdfXp: Number(e.target.value),
                            })
                          }
                          className="w-full p-1.5 neo-border-sm text-xs font-bold focus:bg-yellow-50"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 font-bold">XP</span>
                      </div>
                    </div>

                    {/* Teks Manual */}
                    <div className="p-2.5 bg-white neo-border-sm space-y-1">
                      <label className="block text-[11px] font-bold text-zinc-800 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5 text-amber-600" />
                        <span>Membaca Teks Manual:</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={starSettingsForm.defaultTextXp}
                          onChange={(e) =>
                            setStarSettingsForm({
                              ...starSettingsForm,
                              defaultTextXp: Number(e.target.value),
                            })
                          }
                          className="w-full p-1.5 neo-border-sm text-xs font-bold focus:bg-yellow-50"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 font-bold">XP</span>
                      </div>
                    </div>

                    {/* Link Web */}
                    <div className="p-2.5 bg-white neo-border-sm space-y-1">
                      <label className="block text-[11px] font-bold text-zinc-800 flex items-center gap-1">
                        <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
                        <span>Mempelajari Link Luar:</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={starSettingsForm.defaultLinkXp}
                          onChange={(e) =>
                            setStarSettingsForm({
                              ...starSettingsForm,
                              defaultLinkXp: Number(e.target.value),
                            })
                          }
                          className="w-full p-1.5 neo-border-sm text-xs font-bold focus:bg-yellow-50"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 font-bold">XP</span>
                      </div>
                    </div>

                    {/* Tugas Portofolio */}
                    <div className="p-2.5 bg-white neo-border-sm space-y-1">
                      <label className="block text-[11px] font-bold text-zinc-800 flex items-center gap-1">
                        <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Kirim Tugas Portofolio:</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={starSettingsForm.defaultAssignmentXp}
                          onChange={(e) =>
                            setStarSettingsForm({
                              ...starSettingsForm,
                              defaultAssignmentXp: Number(e.target.value),
                            })
                          }
                          className="w-full p-1.5 neo-border-sm text-xs font-bold focus:bg-yellow-50"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 font-bold">XP</span>
                      </div>
                    </div>

                    {/* Kuis / Ujian */}
                    <div className="p-2.5 bg-white neo-border-sm space-y-1">
                      <label className="block text-[11px] font-bold text-zinc-800 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Kuis / Ujian Evaluasi:</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="200"
                          value={starSettingsForm.defaultQuizXp}
                          onChange={(e) =>
                            setStarSettingsForm({
                              ...starSettingsForm,
                              defaultQuizXp: Number(e.target.value),
                            })
                          }
                          className="w-full p-1.5 neo-border-sm text-xs font-bold focus:bg-yellow-50"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 font-bold">XP</span>
                      </div>
                    </div>
                  </div>

                  {/* Bonus On-Time */}
                  <div className="p-2.5 bg-emerald-50 neo-border-sm space-y-1">
                    <label className="block text-[11px] font-bold text-emerald-950 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Bonus Disiplin Tepat Waktu (Sebelum Batas Deadline):</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={starSettingsForm.onTimeBonusXp}
                        onChange={(e) =>
                          setStarSettingsForm({
                            ...starSettingsForm,
                            onTimeBonusXp: Number(e.target.value),
                          })
                        }
                        className="w-full p-1.5 neo-border-sm bg-white text-xs font-bold focus:bg-yellow-50"
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] text-zinc-400 font-bold">+XP</span>
                    </div>
                    <p className="text-[10px] text-emerald-800">
                      Diberikan sebagai hadiah tambahan jika siswa mengumpulkan tugas / kuis sebelum tanggal batas waktu berakhir.
                    </p>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between pt-3 border-t-2 border-black">
                  <button
                    type="button"
                    onClick={() => setStarSettingsForm(DEFAULT_STAR_SETTINGS)}
                    className="text-xs font-mono font-bold text-zinc-600 hover:text-black underline"
                  >
                    Reset Rekomendasi
                  </button>

                  <div className="flex items-center gap-2">
                    <RetroButton
                      type="button"
                      variant="white"
                      size="sm"
                      onClick={() => setIsStarSettingsModalOpen(false)}
                    >
                      Batal
                    </RetroButton>
                    <RetroButton
                      type="submit"
                      variant="yellow"
                      size="sm"
                      icon={<CheckCircle2 className="w-4 h-4" />}
                    >
                      Simpan Pengaturan ⭐
                    </RetroButton>
                  </div>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* MODAL BUAT KURSUS BARU */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <RetroWindow
              title="BUAT MATA PELAJARAN / KURSUS BARU"
              headerColor="navy"
              icon={<GraduationCap className="w-4 h-4 text-yellow-300" />}
            >
              <form onSubmit={handleCreateCourse} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block font-bold mb-1">Nama Mata Pelajaran / Kursus:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pemrograman Berorientasi Objek"
                    value={newCourseTitle}
                    onChange={(e) => setNewCourseTitle(e.target.value)}
                    className="w-full p-2.5 neo-border-sm bg-white text-sm focus:bg-[#fffde6] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold mb-1">Bidang Studi:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Informatika"
                      value={newCourseSubject}
                      onChange={(e) => setNewCourseSubject(e.target.value)}
                      className="w-full p-2.5 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold mb-1">Tingkat Kelas:</label>
                    <select
                      value={newCourseGrade}
                      onChange={(e) => setNewCourseGrade(e.target.value)}
                      className="w-full p-2.5 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                    >
                      <option value="Kelas X">Kelas X</option>
                      <option value="Kelas XI">Kelas XI</option>
                      <option value="Kelas XII">Kelas XII</option>
                      <option value="Umum">Umum / Terbuka</option>
                    </select>
                  </div>
                </div>

                {/* TARGET KELAS — WAJIB DIPILIH */}
                <div className="space-y-2">
                  <label className="block font-bold">
                    🏫 Target Kelas (Pilih Kelas yang Bisa Akses Kursus Ini):
                    <span className="text-red-600 ml-1">*</span>
                  </label>
                  {availableClasses.length === 0 ? (
                    <div className="p-3 bg-[#fff8db] neo-border-sm text-[11px] text-zinc-700">
                      ⚠️ Belum ada kelas terdaftar. Minta Administrator untuk menambahkan kelas terlebih dahulu.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {availableClasses.map((cls) => {
                        const isSelected = newCourseTargetClasses.includes(cls.name);
                        return (
                          <button
                            key={cls.id}
                            type="button"
                            onClick={() => {
                              setNewCourseTargetClasses((prev) =>
                                isSelected
                                  ? prev.filter((n) => n !== cls.name)
                                  : [...prev, cls.name]
                              );
                            }}
                            className={`p-2 neo-border-sm text-left transition-all ${
                              isSelected
                                ? 'bg-[#ffde59] neo-shadow-sm font-black'
                                : 'bg-white hover:bg-zinc-100'
                            }`}
                          >
                            <div className="text-[11px] font-bold">{cls.name}</div>
                            <div className="text-[10px] text-zinc-500">{cls.gradeLevel}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {newCourseTargetClasses.length > 0 && (
                    <div className="text-[11px] text-emerald-700 font-bold">
                      ✓ Dipilih: {newCourseTargetClasses.join(', ')}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold mb-1">Deskripsi Singkat:</label>
                  <textarea
                    rows={2}
                    placeholder="Deskripsi singkat kurikulum mata pelajaran..."
                    value={newCourseDesc}
                    onChange={(e) => setNewCourseDesc(e.target.value)}
                    className="w-full p-2.5 neo-border-sm bg-white text-xs focus:bg-[#fffde6] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-black">
                  <RetroButton
                    type="button"
                    variant="white"
                    size="sm"
                    onClick={() => setIsCourseModalOpen(false)}
                  >
                    Batal
                  </RetroButton>
                  <RetroButton
                    type="submit"
                    variant="yellow"
                    size="sm"
                    icon={<Plus className="w-4 h-4" />}
                  >
                    Simpan Kursus
                  </RetroButton>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}
      {/* MODAL KONFIRMASI HAPUS (RETRO) */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <RetroWindow
              title="KONFIRMASI HAPUS"
              headerColor="coral"
              icon={<Trash2 className="w-4 h-4 text-white" />}
            >
              <div className="space-y-4 font-mono text-xs">
                <div className="bg-[#fff1f0] neo-border-sm p-4 text-center space-y-2">
                  <div className="w-12 h-12 bg-[#ff7675] neo-border flex items-center justify-center mx-auto text-white">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-black text-red-950">
                    Hapus {deleteConfirm.type === 'chapter' ? 'Materi Bab' : 'Mata Pelajaran'} Ini?
                  </h3>
                  <p className="text-xs text-zinc-700">
                    Apakah Anda yakin ingin menghapus <strong>&quot;{deleteConfirm.name}&quot;</strong>?
                    {deleteConfirm.type === 'course' && ' Seluruh BAB dan materi di dalamnya juga akan terhapus permanen.'}
                    {deleteConfirm.type === 'chapter' && ' Data pengerjaan siswa pada materi ini juga akan terhapus.'}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black">
                  <RetroButton
                    type="button"
                    variant="white"
                    size="sm"
                    onClick={() => setDeleteConfirm(null)}
                  >
                    Batal
                  </RetroButton>
                  <button
                    type="button"
                    className="px-4 py-2 bg-[#ff7675] hover:bg-red-500 text-white font-mono font-black neo-border-sm transition-all flex items-center gap-1.5"
                    onClick={executeDelete}
                  >
                    <Trash2 className="w-4 h-4" />
                    Ya, Hapus Permanen 🗑️
                  </button>
                </div>
              </div>
            </RetroWindow>
          </div>
        </div>
      )}

      {/* MODAL PENYUSUN BUTIR SOAL */}
      {isQuestionBuilderOpen && (
        <QuestionBuilderModal
          initialQuestions={questionsInput}
          chapterTitle={title || 'Materi / Ujian'}
          onSave={(qs) => {
            setQuestionsInput(qs);
            setIsQuestionBuilderOpen(false);
          }}
          onClose={() => setIsQuestionBuilderOpen(false)}
        />
      )}
    </div>
  );
}
