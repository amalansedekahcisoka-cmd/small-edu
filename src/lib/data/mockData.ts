import { Course, Chapter, User, Submission, StarAchievement, ActivityLog, ClassRoom } from '@/types';

// DAFTAR PENGGUNA RESMI BAWAAN (Hanya Superadmin untuk bootstrapping awal)
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
];

// SEMUA DATA MOCK DINONAKTIFKAN KARENA APLIKASI SUDAH MENGGUNAKAN CLOUD FIRESTORE
export const MOCK_CLASSES: ClassRoom[] = [];
export const MOCK_COURSES: Course[] = [];
export const MOCK_CHAPTERS: Chapter[] = [];
export const MOCK_ACHIEVEMENTS: StarAchievement[] = [];
export const MOCK_ACTIVITY_LOGS: ActivityLog[] = [];
export const MOCK_SUBMISSIONS: Submission[] = [];
