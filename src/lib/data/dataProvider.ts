'use client';

import {
  User,
  Course,
  Chapter,
  UserCourseProgress,
  ChapterProgress,
  Submission,
  StarAchievement,
  StarCategory,
  ActivityLog,
  ClassRoom,
  CourseStarSettings,
  BabLearningReport,
  BabAssessmentItem,
  getP5ProgressInfo,
} from '@/types';
import {
  MOCK_USERS,
  MOCK_CLASSES,
  MOCK_COURSES,
  MOCK_CHAPTERS,
  MOCK_ACHIEVEMENTS,
  MOCK_ACTIVITY_LOGS,
  MOCK_SUBMISSIONS,
} from './mockData';
import { FirestoreService } from '../firebase/firestoreService';
import { isFirebaseConfigured } from '../firebase/config';

export const DEFAULT_STAR_SETTINGS: CourseStarSettings = {
  xpPerStar: 100,
  defaultVideoXp: 25,
  defaultPdfXp: 20,
  defaultTextXp: 20,
  defaultLinkXp: 15,
  defaultAssignmentXp: 30,
  defaultQuizXp: 30,
  onTimeBonusXp: 15,
};

const STORAGE_KEYS = {
  CLASSES: 'smalledu_classes',
  DELETED_CLASSES: 'smalledu_deleted_class_ids',
  CURRENT_USER: 'smalledu_current_user',
  USERS: 'smalledu_users',
  DELETED_USERS: 'smalledu_deleted_user_ids',
  COURSES: 'smalledu_courses',
  CHAPTERS: 'smalledu_chapters',
  PROGRESS_PREFIX: 'smalledu_progress_',
  SUBMISSIONS: 'smalledu_submissions',
  ACHIEVEMENTS: 'smalledu_achievements',
  ACTIVITY_LOGS: 'smalledu_activity_logs',
};

function safeGetItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage`, e);
  }
}

// Helper untuk kirim update ke server API agar semua browser / tab / incognito sinkron
async function postServerAction(action: string, payload: any): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    });
  } catch (e) {
    console.warn('API sync failed, using local offline storage:', e);
  }
}

// Helper untuk fetch snapshot database terbaru dari server
async function fetchServerData(): Promise<any> {
  if (typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        if (data.users && Array.isArray(data.users)) {
          const currentStored = safeGetItem<User[]>(STORAGE_KEYS.USERS, []);
          const passMap = new Map<string, string>();
          currentStored.forEach((u) => {
            if (u.password) passMap.set(u.id, u.password);
          });
          const mergedUsers = data.users.map((u: any) => ({
            ...u,
            password: passMap.get(u.id) || u.password || u.nisn_nip || '',
          }));
          safeSetItem(STORAGE_KEYS.USERS, mergedUsers);
        }
        if (data.classes && Array.isArray(data.classes)) safeSetItem(STORAGE_KEYS.CLASSES, data.classes);
        if (data.courses && Array.isArray(data.courses)) safeSetItem(STORAGE_KEYS.COURSES, data.courses);
        if (data.chapters && Array.isArray(data.chapters)) safeSetItem(STORAGE_KEYS.CHAPTERS, data.chapters);
        if (data.submissions && Array.isArray(data.submissions)) safeSetItem(STORAGE_KEYS.SUBMISSIONS, data.submissions);
        if (data.achievements && Array.isArray(data.achievements)) safeSetItem(STORAGE_KEYS.ACHIEVEMENTS, data.achievements);
        if (data.activityLogs && Array.isArray(data.activityLogs)) {
          // Kumpulkan ID user yang sudah dihapus (dari server maupun lokal)
          const serverDeletedIds = new Set<string>([
            ...(Array.isArray(data.deletedUserIds) ? data.deletedUserIds : []),
            ...safeGetItem<string[]>(STORAGE_KEYS.DELETED_USERS, []),
          ]);

          const localLogs = safeGetItem<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
          const logMap = new Map<string, ActivityLog>();
          // Hanya masukkan log dari server yang bukan milik deleted user
          data.activityLogs.forEach((l: ActivityLog) => {
            if (l && l.id && !serverDeletedIds.has(l.userId)) logMap.set(l.id, l);
          });
          // Merge log lokal, skip log dari deleted user
          localLogs.forEach((l: ActivityLog) => {
            if (l && l.id && !serverDeletedIds.has(l.userId) && !logMap.has(l.id)) {
              logMap.set(l.id, l);
              postServerAction('LOG_ACTIVITY', l);
            }
          });
          const mergedLogs = Array.from(logMap.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 300);
          safeSetItem(STORAGE_KEYS.ACTIVITY_LOGS, mergedLogs);
        }
        if (data.deletedUserIds && Array.isArray(data.deletedUserIds)) safeSetItem(STORAGE_KEYS.DELETED_USERS, data.deletedUserIds);
        if (data.deletedClassIds && Array.isArray(data.deletedClassIds)) safeSetItem(STORAGE_KEYS.DELETED_CLASSES, data.deletedClassIds);
        if (data.progress && typeof data.progress === 'object') {
          Object.entries(data.progress).forEach(([progKey, progVal]) => {
            safeSetItem(`${STORAGE_KEYS.PROGRESS_PREFIX}${progKey}`, progVal);
          });
        }
        return data;
      }
    }
  } catch (e) {
    console.warn('Could not fetch server data, using localStorage:', e);
  }
  return null;
}

// Inisialisasi background sync saat browser jalan
if (typeof window !== 'undefined') {
  setTimeout(() => {
    fetchServerData().catch(() => {});
  }, 100);
}

export class DataProvider {
  // Trigger sinkronisasi server & cloud firestore
  static async syncWithServer(): Promise<void> {
    try {
      await Promise.allSettled([
        fetchServerData(),
        this.getUsersAsync(),
        this.getClassesAsync(),
        this.getCoursesAsync(),
        this.getActivityLogsAsync(),
        this.getSubmissionsAsync(),
        this.syncAllProgressAsync(),
      ]);
    } catch (e) {
      console.warn('syncWithServer error:', e);
    }
  }

  static async syncAllProgressAsync(): Promise<void> {
    if (isFirebaseConfigured) {
      try {
        const allProgress = await FirestoreService.getAllUserProgress();
        if (Array.isArray(allProgress) && allProgress.length > 0) {
          allProgress.forEach((p) => {
            if (p && p.userId && p.courseId) {
              const key = `${STORAGE_KEYS.PROGRESS_PREFIX}${p.userId}_${p.courseId}`;
              safeSetItem(key, p);
            }
          });
        }
      } catch (e) {
        console.warn('Error syncing progress from Firestore:', e);
      }
    }
  }

  // --- DATABASE KELAS ---
  static getClasses(): ClassRoom[] {
    const deletedIds = new Set(safeGetItem<string[]>(STORAGE_KEYS.DELETED_CLASSES, []));
    const stored = safeGetItem<ClassRoom[]>(STORAGE_KEYS.CLASSES, MOCK_CLASSES);
    const all = stored.length > 0 ? stored : MOCK_CLASSES;
    return all.filter((c) => !deletedIds.has(c.id));
  }

  static async getClassesAsync(): Promise<ClassRoom[]> {
    const deletedIds = new Set(safeGetItem<string[]>(STORAGE_KEYS.DELETED_CLASSES, []));
    if (isFirebaseConfigured) {
      try {
        const firestoreClasses = await FirestoreService.getClasses();
        if (Array.isArray(firestoreClasses) && firestoreClasses.length > 0) {
          const valid = firestoreClasses.filter((c) => !deletedIds.has(c.id));
          if (valid.length > 0) {
            const map = new Map<string, ClassRoom>();
            MOCK_CLASSES.forEach((c) => {
              if (!deletedIds.has(c.id)) map.set(c.id, c);
            });
            valid.forEach((c) => {
              if (!deletedIds.has(c.id)) map.set(c.id, { ...map.get(c.id), ...c });
            });
            const merged = Array.from(map.values());
            safeSetItem(STORAGE_KEYS.CLASSES, merged);
            return merged;
          }
        }
      } catch (e) {
        console.warn('Firestore getClasses error:', e);
      }
    }

    // Ambil data terbaru dari server data/db.json jika Firebase belum disetup
    const serverData = await fetchServerData();
    if (serverData?.classes && Array.isArray(serverData.classes) && serverData.classes.length > 0) {
      const valid = (serverData.classes as ClassRoom[]).filter((c) => !deletedIds.has(c.id));
      safeSetItem(STORAGE_KEYS.CLASSES, valid);
      return valid;
    }

    return this.getClasses();
  }

  static addClass(newClass: Omit<ClassRoom, 'id' | 'createdAt'>): ClassRoom {
    const classes = this.getClasses();
    const created: ClassRoom = {
      ...newClass,
      id: `cls-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    classes.push(created);
    safeSetItem(STORAGE_KEYS.CLASSES, classes);
    postServerAction('ADD_CLASS', created);
    FirestoreService.saveClass?.(created).catch(console.error);
    return created;
  }

  static updateClass(classId: string, updates: Partial<ClassRoom>): void {
    const classes = this.getClasses().map((c) => {
      if (c.id === classId) {
        return { ...c, ...updates };
      }
      return c;
    });
    safeSetItem(STORAGE_KEYS.CLASSES, classes);
    postServerAction('UPDATE_CLASS', { classId, updates });
    FirestoreService.updateClass?.(classId, updates).catch(console.error);
  }

  static deleteClass(classId: string): void {
    const deletedIds = safeGetItem<string[]>(STORAGE_KEYS.DELETED_CLASSES, []);
    if (!deletedIds.includes(classId)) {
      deletedIds.push(classId);
      safeSetItem(STORAGE_KEYS.DELETED_CLASSES, deletedIds);
    }
    const classes = this.getClasses().filter((c) => c.id !== classId);
    safeSetItem(STORAGE_KEYS.CLASSES, classes);
    postServerAction('DELETE_CLASS', { classId });
    FirestoreService.deleteClass?.(classId).catch(console.error);
  }

  static updateUser(userId: string, updates: Partial<User>): void {
    const users = this.getUsers().map((u) => {
      if (u.id === userId) {
        return { ...u, ...updates };
      }
      return u;
    });
    safeSetItem(STORAGE_KEYS.USERS, users);
    postServerAction('UPDATE_USER', { userId, updates });
    FirestoreService.updateUser(userId, updates).catch(console.error);

    const current = this.getCurrentUser();
    if (current.id === userId) {
      this.setCurrentUser({ ...current, ...updates });
    }
  }

  static deleteUser(userId: string): void {
    const deletedIds = safeGetItem<string[]>(STORAGE_KEYS.DELETED_USERS, []);
    if (!deletedIds.includes(userId)) {
      deletedIds.push(userId);
      safeSetItem(STORAGE_KEYS.DELETED_USERS, deletedIds);
    }

    const remaining = this.getUsers().filter((u) => u.id !== userId);
    safeSetItem(STORAGE_KEYS.USERS, remaining);

    // Bersihkan log aktivitas dari user yang dihapus
    const cleanedLogs = safeGetItem<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []).filter(
      (l) => l.userId !== userId
    );
    safeSetItem(STORAGE_KEYS.ACTIVITY_LOGS, cleanedLogs);

    postServerAction('DELETE_USER', { userId });
    FirestoreService.deleteUser(userId).catch(console.error);

    this.logActivity(
      'user-superadmin',
      'Superadmin',
      'admin',
      'DELETE_USER',
      `Menghapus pengguna ID: ${userId}`
    );
  }

  // --- USERS & AUTH ---
  static getUsers(): User[] {
    const deletedIds = new Set(safeGetItem<string[]>(STORAGE_KEYS.DELETED_USERS, []));
    const stored = safeGetItem<User[]>(STORAGE_KEYS.USERS, []);

    const map = new Map<string, User>();
    // Masukkan MOCK_USERS jika belum dihapus
    MOCK_USERS.forEach((u) => {
      if (!deletedIds.has(u.id)) {
        map.set(u.id, u);
      }
    });

    if (Array.isArray(stored)) {
      stored.forEach((u) => {
        if (!deletedIds.has(u.id)) {
          if (map.has(u.id)) {
            map.set(u.id, { ...map.get(u.id)!, ...u });
          } else {
            map.set(u.id, u);
          }
        }
      });
    }

    const merged = Array.from(map.values()).filter((u) => !deletedIds.has(u.id));
    if (!stored || stored.length === 0) {
      safeSetItem(STORAGE_KEYS.USERS, merged);
    }
    return merged;
  }

  static async getUsersAsync(): Promise<User[]> {
    // 0. Sinkronkan ID pengguna yang dihapus dari Cloud Firestore
    let allDeletedList = safeGetItem<string[]>(STORAGE_KEYS.DELETED_USERS, []);
    if (isFirebaseConfigured) {
      try {
        const firestoreDeleted = await FirestoreService.getDeletedUserIds();
        if (Array.isArray(firestoreDeleted) && firestoreDeleted.length > 0) {
          allDeletedList = Array.from(new Set([...allDeletedList, ...firestoreDeleted]));
          safeSetItem(STORAGE_KEYS.DELETED_USERS, allDeletedList);
        }
      } catch (e) {
        // ignore
      }
    }
    const deletedIds = new Set(allDeletedList);

    // 1. Prioritaskan Cloud Firestore jika terkonfigurasi (agar multi-device langsung sinkron)
    if (isFirebaseConfigured) {
      try {
        const firestoreUsers = await FirestoreService.getUsers();
        if (Array.isArray(firestoreUsers) && firestoreUsers.length > 0) {
          const valid = firestoreUsers.filter((u) => !deletedIds.has(u.id));
          if (valid.length > 0) {
            const userMap = new Map<string, User>();
            // Masukkan akun superadmin & guru bawaan jika belum ada di firestore
            MOCK_USERS.forEach((u) => {
              if (!deletedIds.has(u.id)) userMap.set(u.id, u);
            });

            // Baca XP & bintang lokal yang mungkin sudah diraih siswa
            const localUsers = safeGetItem<User[]>(STORAGE_KEYS.USERS, []);
            const localPointsMap = new Map<string, { points: number; stars: number }>();
            localUsers.forEach((lu) => {
              if (lu && lu.id && ((lu.activityPoints || 0) > 0 || (lu.starsCount || 0) > 0)) {
                localPointsMap.set(lu.id, { points: lu.activityPoints || 0, stars: lu.starsCount || 0 });
              }
            });

            // Overwrite dan tambahkan dari Cloud Firestore (source of truth terpercaya)
            valid.forEach((u) => {
              if (!deletedIds.has(u.id)) {
                const localPts = localPointsMap.get(u.id);
                const finalPoints = Math.max(u.activityPoints || 0, localPts?.points || 0);
                const finalStars = Math.max(u.starsCount || 0, localPts?.stars || 0);
                const mergedUser: User = {
                  ...userMap.get(u.id),
                  ...u,
                  activityPoints: finalPoints,
                  starsCount: finalStars,
                };
                userMap.set(u.id, mergedUser);

                // Jika data lokal memiliki poin/bintang lebih tinggi, sinkronkan balik ke Firestore
                if (
                  (localPts?.points || 0) > (u.activityPoints || 0) ||
                  (localPts?.stars || 0) > (u.starsCount || 0)
                ) {
                  FirestoreService.updateUser(u.id, {
                    activityPoints: finalPoints,
                    starsCount: finalStars,
                  }).catch(console.error);
                }
              }
            });
            const merged = Array.from(userMap.values()).filter((u) => !deletedIds.has(u.id));
            safeSetItem(STORAGE_KEYS.USERS, merged);
            return merged;
          }
        }
      } catch (err) {
        console.warn('Firestore getUsers error in DataProvider:', err);
      }
    }

    // 2. Ambil dari server API data
    const serverData = await fetchServerData();
    if (serverData?.users && Array.isArray(serverData.users) && serverData.users.length > 0) {
      return (serverData.users as User[]).filter((u) => !deletedIds.has(u.id));
    }

    // 3. Fallback ke local
    return this.getUsers();
  }

  // Helper untuk sinkronisasi data lokal (misal akun yang dibuat sebelum env aktif) ke Firestore
  static async syncLocalToFirestore(): Promise<void> {
    if (!isFirebaseConfigured) return;
    try {
      const localUsers = this.getUsers();
      for (const u of localUsers) {
        // Sync akun buatan admin (misal siswa/guru)
        if (u.id.startsWith('user-') && u.id !== 'user-superadmin') {
          await FirestoreService.saveUser(u).catch(console.error);
        }
      }

      const localClasses = this.getClasses();
      for (const c of localClasses) {
        await FirestoreService.saveClass(c).catch(console.error);
      }
    } catch (e) {
      console.warn('Sync local to firestore failed:', e);
    }
  }

  static getCurrentUser(): User {
    const defaultUser = MOCK_USERS[0]; // Superadmin
    const current = safeGetItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (!current) return defaultUser;
    const users = this.getUsers();
    const latest = users.find((u) => u.id === current.id);
    if (latest) {
      return { ...current, ...latest };
    }
    return current;
  }

  static setCurrentUser(user: User): void {
    safeSetItem(STORAGE_KEYS.CURRENT_USER, user);
  }

  static changePassword(userId: string, newPassword: string): boolean {
    const users = this.getUsers();
    const updated = users.map((u) => {
      if (u.id === userId) {
        return { ...u, password: newPassword, mustChangePassword: false };
      }
      return u;
    });
    safeSetItem(STORAGE_KEYS.USERS, updated);
    postServerAction('UPDATE_USER', { userId, updates: { password: newPassword, mustChangePassword: false } });

    const current = this.getCurrentUser();
    if (current.id === userId) {
      this.setCurrentUser({ ...current, password: newPassword, mustChangePassword: false });
    }

    FirestoreService.updateUserPasswordStatus(userId, false).catch(console.error);
    return true;
  }

  static addUser(newUser: Omit<User, 'id' | 'createdAt' | 'starsCount'>): User {
    const users = this.getUsers();
    
    // Kata sandi default: jika diisi gunakan password tsb, jika kosong gunakan NISN/NIP, atau smalledu123
    const defaultPassword = newUser.password?.trim() 
      ? newUser.password.trim() 
      : (newUser.nisn_nip ? newUser.nisn_nip.trim() : 'smalledu123');
    
    const user: User = {
      ...newUser,
      id: `user-${Date.now()}`,
      password: defaultPassword,
      starsCount: 0,
      createdAt: new Date().toISOString(),
      mustChangePassword: newUser.mustChangePassword !== undefined ? newUser.mustChangePassword : (newUser.role === 'student'),
    };
    users.push(user);
    safeSetItem(STORAGE_KEYS.USERS, users);

    // Kirim ke server API (tersimpan di server file data/db.json)
    postServerAction('ADD_USER', user);

    // Sinkronisasi background ke Cloud Firestore (jika aktif)
    FirestoreService.saveUser(user).catch(console.error);

    // Catat aktivitas
    this.logActivity(
      'user-superadmin',
      'Superadmin',
      'admin',
      'CREATE_USER',
      `Mendaftarkan pengguna baru: ${user.name} (${user.role}) - ${user.nisn_nip || user.email}`
    );

    return user;
  }

  // --- COURSES & CHAPTERS ---
  static getCourses(): Course[] {
    return safeGetItem(STORAGE_KEYS.COURSES, MOCK_COURSES);
  }

  static async getCoursesAsync(): Promise<Course[]> {
    const serverData = await fetchServerData();
    if (serverData?.courses && Array.isArray(serverData.courses) && serverData.courses.length > 0) {
      return serverData.courses as Course[];
    }
    return this.getCourses();
  }

  static getCourseById(courseId: string): Course | undefined {
    const courses = this.getCourses();
    return courses.find((c) => c.id === courseId);
  }

  static addCourse(newCourse: Omit<Course, 'id'>): Course {
    const courses = this.getCourses();
    const created: Course = {
      ...newCourse,
      id: `crs-${Date.now()}`,
    };
    courses.push(created);
    safeSetItem(STORAGE_KEYS.COURSES, courses);
    postServerAction('ADD_COURSE', created);
    FirestoreService.saveCourse(created).catch(console.error);
    return created;
  }

  static updateCourse(courseId: string, updates: Partial<Course>): void {
    const courses = this.getCourses().map((c) => {
      if (c.id === courseId) {
        return { ...c, ...updates };
      }
      return c;
    });
    safeSetItem(STORAGE_KEYS.COURSES, courses);
    postServerAction('UPDATE_COURSE', { courseId, updates });
    const target = courses.find((c) => c.id === courseId);
    if (target) {
      FirestoreService.saveCourse(target).catch(console.error);
    }
  }

  static getCourseStarSettings(courseId?: string): CourseStarSettings {
    if (!courseId) return DEFAULT_STAR_SETTINGS;
    const course = this.getCourseById(courseId);
    if (!course || !course.starSettings) return DEFAULT_STAR_SETTINGS;
    return {
      ...DEFAULT_STAR_SETTINGS,
      ...course.starSettings,
    };
  }

  static updateCourseStarSettings(courseId: string, settings: Partial<CourseStarSettings>): CourseStarSettings {
    const current = this.getCourseStarSettings(courseId);
    const updated: CourseStarSettings = { ...current, ...settings };
    this.updateCourse(courseId, { starSettings: updated });
    return updated;
  }

  static deleteCourse(courseId: string): void {
    const courses = this.getCourses().filter((c) => c.id !== courseId);
    safeSetItem(STORAGE_KEYS.COURSES, courses);

    const remainingChapters = this.getChapters().filter((ch) => ch.courseId !== courseId);
    safeSetItem(STORAGE_KEYS.CHAPTERS, remainingChapters);

    postServerAction('DELETE_COURSE', { courseId });
    FirestoreService.deleteCourse?.(courseId).catch(console.error);
  }

  static getChapters(courseId?: string): Chapter[] {
    let all = safeGetItem<Chapter[]>(STORAGE_KEYS.CHAPTERS, []);
    const hasOldMock = all.some((ch) => ['ch-1', 'ch-2', 'ch-3', 'ch-4'].includes(ch.id));
    if (hasOldMock) {
      all = all.filter((ch) => !['ch-1', 'ch-2', 'ch-3', 'ch-4'].includes(ch.id));
      safeSetItem(STORAGE_KEYS.CHAPTERS, all);
    }

    if (!courseId) return all.sort((a, b) => a.order_index - b.order_index);
    return all
      .filter((ch) => ch.courseId === courseId)
      .sort((a, b) => a.order_index - b.order_index);
  }

  static async getChaptersAsync(courseId?: string): Promise<Chapter[]> {
    const serverData = await fetchServerData();
    const all = serverData?.chapters && Array.isArray(serverData.chapters) ? (serverData.chapters as Chapter[]) : this.getChapters();
    if (!courseId) return all.sort((a, b) => a.order_index - b.order_index);
    return all
      .filter((ch) => ch.courseId === courseId)
      .sort((a, b) => a.order_index - b.order_index);
  }

  static getChapterById(courseId: string, chapterId: string): Chapter | undefined {
    const chapters = this.getChapters(courseId);
    return chapters.find((ch) => ch.id === chapterId);
  }

  static addChapter(newChapter: Omit<Chapter, 'id'>): Chapter {
    const chapters = this.getChapters();
    const created: Chapter = {
      ...newChapter,
      id: `ch-${Date.now()}`,
    };
    chapters.push(created);
    safeSetItem(STORAGE_KEYS.CHAPTERS, chapters);
    postServerAction('ADD_CHAPTER', created);

    // Update jumlah bab di kursus
    const course = this.getCourseById(newChapter.courseId);
    if (course) {
      this.updateCourse(course.id, {
        chaptersCount: this.getChapters(course.id).length,
      });
    }

    FirestoreService.saveChapter(newChapter.courseId, created).catch(console.error);
    return created;
  }

  static updateChapter(chapterId: string, updates: Partial<Chapter>): void {
    const chapters = this.getChapters().map((ch) => {
      if (ch.id === chapterId) {
        return { ...ch, ...updates };
      }
      return ch;
    });
    safeSetItem(STORAGE_KEYS.CHAPTERS, chapters);
    postServerAction('UPDATE_CHAPTER', { chapterId, updates });

    const target = chapters.find((ch) => ch.id === chapterId);
    if (target) {
      FirestoreService.updateChapter(target.courseId, chapterId, updates).catch(console.error);
    }
  }

  static deleteChapter(chapterId: string): void {
    const all = this.getChapters();
    const target = all.find((ch) => ch.id === chapterId);
    const filtered = all.filter((ch) => ch.id !== chapterId);
    safeSetItem(STORAGE_KEYS.CHAPTERS, filtered);
    postServerAction('DELETE_CHAPTER', { chapterId });

    if (target) {
      FirestoreService.deleteChapter(target.courseId, chapterId).catch(console.error);
      const course = this.getCourseById(target.courseId);
      if (course) {
        this.updateCourse(course.id, {
          chaptersCount: this.getChapters(course.id).length,
        });
      }
    }
  }

  // --- USER PROGRESS & SEQUENTIAL STATE ---
  static getUserProgress(userId: string, courseId: string): UserCourseProgress {
    const key = `${STORAGE_KEYS.PROGRESS_PREFIX}${userId}_${courseId}`;
    const chapters = this.getChapters(courseId);
    const firstChapter = chapters.find((ch) => ch.order_index === 1) || chapters[0];

    const initialChapters: Record<string, ChapterProgress> = {};
    if (firstChapter) {
      initialChapters[firstChapter.id] = {
        chapterId: firstChapter.id,
        order_index: firstChapter.order_index,
        is_completed: false,
        status: 'unlocked',
      };
    }

    const fallback: UserCourseProgress = {
      userId,
      courseId,
      current_chapter_index: 1,
      totalStarsEarned: 0,
      chapters: initialChapters,
    };
    
    const existing = safeGetItem<UserCourseProgress>(key, fallback);
    if (firstChapter && (!existing.chapters || !existing.chapters[firstChapter.id])) {
      existing.chapters = existing.chapters || {};
      existing.chapters[firstChapter.id] = {
        chapterId: firstChapter.id,
        order_index: firstChapter.order_index,
        is_completed: false,
        status: 'unlocked',
      };
      safeSetItem(key, existing);
    }
    return existing;
  }

  static async getUserProgressAsync(userId: string, courseId: string): Promise<UserCourseProgress> {
    try {
      const firestoreProgress = await FirestoreService.getUserProgress?.(userId, courseId);
      if (firestoreProgress) {
        const key = `${STORAGE_KEYS.PROGRESS_PREFIX}${userId}_${courseId}`;
        safeSetItem(key, firestoreProgress);
        return firestoreProgress;
      }
    } catch (_) {}
    return this.getUserProgress(userId, courseId);
  }

  static updateChapterProgress(
    userId: string,
    courseId: string,
    chapterId: string,
    updates: Partial<ChapterProgress>
  ): UserCourseProgress {
    const progress = this.getUserProgress(userId, courseId);
    const existing = progress.chapters[chapterId] || {
      chapterId,
      order_index: 1,
      is_completed: false,
      status: 'unlocked',
    };

    const updatedChapter: ChapterProgress = {
      ...existing,
      ...updates,
      lastAttemptAt: new Date().toISOString(),
    };

    progress.chapters[chapterId] = updatedChapter;

    // Hitung apakah perlu membuka bab berikutnya
    const allChapters = this.getChapters(courseId);
    const currentCh = allChapters.find((c) => c.id === chapterId);

    if (
      currentCh &&
      updatedChapter.is_completed &&
      (updatedChapter.score ?? 100) >= (currentCh.passing_grade ?? 75)
    ) {
      const nextIndex = currentCh.order_index + 1;
      const nextCh = allChapters.find((c) => c.order_index === nextIndex);
      if (nextCh) {
        if (!progress.chapters[nextCh.id]) {
          progress.chapters[nextCh.id] = {
            chapterId: nextCh.id,
            order_index: nextIndex,
            is_completed: false,
            status: 'unlocked',
          };
        } else if (progress.chapters[nextCh.id].status === 'locked') {
          progress.chapters[nextCh.id].status = 'unlocked';
        }
      }
      progress.current_chapter_index = Math.max(progress.current_chapter_index, nextIndex);
    }

    const key = `${STORAGE_KEYS.PROGRESS_PREFIX}${userId}_${courseId}`;
    safeSetItem(key, progress);

    postServerAction('SAVE_PROGRESS', { studentId: userId, courseId, progressData: progress });
    FirestoreService.saveUserProgress(progress).catch(console.error);
    return progress;
  }

  // --- SUBMISSIONS & MODE B ESSAY GRADING ---
  static getSubmissions(): Submission[] {
    return safeGetItem(STORAGE_KEYS.SUBMISSIONS, MOCK_SUBMISSIONS);
  }

  static async getSubmissionsAsync(): Promise<Submission[]> {
    if (isFirebaseConfigured) {
      try {
        const firestoreSubs = await FirestoreService.getSubmissions();
        if (Array.isArray(firestoreSubs) && firestoreSubs.length > 0) {
          safeSetItem(STORAGE_KEYS.SUBMISSIONS, firestoreSubs);
          return firestoreSubs;
        }
      } catch (e) {
        console.warn('Firestore getSubmissions error in DataProvider:', e);
      }
    }
    return this.getSubmissions();
  }

  static saveSubmission(sub: Omit<Submission, 'id' | 'submittedAt'>): Submission {
    const subs = this.getSubmissions();
    const newSub: Submission = {
      ...sub,
      id: `sub-${Date.now()}`,
      submittedAt: new Date().toISOString(),
    };
    subs.unshift(newSub);
    safeSetItem(STORAGE_KEYS.SUBMISSIONS, subs);
    postServerAction('ADD_SUBMISSION', newSub);
    FirestoreService.saveSubmission(newSub).catch(console.error);
    return newSub;
  }

  static approveSubmission(
    submissionId: string,
    finalScore: number,
    feedback: string,
    teacherName: string
  ): Submission | null {
    const subs = this.getSubmissions();
    const index = subs.findIndex((s) => s.id === submissionId);
    if (index === -1) return null;

    const target = subs[index];
    const updated: Submission = {
      ...target,
      finalScore,
      teacherFeedback: feedback,
      gradedBy: teacherName,
      gradedAt: new Date().toISOString(),
      status: 'graded',
    };
    subs[index] = updated;
    safeSetItem(STORAGE_KEYS.SUBMISSIONS, subs);
    postServerAction('UPDATE_SUBMISSION', { submissionId, updates: updated });

    FirestoreService.saveSubmission(updated).catch(console.error);

    const isPassed = finalScore >= 75;
    this.updateChapterProgress(target.studentId, target.courseId, target.chapterId, {
      is_completed: isPassed,
      score: finalScore,
      status: isPassed ? 'passed' : 'failed',
    });

    this.logActivity(
      target.studentId,
      target.studentName,
      'student',
      'SUBMISSION_GRADED',
      `Tugas/Kuis diverifikasi oleh ${teacherName} dengan nilai akhir ${finalScore}.`,
      target.courseId,
      target.chapterId
    );

    return updated;
  }

  // --- ACHIEVEMENTS & STARS ---
  static getAchievements(userId: string): StarAchievement[] {
    const all = safeGetItem<StarAchievement[]>(STORAGE_KEYS.ACHIEVEMENTS, MOCK_ACHIEVEMENTS);
    return all.filter((a) => a.userId === userId);
  }

  /**
   * Menambahkan Poin Keaktifan Belajar (Activity XP) untuk Siswa.
   * Aturan: Setiap kelipatan 100 Poin Keaktifan, siswa OTOMATIS mendapatkan 1 Bintang Prestasi (⭐)!
   */
  static addActivityPoints(
    userId: string,
    points: number,
    reasonTitle: string,
    reasonDesc: string,
    category: StarCategory = 'ACADEMIC_EXCELLENCE',
    courseId?: string,
    chapterId?: string
  ): { pointsAdded: number; totalPoints: number; currentStars: number; earnedNewStar: boolean } {
    const users = this.getUsers();
    const uIndex = users.findIndex((u) => u.id === userId);
    if (uIndex === -1) {
      return { pointsAdded: 0, totalPoints: 0, currentStars: 0, earnedNewStar: false };
    }

    const user = users[uIndex];

    // Mencegah eksploitasi perolehan XP berulang untuk bab/kuis yang sama
    if (courseId && chapterId) {
      const progress = this.getUserProgress(userId, courseId);
      const chProgress = progress.chapters?.[chapterId];
      if (chProgress?.xpClaimed) {
        // XP bab ini sudah pernah diklaim! Jangan tambahkan poin atau catat log duplikat.
        return {
          pointsAdded: 0,
          totalPoints: user.activityPoints || 0,
          currentStars: user.starsCount || 0,
          earnedNewStar: false,
        };
      }

      // Tandai bab ini telah memperoleh XP
      if (!progress.chapters) progress.chapters = {};
      if (progress.chapters[chapterId]) {
        progress.chapters[chapterId].xpClaimed = true;
      } else {
        progress.chapters[chapterId] = {
          chapterId,
          order_index: 1,
          is_completed: true,
          status: 'passed',
          xpClaimed: true,
        };
      }
      const progKey = `${STORAGE_KEYS.PROGRESS_PREFIX}${userId}_${courseId}`;
      safeSetItem(progKey, progress);
      postServerAction('SAVE_PROGRESS', { studentId: userId, courseId, progressData: progress });
      FirestoreService.saveUserProgress(progress).catch(console.error);
    }

    const starSettings = courseId ? this.getCourseStarSettings(courseId) : DEFAULT_STAR_SETTINGS;
    const xpPerStar = starSettings.xpPerStar || 100;

    const oldPoints = user.activityPoints || 0;
    const newPoints = oldPoints + points;
    const oldStars = Math.floor(oldPoints / xpPerStar);
    const newStars = Math.floor(newPoints / xpPerStar);
    const earnedNewStar = newStars > oldStars;

    // Update user points and stars
    user.activityPoints = newPoints;
    user.starsCount = newStars;
    safeSetItem(STORAGE_KEYS.USERS, users);
    postServerAction('UPDATE_USER', {
      userId,
      updates: { activityPoints: newPoints, starsCount: newStars },
    });
    FirestoreService.updateUser(userId, { activityPoints: newPoints, starsCount: newStars }).catch(console.error);

    const currentUser = this.getCurrentUser();
    if (currentUser.id === userId) {
      this.setCurrentUser({ ...currentUser, activityPoints: newPoints, starsCount: newStars });
    }

    // Jika berhasil mencapai kelipatan xpPerStar XP -> Terbitkan Lencana Bintang Baru!
    if (earnedNewStar) {
      const addedStars = newStars - oldStars;
      this.awardStars(
        userId,
        category,
        `Bintang Keaktifan #${newStars} Diraih! 🌟`,
        `Akumulasi keaktifan belajar mencapai ${newPoints} XP (Target per bintang: ${xpPerStar} XP). Terus pertahankan semangat belajarmu!`,
        addedStars,
        'Star',
        newPoints
      );

      this.logActivity(
        userId,
        user.name,
        user.role,
        'EARNED_STAR',
        `⭐ Meraih Bintang Prestasi ke-${newStars}! Total keaktifan belajar mencapai ${newPoints} Poin Keaktifan (Target: ${xpPerStar} XP/Bintang).`,
        courseId,
        chapterId,
        user.gradeClass
      );
    } else {
      // Catat log perolehan XP
      this.logActivity(
        userId,
        user.name,
        user.role,
        'ACTIVITY_XP_GAINED',
        `+${points} XP (${reasonTitle}): ${reasonDesc}. Progres: ${newPoints % xpPerStar}/${xpPerStar} XP menuju bintang berikutnya.`,
        courseId,
        chapterId,
        user.gradeClass
      );
    }

    return {
      pointsAdded: points,
      totalPoints: newPoints,
      currentStars: newStars,
      earnedNewStar,
    };
  }

  /**
   * Menyelaraskan Poin Keaktifan (XP) siswa dari seluruh bab/tugas yang telah diselesaikan.
   * Mencegah kasus di mana materi sudah berstatus 'is_completed' tetapi XP belum tercatat.
   */
  static syncUserActivityPoints(userId: string): { totalPoints: number; currentStars: number } {
    const users = this.getUsers();
    const uIndex = users.findIndex((u) => u.id === userId);
    if (uIndex === -1) return { totalPoints: 0, currentStars: 0 };
    const user = users[uIndex];

    const courses = this.getCourses();
    let calculatedPoints = 0;

    courses.forEach((course) => {
      const progress = this.getUserProgress(userId, course.id);
      const chapters = this.getChapters(course.id);
      const starSettings = this.getCourseStarSettings(course.id);

      chapters.forEach((ch) => {
        const chProgress = progress.chapters?.[ch.id];
        if (chProgress && chProgress.is_completed) {
          let pts = ch.activityRewardPoints;
          if (pts === undefined || pts === null || isNaN(pts)) {
            switch (ch.type) {
              case 'video':
                pts = starSettings.defaultVideoXp ?? 25;
                break;
              case 'pdf':
                pts = starSettings.defaultPdfXp ?? 20;
                break;
              case 'text':
                pts = starSettings.defaultTextXp ?? 20;
                break;
              case 'link':
                pts = starSettings.defaultLinkXp ?? 15;
                break;
              case 'assignment':
                pts = starSettings.defaultAssignmentXp ?? 30;
                break;
              case 'quiz':
                pts = starSettings.defaultQuizXp ?? 30;
                break;
              default:
                pts = 20;
            }
          }
          calculatedPoints += pts;
        }
      });
    });

    const currentPoints = user.activityPoints || 0;
    if (calculatedPoints > currentPoints) {
      const primaryCourse = courses[0];
      const starSettings = primaryCourse ? this.getCourseStarSettings(primaryCourse.id) : DEFAULT_STAR_SETTINGS;
      const xpPerStar = starSettings.xpPerStar || 100;
      const newStars = Math.floor(calculatedPoints / xpPerStar);

      user.activityPoints = calculatedPoints;
      if (newStars > (user.starsCount || 0)) {
        user.starsCount = newStars;
      }
      safeSetItem(STORAGE_KEYS.USERS, users);
      postServerAction('UPDATE_USER', {
        userId,
        updates: { activityPoints: calculatedPoints, starsCount: user.starsCount },
      });
      FirestoreService.updateUser(userId, { activityPoints: calculatedPoints, starsCount: user.starsCount }).catch(console.error);

      const current = safeGetItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
      if (current && current.id === userId) {
        this.setCurrentUser({ ...current, ...user, activityPoints: calculatedPoints, starsCount: user.starsCount });
      }

      this.logActivity(
        userId,
        user.name,
        'student',
        'SYNC_XP_REWARD',
        `Penyelarasan otomatis poin keaktifan: +${calculatedPoints - currentPoints} XP dari materi yang telah tuntas dipelajari.`,
        undefined,
        undefined,
        user.gradeClass
      );
    }

    return { totalPoints: user.activityPoints || 0, currentStars: user.starsCount || 0 };
  }

  static awardStars(
    userId: string,
    category: StarAchievement['category'],
    title: string,
    description: string,
    stars: number,
    iconName: string = 'Award',
    xpGained?: number
  ): void {
    const all = safeGetItem<StarAchievement[]>(STORAGE_KEYS.ACHIEVEMENTS, MOCK_ACHIEVEMENTS);
    const newAch: StarAchievement = {
      id: `ach-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      category,
      title,
      description,
      stars,
      xpGained,
      earnedAt: new Date().toISOString(),
      iconName,
    };
    all.unshift(newAch);
    safeSetItem(STORAGE_KEYS.ACHIEVEMENTS, all);

    const users = this.getUsers();
    const uIndex = users.findIndex((u) => u.id === userId);
    if (uIndex !== -1) {
      users[uIndex].starsCount = (users[uIndex].starsCount || 0) + stars;
      safeSetItem(STORAGE_KEYS.USERS, users);
      postServerAction('UPDATE_USER', { userId, updates: { starsCount: users[uIndex].starsCount } });
      FirestoreService.saveUser(users[uIndex]).catch(console.error);
    }
  }

  // --- ACTIVITY LOGS ---
  static getActivityLogs(): ActivityLog[] {
    const deletedIds = new Set(safeGetItem<string[]>(STORAGE_KEYS.DELETED_USERS, []));
    return safeGetItem<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []).filter(
      (l) => !deletedIds.has(l.userId)
    );
  }

  static async getActivityLogsAsync(): Promise<ActivityLog[]> {
    const deletedIds = new Set(safeGetItem<string[]>(STORAGE_KEYS.DELETED_USERS, []));

    // 1. Prioritaskan Cloud Firestore agar aktivitas siswa dari browser/device lain langsung terlihat guru
    if (isFirebaseConfigured) {
      try {
        const firestoreLogs = await FirestoreService.getActivityLogs(200);
        if (Array.isArray(firestoreLogs) && firestoreLogs.length > 0) {
          const logMap = new Map<string, ActivityLog>();
          const localLogs = safeGetItem<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);

          // Tambahkan log dari firestore
          firestoreLogs.forEach((l) => {
            if (l && l.id && !deletedIds.has(l.userId)) {
              logMap.set(l.id, l);
            }
          });

          // Gabungkan log lokal yang mungkin baru dibuat offline
          localLogs.forEach((l) => {
            if (l && l.id && !deletedIds.has(l.userId) && !logMap.has(l.id)) {
              logMap.set(l.id, l);
            }
          });

          const merged = Array.from(logMap.values())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 300);

          safeSetItem(STORAGE_KEYS.ACTIVITY_LOGS, merged);
          return merged;
        }
      } catch (e) {
        console.warn('Firestore getActivityLogs error in DataProvider:', e);
      }
    }

    // 2. Fallback server API data
    await fetchServerData();
    return this.getActivityLogs();
  }

  static logActivity(
    userId: string,
    userName: string,
    userRole: User['role'],
    action: string,
    details: string,
    courseId?: string,
    chapterId?: string,
    userClass?: string
  ): void {
    const logs = this.getActivityLogs();

    // Mencegah log berulang beruntun dalam jeda waktu singkat (double-click atau re-trigger cepat)
    const recentDuplicate = logs.slice(0, 5).find(
      (l) =>
        l.userId === userId &&
        l.action === action &&
        l.chapterId === chapterId &&
        Math.abs(Date.now() - new Date(l.timestamp).getTime()) < 3000
    );
    if (recentDuplicate) {
      return;
    }

    let studentClass = userClass;
    if (!studentClass) {
      const users = this.getUsers();
      const matched = users.find((u) => u.id === userId);
      studentClass = matched?.gradeClass;
    }

    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId,
      userName,
      userRole,
      userClass: studentClass,
      action,
      details,
      courseId,
      chapterId,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    safeSetItem(STORAGE_KEYS.ACTIVITY_LOGS, logs.slice(0, 300));
    postServerAction('LOG_ACTIVITY', newLog);
    FirestoreService.saveActivityLog(newLog).catch(console.error);
  }

  /**
   * Memeriksa apakah ada siswa yang melewati batas waktu materi (inactivity deadline)
   * dan mencatatnya ke Log Riwayat Guru jika belum tercatat.
   */
  static checkAndLogOverdueDeadlines(
    studentId: string,
    studentName: string,
    studentClass?: string
  ): void {
    try {
      const allCourses = this.getCourses();
      const existingLogs = this.getActivityLogs();

      allCourses.forEach((course) => {
        // Cek apakah siswa berhak atas kursus ini
        if (course.targetClasses && course.targetClasses.length > 0 && studentClass) {
          if (!course.targetClasses.includes(studentClass)) return;
        }

        const chapters = this.getChapters(course.id);
        const progress = this.getUserProgress(studentId, course.id);
        const now = new Date();

        chapters.forEach((ch) => {
          const sched = ch.schedule;
          if (sched && sched.isEnabled !== false && sched.endDate) {
            const end = new Date(sched.endDate);
            end.setHours(23, 59, 59, 999);

            // Jika batas waktu terlewati
            if (now > end) {
              const isCompleted = progress.chapters?.[ch.id]?.is_completed;
              if (!isCompleted) {
                // Periksa apakah log sudah pernah dicatat agar tidak spam
                const alreadyLogged = existingLogs.some(
                  (l) =>
                    l.userId === studentId &&
                    l.chapterId === ch.id &&
                    l.action === 'DEADLINE_MISSED'
                );

                if (!alreadyLogged) {
                  const endFormatted = end.toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  });

                  this.logActivity(
                    studentId,
                    studentName,
                    'student',
                    'DEADLINE_MISSED',
                    `⚠️ Siswa tidak aktif / melewati batas akhir (${endFormatted}) pada materi "${ch.title}". Materi lanjutan otomatis terkunci.`,
                    course.id,
                    ch.id,
                    studentClass
                  );
                }
              }
            }
          }
        });
      });
    } catch (e) {
      console.error('Error checking overdue deadlines:', e);
    }
  }

  /**
   * Menghasilkan data Laporan Capaian Belajar Siswa per BAB (Model P5 / Kurikulum Merdeka).
   * Menghitung capaian seluruh asesmen/tugas, rerata nilai, tingkat perkembangan, dan XP.
   */
  static getBabLearningReport(studentId: string, courseId: string, babNumber: number): BabLearningReport {
    const users = this.getUsers();
    const student = users.find((u) => u.id === studentId);
    const course = this.getCourseById(courseId);
    const chapters = this.getChapters(courseId).filter((ch) => (ch.babNumber || 1) === babNumber);
    const progress = this.getUserProgress(studentId, courseId);
    const starSettings = this.getCourseStarSettings(courseId);
    const submissions = this.getSubmissions();

    const babTitle = chapters[0]?.babTitle || `BAB ${babNumber}`;
    let totalXpEarned = 0;
    let scoresSum = 0;
    let scoresCount = 0;
    let lastCompletedAt: string | undefined;

    const assessments: BabAssessmentItem[] = chapters.map((ch) => {
      const chProgress = progress.chapters?.[ch.id];
      const isCompleted = !!chProgress?.is_completed;
      if (chProgress?.lastAttemptAt) {
        lastCompletedAt = chProgress.lastAttemptAt;
      }

      // Hitung skor tugas/kuis/materi
      const score = chProgress?.score !== undefined ? chProgress.score : isCompleted ? 100 : 0;
      const progressInfo = getP5ProgressInfo(score);

      if (isCompleted) {
        scoresSum += score;
        scoresCount += 1;

        // Hitung XP bab
        let pts = ch.activityRewardPoints;
        if (pts === undefined || pts === null || isNaN(pts)) {
          switch (ch.type) {
            case 'video':
              pts = starSettings.defaultVideoXp ?? 25;
              break;
            case 'pdf':
              pts = starSettings.defaultPdfXp ?? 20;
              break;
            case 'text':
              pts = starSettings.defaultTextXp ?? 20;
              break;
            case 'link':
              pts = starSettings.defaultLinkXp ?? 15;
              break;
            case 'assignment':
              pts = starSettings.defaultAssignmentXp ?? 30;
              break;
            case 'quiz':
              pts = starSettings.defaultQuizXp ?? 30;
              break;
            default:
              pts = 20;
          }
        }
        totalXpEarned += pts;
      }

      const sub = submissions.find((s) => s.studentId === studentId && s.chapterId === ch.id);

      return {
        chapterId: ch.id,
        order_index: ch.order_index,
        title: ch.title,
        type: ch.type,
        score,
        progressInfo,
        isCompleted,
        completedAt: chProgress?.lastAttemptAt,
        feedback: sub?.teacherFeedback,
      };
    });

    const isBabFullyCompleted =
      chapters.length > 0 && chapters.every((ch) => !!progress.chapters?.[ch.id]?.is_completed);

    const averageScore = scoresCount > 0 ? Math.round((scoresSum / scoresCount) * 10) / 10 : 0;
    const overallProgress = getP5ProgressInfo(averageScore);

    // Bintang estimasi yang terakumulasi dari bab ini
    const xpPerStar = starSettings.xpPerStar || 100;
    const totalStarsEarned = Math.floor(totalXpEarned / xpPerStar);

    return {
      babNumber,
      babTitle,
      courseId,
      courseTitle: course?.title || 'Mata Pelajaran',
      courseSubject: course?.subject || 'Kejuruan',
      studentId,
      studentName: student?.name || 'Siswa',
      studentClass: student?.gradeClass || 'Kelas X',
      nisn: student?.nisn_nip || '-',
      teacherName: course?.teacherName || 'Guru Pembimbing',
      completedAt: lastCompletedAt || new Date().toISOString(),
      totalXpEarned,
      totalStarsEarned,
      assessments,
      averageScore,
      overallProgress,
      isBabFullyCompleted,
      teacherNotes: overallProgress.encouragement,
    };
  }

  /**
   * Menghasilkan rekapitulasi capaian seluruh siswa di kelas untuk satu BAB (digunakan untuk ekspor Excel).
   */
  static getClassBabReports(
    courseId: string,
    babNumber: number,
    targetClass?: string
  ): BabLearningReport[] {
    const allUsers = this.getUsers().filter((u) => u.role === 'student');
    const filteredStudents = targetClass && targetClass !== 'ALL'
      ? allUsers.filter((u) => u.gradeClass === targetClass)
      : allUsers;

    return filteredStudents.map((st) => this.getBabLearningReport(st.id, courseId, babNumber));
  }

  // Helper untuk reset database browser
  static resetToAdminOnly(): void {
    safeSetItem(STORAGE_KEYS.USERS, MOCK_USERS);
    safeSetItem(STORAGE_KEYS.CURRENT_USER, MOCK_USERS[0]);
    safeSetItem(STORAGE_KEYS.SUBMISSIONS, []);
    safeSetItem(STORAGE_KEYS.ACHIEVEMENTS, []);
    safeSetItem(STORAGE_KEYS.ACTIVITY_LOGS, []);
    FirestoreService.saveUser(MOCK_USERS[0]).catch(console.error);
  }
}
