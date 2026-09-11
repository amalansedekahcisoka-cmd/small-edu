import { Course, Chapter, User, Submission, StarAchievement, ActivityLog, ClassRoom } from '@/types';

// DAFTAR PENGGUNA RESMI BAWAAN
export const MOCK_USERS: User[] = [
  {
    id: 'user-superadmin',
    name: 'Superadmin',
    email: 'superadmin@smalledu.id',
    role: 'admin',
    nisn_nip: 'SA-001',
    password: 'Sheilaon7!!',
    mustChangePassword: false,
    starsCount: 0,
    createdAt: '2026-07-01T08:00:00Z',
  },
  {
    id: 'user-teacher-rudiansyah',
    name: 'RUDIANSYAH, S.Pd.',
    email: 'rudiopok@smalledu.id',
    role: 'teacher',
    nisn_nip: '198820052025011045',
    password: '198820052025011045',
    mustChangePassword: false,
    starsCount: 0,
    createdAt: '2026-07-01T08:00:00Z',
  },
  {
    id: 'user-student-ica',
    name: 'Ica Aurelia',
    email: 'ica@smalledu.id',
    role: 'student',
    nisn_nip: '11111111',
    password: '11111111',
    gradeClass: 'X RPL 1',
    mustChangePassword: true,
    starsCount: 0,
    createdAt: '2026-07-01T08:00:00Z',
  },
];

// DATABASE KELAS AWAL
export const MOCK_CLASSES: ClassRoom[] = [
  {
    id: 'cls-1',
    name: 'X RPL 1',
    major: 'Rekayasa Perangkat Lunak',
    gradeLevel: 'Kelas X',
    createdAt: '2026-07-01T08:00:00Z',
  },
  {
    id: 'cls-2',
    name: 'X RPL 2',
    major: 'Rekayasa Perangkat Lunak',
    gradeLevel: 'Kelas X',
    createdAt: '2026-07-01T08:00:00Z',
  },
  {
    id: 'cls-3',
    name: 'XI RPL 1',
    major: 'Rekayasa Perangkat Lunak',
    gradeLevel: 'Kelas XI',
    createdAt: '2026-07-01T08:00:00Z',
  },
];

export const MOCK_COURSES: Course[] = [
  {
    id: 'course-web-dev',
    title: 'Informatika & Pemrograman Web Modern',
    description: 'Kuasai fondasi arsitektur web modern, protokol HTTP, Next.js, dan database cloud melalui alur belajar berurutan.',
    subject: 'Informatika',
    gradeLevel: 'Kelas X SMK / SMA',
    thumbnailBg: '#FFE169',
    teacherId: 'user-teacher-rudiansyah',
    teacherName: 'RUDIANSYAH, S.Pd.',
    chaptersCount: 0,
    isPublished: true,
  },
];

// DATA BAB DIKOSONGKAN AGAR GURU DAPAT MEMASUKKAN BAB & MATERI SENDIRI
export const MOCK_CHAPTERS: Chapter[] = [];

export const MOCK_ACHIEVEMENTS: StarAchievement[] = [];
export const MOCK_ACTIVITY_LOGS: ActivityLog[] = [];
export const MOCK_SUBMISSIONS: Submission[] = [];
