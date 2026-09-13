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
  JoinRequest,
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
  DELETED_COURSES: 'smalledu_deleted_course_ids',
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

// Helper untuk kirim update ke server API (tersimpan di server file data/db.json)
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

// Helper untuk fetch snapshot database dari server (Hanya digunakan jika Firebase TIDAK aktif)
async function fetchServerData(): Promise<any> {
  if (typeof window === 'undefined') return null;
  // Jika Firebase aktif, jangan pernah timpa dengan data lokal db.json / mock
  if (isFirebaseConfigured) return null;
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
          data.activityLogs.forEach((l: ActivityLog) => {
            if (l && l.id && !serverDeletedIds.has(l.userId)) logMap.set(l.id, l);
          });
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
        if (data.deletedCourseIds && Array.isArray(data.deletedCourseIds)) safeSetItem(STORAGE_KEYS.DELETED_COURSES, data.deletedCourseIds);
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

// Inisialisasi pembersihan cache mock & background sync saat browser dibuka
if (typeof window !== 'undefined') {
  try {
    // 1. Bersihkan kursus mock lama dari localStorage
    const legacyMockCourseIds = ['course-web-dev', 'crs-1789119026980'];
    const currentDeletedCourses = safeGetItem<string[]>(STORAGE_KEYS.DELETED_COURSES, []);
    let updatedDeletedCourses = [...currentDeletedCourses];
    legacyMockCourseIds.forEach((id) => {
      if (!updatedDeletedCourses.includes(id)) updatedDeletedCourses.push(id);
    });
    safeSetItem(STORAGE_KEYS.DELETED_COURSES, updatedDeletedCourses);

    const storedCourses = safeGetItem<Course[]>(STORAGE_KEYS.COURSES, []);
    const cleanCourses = storedCourses.filter(
      (c) =>
        c &&
        !updatedDeletedCourses.includes(c.id) &&
        c.teacherId !== 'user-teacher-rudiansyah' &&
        c.id !== 'course-web-dev' &&
        c.id !== 'crs-1789119026980'
    );
    safeSetItem(STORAGE_KEYS.COURSES, cleanCourses);

    // 2. Bersihkan user mock lama dari localStorage
    const legacyMockUserIds = ['user-teacher-rudiansyah', 'user-student-ica'];
    const currentDeletedUsers = safeGetItem<string[]>(STORAGE_KEYS.DELETED_USERS, []);
    let updatedDeletedUsers = [...currentDeletedUsers];
    legacyMockUserIds.forEach((id) => {
      if (!updatedDeletedUsers.includes(id)) updatedDeletedUsers.push(id);
    });
    safeSetItem(STORAGE_KEYS.DELETED_USERS, updatedDeletedUsers);

    const storedUsers = safeGetItem<User[]>(STORAGE_KEYS.USERS, []);
    const cleanUsers = storedUsers.filter((u) => u && !updatedDeletedUsers.includes(u.id));
    safeSetItem(STORAGE_KEYS.USERS, cleanUsers);

    // 3. Bersihkan bab mock lama yang berhubungan dengan kursus mock
    const storedChapters = safeGetItem<Chapter[]>(STORAGE_KEYS.CHAPTERS, []);
    const cleanChapters = storedChapters.filter(
      (ch) => ch && !legacyMockCourseIds.includes(ch.courseId)
    );
    safeSetItem(STORAGE_KEYS.CHAPTERS, cleanChapters);
  } catch (e) {
    // ignore
  }

  // Jika Firebase tidak aktif, fallback sync ke server data
  if (!isFirebaseConfigured) {
    setTimeout(() => {
      fetchServerData().catch(() => {});
    }, 100);
  }
}

export class DataProvider {
  // Trigger sinkronisasi server & cloud firestore
  static async syncWithServer(): Promise<void> {
    try {
      const syncTasks: Promise<any>[] = [
        this.getUsersAsync(),
        this.getClassesAsync(),
        this.getCoursesAsync(),
        this.getChaptersAsync(),
        this.getActivityLogsAsync(),
        this.getSubmissionsAsync(),
        this.syncAllProgressAsync(),
      ];
      if (!isFirebaseConfigured) {
        syncTasks.unshift(fetchServerData());
      }
      await Promise.allSettled(syncTasks);
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
    const stored = safeGetItem<ClassRoom[]>(STORAGE_KEYS.CLASSES, []);
    return stored.filter((c) => c && !deletedIds.has(c.id));
  }

  static async getClassesAsync(): Promise<ClassRoom[]> {
    let allDeletedList = safeGetItem<string[]>(STORAGE_KEYS.DELETED_CLASSES, []);
    if (isFirebaseConfigured) {
      try {
        const firestoreDeleted = await FirestoreService.getDeletedClassIds?.();
        if (Array.isArray(firestoreDeleted) && firestoreDeleted.length > 0) {
          allDeletedList = Array.from(new Set([...allDeletedList, ...firestoreDeleted]));
          safeSetItem(STORAGE_KEYS.DELETED_CLASSES, allDeletedList);
        }
      } catch (e) {}
    }
    const deletedIds = new Set(allDeletedList);

    if (isFirebaseConfigured) {
      try {
        const firestoreClasses = await FirestoreService.getClasses();
        if (Array.isArray(firestoreClasses)) {
          const valid = firestoreClasses.filter((c) => c && !deletedIds.has(c.id));
          safeSetItem(STORAGE_KEYS.CLASSES, valid);
          return valid;
        }
      } catch (e) {
        console.warn('Firestore getClasses error:', e);
      }
    }

    // Ambil data terbaru dari server data/db.json jika Firebase belum disetup
    const serverData = await fetchServerData();
    if (serverData?.classes && Array.isArray(serverData.classes) && serverData.classes.length > 0) {
      const valid = (serverData.classes as ClassRoom[]).filter((c) => c && !deletedIds.has(c.id));
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
    if (current && current.id === userId) {
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
    // Hanya masukkan superadmin bawaan jika belum ada dan belum dihapus
    MOCK_USERS.forEach((u) => {
      if (!deletedIds.has(u.id)) {
        map.set(u.id, u);
      }
    });

    if (Array.isArray(stored)) {
      stored.forEach((u) => {
        if (u && !deletedIds.has(u.id)) {
          if (map.has(u.id)) {
            map.set(u.id, { ...map.get(u.id)!, ...u });
          } else {
            map.set(u.id, u);
          }
        }
      });
    }

    return Array.from(map.values()).filter((u) => !deletedIds.has(u.id));
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
        if (Array.isArray(firestoreUsers)) {
          const valid = firestoreUsers.filter((u) => u && !deletedIds.has(u.id));
          const userMap = new Map<string, User>();
          // Masukkan akun superadmin bawaan
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
            if (u && !deletedIds.has(u.id)) {
              const localPts = localPointsMap.get(u.id);
              const finalPoints = u.activityPoints !== undefined ? u.activityPoints : (localPts?.points || 0);
              const finalStars = u.starsCount !== undefined ? u.starsCount : (localPts?.stars || 0);
              const mergedUser: User = {
                ...userMap.get(u.id),
                ...u,
                activityPoints: finalPoints,
                starsCount: finalStars,
              };
              userMap.set(u.id, mergedUser);
            }
          });
          const merged = Array.from(userMap.values()).filter((u) => !deletedIds.has(u.id));
          // Keamanan: Hapus password dari objek user sebelum disimpan ke localStorage browser
          const sanitizedForStorage = merged.map((u) => {
            const { password, ...safeUser } = u as any;
            return safeUser as User;
          });
          safeSetItem(STORAGE_KEYS.USERS, sanitizedForStorage);
          return sanitizedForStorage;
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
      const [firestoreUsers, firestoreClasses] = await Promise.all([
        FirestoreService.getUsers(),
        FirestoreService.getClasses(),
      ]);
      const firestoreUserIds = new Set(firestoreUsers.map((u) => u.id));
      const firestoreClassIds = new Set(firestoreClasses.map((c) => c.id));

      const localUsers = this.getUsers();
      for (const u of localUsers) {
        // HANYA simpan ke Firestore jika user belum ada sama sekali di Firestore!
        // Jangan menimpa user yang sudah ada agar tidak merusak password / status mustChangePassword yang sudah diperbarui pengguna
        if (u.id.startsWith('user-') && u.id !== 'user-superadmin' && !firestoreUserIds.has(u.id)) {
          await FirestoreService.saveUser(u).catch(console.error);
        }
      }

      const localClasses = this.getClasses();
      for (const c of localClasses) {
        if (!firestoreClassIds.has(c.id)) {
          await FirestoreService.saveClass(c).catch(console.error);
        }
      }
    } catch (e) {
      console.warn('Sync local to firestore failed:', e);
    }
  }

  static getCurrentUser(): User | null {
    const current = safeGetItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (!current) return null;
    const users = this.getUsers();
    const latest = users.find((u) => u.id === current.id);
    if (latest) {
      return { ...current, ...latest };
    }
    return current;
  }

  static setCurrentUser(user: User): void {
    const { password, ...safeUser } = user as any;
    safeSetItem(STORAGE_KEYS.CURRENT_USER, safeUser);

    // Sinkronkan juga flag mustChangePassword dan data terbaru ke cache USERS lokal
    const users = safeGetItem<User[]>(STORAGE_KEYS.USERS, []);
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx !== -1) {
      users[idx] = {
        ...users[idx],
        ...safeUser,
        password: user.password || users[idx].password,
      };
      safeSetItem(STORAGE_KEYS.USERS, users);
    }
  }

  static async changePasswordAsync(userId: string, newPassword: string): Promise<boolean> {
    const cleanPassword = newPassword.trim();
    if (cleanPassword.length < 6) return false;

    // 1. Update di memory & localStorage
    const users = this.getUsers().map((u) => {
      if (u.id === userId) {
        return { ...u, password: cleanPassword, mustChangePassword: false };
      }
      return u;
    });
    safeSetItem(STORAGE_KEYS.USERS, users);

    const current = safeGetItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (current && current.id === userId) {
      this.setCurrentUser({ ...current, password: cleanPassword, mustChangePassword: false });
    }

    // 2. Simpan permanen ke Cloud Firestore
    if (isFirebaseConfigured) {
      try {
        await FirestoreService.updateUserPassword(userId, cleanPassword, false);
      } catch (e) {
        console.error('Error saving password to Firestore:', e);
      }
    }

    // 3. Simpan ke database server lokal (data/db.json)
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_USER',
          payload: { userId, updates: { password: cleanPassword, mustChangePassword: false } },
        }),
      });
    } catch (e) {
      console.warn('API sync failed during changePassword:', e);
    }

    // 4. Catat riwayat log aktivitas
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser) {
      this.logActivity(
        targetUser.id,
        targetUser.name,
        targetUser.role,
        'PASSWORD_CHANGED',
        `Pengguna ${targetUser.name} berhasil memperbarui kata sandi mandiri secara permanen.`,
        undefined,
        undefined,
        targetUser.gradeClass
      );
    }

    return true;
  }

  static changePassword(userId: string, newPassword: string): boolean {
    this.changePasswordAsync(userId, newPassword).catch(console.error);
    return true;
  }

  static async resetUserPassword(userId: string, defaultPassword?: string): Promise<boolean> {
    const users = this.getUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) return false;

    const resetPass = defaultPassword?.trim() || user.nisn_nip?.trim() || 'smalledu123';
    const updates = {
      password: resetPass,
      mustChangePassword: true,
    };

    // 1. Update localStorage
    const updatedUsers = users.map((u) => (u.id === userId ? { ...u, ...updates } : u));
    safeSetItem(STORAGE_KEYS.USERS, updatedUsers);

    const current = safeGetItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
    if (current && current.id === userId) {
      this.setCurrentUser({ ...current, ...updates });
    }

    // 2. Update Cloud Firestore
    if (isFirebaseConfigured) {
      try {
        await FirestoreService.updateUserPassword(userId, resetPass, true);
      } catch (e) {
        console.error('Error resetting password in Firestore:', e);
      }
    }

    // 3. Update server data/db.json
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_USER',
          payload: { userId, updates },
        }),
      });
    } catch (e) {
      console.warn('API sync failed during resetUserPassword:', e);
    }

    // 4. Log Aktivitas
    this.logActivity(
      'user-superadmin',
      'Superadmin',
      'admin',
      'RESET_PASSWORD',
      `Mereset kata sandi akun ${user.name} (${user.role === 'teacher' ? 'Guru' : 'Siswa'}) kembali ke ${
        user.role === 'teacher' ? 'NIP' : 'NISN'
      } (${resetPass}) dan mewajibkan ganti sandi saat login berikutnya.`,
      undefined,
      undefined,
      user.gradeClass
    );

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
      mustChangePassword: newUser.mustChangePassword !== undefined ? newUser.mustChangePassword : true,
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
    const deletedIds = new Set([
      ...safeGetItem<string[]>(STORAGE_KEYS.DELETED_COURSES, []),
      'course-web-dev',
      'crs-1789119026980',
    ]);
    const stored = safeGetItem<Course[]>(STORAGE_KEYS.COURSES, []);
    let hasMissingCode = false;
    const coursesWithCodes = stored.map((c) => {
      if (!c.joinCode) {
        hasMissingCode = true;
        return { ...c, joinCode: FirestoreService.generateJoinCode(c.subject || c.title) };
      }
      return c;
    });

    if (hasMissingCode) {
      safeSetItem(STORAGE_KEYS.COURSES, coursesWithCodes);
    }

    return coursesWithCodes.filter(
      (c) =>
        c &&
        c.id &&
        !deletedIds.has(c.id) &&
        c.teacherId !== 'user-teacher-rudiansyah' &&
        c.id !== 'course-web-dev' &&
        c.id !== 'crs-1789119026980'
    );
  }

  static async getCoursesAsync(): Promise<Course[]> {
    let allDeletedList = safeGetItem<string[]>(STORAGE_KEYS.DELETED_COURSES, []);
    if (!allDeletedList.includes('course-web-dev')) allDeletedList.push('course-web-dev');
    if (!allDeletedList.includes('crs-1789119026980')) allDeletedList.push('crs-1789119026980');

    if (isFirebaseConfigured) {
      try {
        const firestoreDeleted = await FirestoreService.getDeletedCourseIds?.();
        if (Array.isArray(firestoreDeleted) && firestoreDeleted.length > 0) {
          allDeletedList = Array.from(new Set([...allDeletedList, ...firestoreDeleted]));
          safeSetItem(STORAGE_KEYS.DELETED_COURSES, allDeletedList);
        }
      } catch (e) {}
    }
    const deletedIds = new Set(allDeletedList);

    if (isFirebaseConfigured) {
      try {
        const firestoreCourses = await FirestoreService.getCourses();
        if (Array.isArray(firestoreCourses) && firestoreCourses.length > 0) {
          const valid = firestoreCourses
            .filter(
              (c) =>
                c &&
                c.id &&
                !deletedIds.has(c.id) &&
                c.teacherId !== 'user-teacher-rudiansyah' &&
                c.id !== 'course-web-dev' &&
                c.id !== 'crs-1789119026980'
            )
            .map((c) => {
              if (!c.joinCode) {
                const code = FirestoreService.generateJoinCode(c.subject || c.title);
                FirestoreService.saveCourse({ ...c, joinCode: code }).catch(console.error);
                return { ...c, joinCode: code };
              }
              return c;
            });

          safeSetItem(STORAGE_KEYS.COURSES, valid);
          return valid;
        }
      } catch (e) {
        console.warn('Firestore getCourses error in DataProvider:', e);
      }
    }

    const serverData = await fetchServerData();
    if (serverData?.courses && Array.isArray(serverData.courses) && serverData.courses.length > 0) {
      const valid = (serverData.courses as Course[])
        .filter(
          (c) =>
            c &&
            c.id &&
            !deletedIds.has(c.id) &&
            c.teacherId !== 'user-teacher-rudiansyah' &&
            c.id !== 'course-web-dev' &&
            c.id !== 'crs-1789119026980'
        )
        .map((c) => {
          if (!c.joinCode) {
            return { ...c, joinCode: FirestoreService.generateJoinCode(c.subject || c.title) };
          }
          return c;
        });

      safeSetItem(STORAGE_KEYS.COURSES, valid);
      return valid;
    }
    return this.getCourses();
  }

  static getCourseById(courseId: string): Course | undefined {
    const courses = this.getCourses();
    return courses.find((c) => c.id === courseId);
  }

  static async addCourse(newCourse: Omit<Course, 'id'>): Promise<Course> {
    const courses = this.getCourses();
    const created: Course = {
      ...newCourse,
      id: `crs-${Date.now()}`,
      joinCode: newCourse.joinCode || FirestoreService.generateJoinCode(newCourse.subject || newCourse.title),
    };
    courses.push(created);
    safeSetItem(STORAGE_KEYS.COURSES, courses);
    postServerAction('ADD_COURSE', created);
    if (isFirebaseConfigured) {
      await FirestoreService.saveCourse(created).catch(console.error);
    }
    return created;
  }

  static async updateCourseJoinCode(courseId: string, customCode: string): Promise<boolean> {
    const cleanCode = customCode.trim().toUpperCase();
    await this.updateCourse(courseId, { joinCode: cleanCode });
    return true;
  }

  static async updateCourse(courseId: string, updates: Partial<Course>): Promise<void> {
    const courses = this.getCourses().map((c) => {
      if (c.id === courseId) {
        return { ...c, ...updates };
      }
      return c;
    });
    safeSetItem(STORAGE_KEYS.COURSES, courses);
    postServerAction('UPDATE_COURSE', { courseId, updates });
    const target = courses.find((c) => c.id === courseId);
    if (target && isFirebaseConfigured) {
      await FirestoreService.saveCourse(target).catch(console.error);
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

  static async updateCourseStarSettings(courseId: string, settings: Partial<CourseStarSettings>): Promise<CourseStarSettings> {
    const current = this.getCourseStarSettings(courseId);
    const updated: CourseStarSettings = { ...current, ...settings };
    await this.updateCourse(courseId, { starSettings: updated });
    await this.syncAllStudentsCoursePoints(courseId);
    return updated;
  }

  static deleteCourse(courseId: string): void {
    const deletedIds = safeGetItem<string[]>(STORAGE_KEYS.DELETED_COURSES, []);
    if (!deletedIds.includes(courseId)) {
      deletedIds.push(courseId);
      safeSetItem(STORAGE_KEYS.DELETED_COURSES, deletedIds);
    }

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
    if (isFirebaseConfigured) {
      try {
        if (courseId) {
          const chs = await FirestoreService.getChapters(courseId);
          if (Array.isArray(chs)) {
            const allLocal = this.getChapters();
            const map = new Map<string, Chapter>();
            // 1. Simpan bab lokal kursus ini (agar materi yang baru ditambahkan tidak hilang saat sync in-flight)
            allLocal.filter((c) => c.courseId === courseId).forEach((c) => map.set(c.id, c));
            // 2. Timpa / tambahkan dari Firestore
            chs.forEach((c) => {
              if (c && c.id) map.set(c.id, { ...map.get(c.id), ...c });
            });
            const mergedThisCourse = Array.from(map.values()).sort((a, b) => a.order_index - b.order_index);
            const otherChapters = allLocal.filter((c) => c.courseId !== courseId);
            safeSetItem(STORAGE_KEYS.CHAPTERS, [...otherChapters, ...mergedThisCourse]);
            return mergedThisCourse;
          }
        } else {
          const allChs = await FirestoreService.getAllChapters();
          if (Array.isArray(allChs)) {
            const map = new Map<string, Chapter>();
            const allLocal = this.getChapters();
            allLocal.forEach((c) => map.set(c.id, c));
            allChs.forEach((c) => {
              if (c && c.id) map.set(c.id, { ...map.get(c.id), ...c });
            });
            const merged = Array.from(map.values()).sort((a, b) => a.order_index - b.order_index);
            safeSetItem(STORAGE_KEYS.CHAPTERS, merged);
            return merged;
          }
        }
      } catch (e) {
        console.warn('Firestore getChapters error in DataProvider:', e);
      }
    }

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

  static async addChapter(newChapter: Omit<Chapter, 'id'>): Promise<Chapter> {
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
      await this.updateCourse(course.id, {
        chaptersCount: this.getChapters(course.id).length,
      });
    }

    if (isFirebaseConfigured) {
      await FirestoreService.saveChapter(newChapter.courseId, created).catch(console.error);
    }
    return created;
  }

  static async updateChapter(chapterId: string, updates: Partial<Chapter>): Promise<void> {
    const chapters = this.getChapters().map((ch) => {
      if (ch.id === chapterId) {
        return { ...ch, ...updates };
      }
      return ch;
    });
    safeSetItem(STORAGE_KEYS.CHAPTERS, chapters);
    postServerAction('UPDATE_CHAPTER', { chapterId, updates });

    const target = chapters.find((ch) => ch.id === chapterId);
    if (target && isFirebaseConfigured) {
      await FirestoreService.updateChapter(target.courseId, chapterId, updates).catch(console.error);
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

    // Hitung apakah perlu membuka bab berikutnya (berapa pun nilainya, asalkan sudah dikerjakan/diselesaikan)
    const allChapters = this.getChapters(courseId);
    const currentCh = allChapters.find((c) => c.id === chapterId);
    const isFinished = updatedChapter.is_completed || updatedChapter.status === 'passed' || updatedChapter.status === 'failed';

    if (currentCh && isFinished) {
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

  static async approveSubmissionAsync(
    submissionId: string,
    finalScore: number,
    feedback: string,
    teacherName: string,
    fallbackSub?: Submission,
    teacherGrace: boolean = false
  ): Promise<Submission | null> {
    let subs = this.getSubmissions();
    let index = subs.findIndex((s) => s.id === submissionId);

    let target: Submission;
    if (index === -1) {
      if (fallbackSub) {
        target = fallbackSub;
        subs.unshift(target);
        index = 0;
      } else {
        const firestoreSubs = await FirestoreService.getSubmissions();
        const found = firestoreSubs.find((s) => s.id === submissionId);
        if (found) {
          target = found;
          subs.unshift(target);
          index = 0;
        } else {
          return null;
        }
      }
    } else {
      target = subs[index];
    }

    const updated: Submission = {
      ...target,
      finalScore,
      teacherFeedback: feedback,
      gradedBy: teacherName,
      gradedAt: new Date().toISOString(),
      status: 'graded',
      teacherGrace: teacherGrace || false,
    };
    subs[index] = updated;
    safeSetItem(STORAGE_KEYS.SUBMISSIONS, subs);
    postServerAction('UPDATE_SUBMISSION', { submissionId, updates: updated });

    if (isFirebaseConfigured) {
      await FirestoreService.saveSubmission(updated).catch(console.error);
    }

    const chapters = await this.getChaptersAsync(target.courseId);
    const chapter = chapters.find((c) => c.id === target.chapterId);
    const passingGrade = chapter?.passing_grade ?? 75;
    const isPurePassed = finalScore >= passingGrade;
    const isEffectivePassed = isPurePassed || teacherGrace;

    const currentAttempt = target.attemptNumber || 1;
    const maxAttempts = 2;
    // Jika tuntas (murni ataupun karena kebijaksanaan guru), remedial tidak diperbolehkan
    const remedialAllowed = !isEffectivePassed && currentAttempt < maxAttempts;

    // Ambil progres siswa riil dari Firestore (bukan dari cache guru)
    let studentProgress = await this.getUserProgressAsync(target.studentId, target.courseId);
    if (!studentProgress) {
      studentProgress = this.getUserProgress(target.studentId, target.courseId);
    }

    const existingCh = studentProgress.chapters?.[target.chapterId] || {
      chapterId: target.chapterId,
      order_index: chapter?.order_index || 1,
      is_completed: false,
      status: 'unlocked',
    };

    studentProgress.chapters[target.chapterId] = {
      ...existingCh,
      is_completed: true, // Bab ditandai selesai dipelajari/dikerjakan
      score: finalScore,
      status: isEffectivePassed ? 'passed' : 'failed',
      attemptCount: currentAttempt,
      maxAttempts,
      remedialAllowed,
      teacherFeedback: feedback,
      teacherGrace: teacherGrace || false,
      lastAttemptAt: new Date().toISOString(),
    };

    // Buka bab selanjutnya berapa pun nilainya
    if (chapter) {
      const nextIndex = chapter.order_index + 1;
      const nextCh = chapters.find((c) => c.order_index === nextIndex);
      if (nextCh) {
        if (!studentProgress.chapters[nextCh.id]) {
          studentProgress.chapters[nextCh.id] = {
            chapterId: nextCh.id,
            order_index: nextIndex,
            is_completed: false,
            status: 'unlocked',
          };
        } else if (studentProgress.chapters[nextCh.id].status === 'locked') {
          studentProgress.chapters[nextCh.id].status = 'unlocked';
        }
      }
      studentProgress.current_chapter_index = Math.max(studentProgress.current_chapter_index, nextIndex);
    }

    const key = `${STORAGE_KEYS.PROGRESS_PREFIX}${target.studentId}_${target.courseId}`;
    safeSetItem(key, studentProgress);
    if (isFirebaseConfigured) {
      await FirestoreService.saveUserProgress(studentProgress).catch(console.error);
    }

    const statusLabel = isPurePassed
      ? 'Tuntas'
      : teacherGrace
      ? 'Tuntas (Kebijaksanaan Guru)'
      : currentAttempt < 2
      ? 'Belum Tuntas / Remedial Tersedia'
      : 'Belum Tuntas / Kesempatan Habis';

    this.logActivity(
      target.studentId,
      target.studentName,
      'student',
      teacherGrace ? 'TEACHER_GRACE_PASSED' : 'SUBMISSION_GRADED',
      `Tugas/Kuis ${chapter?.title || ''} (${currentAttempt === 2 ? 'Remedial' : 'Percobaan 1'}) diverifikasi oleh ${teacherName} dengan nilai akhir ${finalScore} (Standar: ${passingGrade} - ${statusLabel}${teacherGrace ? ' - Tanpa Bonus XP' : ''}).`,
      target.courseId,
      target.chapterId
    );

    // KONEKSI SKOR XP: HANYA DIBERIKAN JIKA LULUS MURNI (isPurePassed), TIDAK DIBERIKAN UNTUK KEBIJAKSANAAN GURU
    if (isPurePassed && !studentProgress.chapters?.[target.chapterId]?.xpClaimed) {
      const starSettings = this.getCourseStarSettings(target.courseId);
      let basePoints = chapter?.activityRewardPoints;
      if (!basePoints) {
        basePoints = chapter?.type === 'quiz'
          ? (starSettings.defaultQuizXp ?? 30)
          : (starSettings.defaultAssignmentXp ?? 30);
      }
      this.addActivityPoints(
        target.studentId,
        basePoints,
        'Penilaian Guru Tuntas',
        `Hasil evaluasi ${chapter?.title || 'Tugas/Ujian'} oleh ${teacherName} dinyatakan tuntas murni dengan nilai ${finalScore}`,
        'ACADEMIC_EXCELLENCE',
        target.courseId,
        target.chapterId
      );
      studentProgress.chapters[target.chapterId].xpClaimed = true;
      safeSetItem(key, studentProgress);
      if (isFirebaseConfigured) {
        FirestoreService.saveUserProgress(studentProgress).catch(console.error);
      }
    }

    return updated;
  }

  static approveSubmission(
    submissionId: string,
    finalScore: number,
    feedback: string,
    teacherName: string,
    teacherGrace: boolean = false
  ): Submission | null {
    this.approveSubmissionAsync(submissionId, finalScore, feedback, teacherName, undefined, teacherGrace).catch(console.error);
    const subs = this.getSubmissions();
    const index = subs.findIndex((s) => s.id === submissionId);
    if (index === -1) return null;
    return subs[index];
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
    if (currentUser && currentUser.id === userId) {
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
    if (calculatedPoints !== currentPoints) {
      const primaryCourse = courses[0];
      const starSettings = primaryCourse ? this.getCourseStarSettings(primaryCourse.id) : DEFAULT_STAR_SETTINGS;
      const xpPerStar = starSettings.xpPerStar || 100;
      const newStars = Math.floor(calculatedPoints / xpPerStar);

      user.activityPoints = calculatedPoints;
      user.starsCount = newStars;

      safeSetItem(STORAGE_KEYS.USERS, users);
      postServerAction('UPDATE_USER', {
        userId,
        updates: { activityPoints: calculatedPoints, starsCount: newStars },
      });
      if (isFirebaseConfigured) {
        FirestoreService.updateUser(userId, { activityPoints: calculatedPoints, starsCount: newStars }).catch(console.error);
      }

      const current = safeGetItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
      if (current && current.id === userId) {
        this.setCurrentUser({ ...current, ...user, activityPoints: calculatedPoints, starsCount: newStars });
      }

      const diff = calculatedPoints - currentPoints;
      this.logActivity(
        userId,
        user.name,
        'student',
        'SYNC_XP_REWARD',
        `Penyelarasan otomatis poin keaktifan: disesuaikan menjadi ${calculatedPoints} XP (${diff >= 0 ? '+' : ''}${diff} XP) berdasarkan bobot penilaian terbaru dari guru.`,
        undefined,
        undefined,
        user.gradeClass
      );
    }

    return { totalPoints: user.activityPoints || 0, currentStars: user.starsCount || 0 };
  }

  /**
   * Menyelaraskan ulang Poin Keaktifan (XP) seluruh siswa yang telah menyelesaikan materi
   * saat guru mengubah bobot nilai/skor XP mata pelajaran atau bab.
   */
  static async syncAllStudentsCoursePoints(courseId?: string): Promise<void> {
    const users = this.getUsers().filter((u) => u.role === 'student');
    for (const student of users) {
      this.syncUserActivityPoints(student.id);
    }
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
        if (Array.isArray(firestoreLogs)) {
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

    // Mencegah log berulang beruntun dalam jeda waktu singkat
    const isNavigationAction = ['LOGIN', 'OPEN_CHAPTER', 'STUDENT_PORTAL_VISIT'].includes(action);
    const debounceWindow = isNavigationAction ? 60000 : 3000;
    const recentDuplicate = logs.slice(0, 15).find(
      (l) =>
        l.userId === userId &&
        l.action === action &&
        (l.chapterId === chapterId || (!l.chapterId && !chapterId)) &&
        Math.abs(Date.now() - new Date(l.timestamp).getTime()) < debounceWindow
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

  // --- JOIN CODES, SELF REGISTRATION & APPROVAL WRAPPERS ---
  /**
   * Cari Course berdasarkan Join Code (Cloud-First dengan Fallback)
   */
  static async getCourseByJoinCode(code: string): Promise<Course | null> {
    const cleaned = code.trim().toUpperCase();
    // 1. Cek langsung ke Cloud Firestore
    const fromFirestore = await FirestoreService.getCourseByJoinCode(cleaned);
    if (fromFirestore) return fromFirestore;

    // 2. Fallback cek ke daftar kursus lokal
    const courses = this.getCourses();
    const matched = courses.find((c) => (c.joinCode || '').toUpperCase() === cleaned);
    if (matched) return matched;

    return null;
  }

  /**
   * Cek apakah NISN sudah terdaftar di Cloud Firestore
   */
  static async checkNisnExists(nisn: string): Promise<{ exists: boolean; user?: User }> {
    return await FirestoreService.checkNisnExists(nisn);
  }

  /**
   * Registrasi Mandiri Siswa dengan Join Code (Cloud-First)
   */
  static async registerStudentSelf(data: {
    name: string;
    nisn: string;
    password: string;
    courseId: string;
    courseTitle: string;
    teacherId: string;
    teacherName: string;
    gradeClass?: string;
  }): Promise<{ success: boolean; message: string; user?: User }> {
    const res = await FirestoreService.registerStudentSelf(data);
    if (res.success && res.user) {
      // Simpan juga ke cache lokal agar langsung sinkron bila dibuka di browser yang sama
      const users = this.getUsers();
      if (!users.some((u) => u.id === res.user!.id)) {
        users.push(res.user);
        safeSetItem(STORAGE_KEYS.USERS, users);
      }
    }
    return res;
  }

  /**
   * Siswa mengajukan diri bergabung ke Mapel / Kursus lain
   */
  static async requestJoinOtherCourse(studentId: string, course: Course): Promise<{ success: boolean; message: string }> {
    return await FirestoreService.requestJoinOtherCourse(studentId, course);
  }

  /**
   * Guru mengambil antrean permintaan bergabung
   */
  static async getTeacherJoinRequests(teacherId: string): Promise<JoinRequest[]> {
    return await FirestoreService.getTeacherJoinRequests(teacherId);
  }

  /**
   * Guru menyetujui siswa bergabung ke kelas
   */
  static async approveStudentJoin(requestId: string, studentId: string, courseId: string): Promise<{ success: boolean; message: string }> {
    const res = await FirestoreService.approveStudentJoin(requestId, studentId, courseId);
    if (res.success) {
      // Sinkronkan cache lokal jika ada
      const users = this.getUsers();
      const st = users.find((u) => u.id === studentId);
      if (st) {
        st.status = 'active';
        st.enrolledCourses = (st.enrolledCourses || []).map((e) =>
          e.courseId === courseId ? { ...e, status: 'active' as const } : e
        );
        safeSetItem(STORAGE_KEYS.USERS, users);
      }
    }
    return res;
  }

  /**
   * Guru menolak siswa bergabung ke kelas
   */
  static async rejectStudentJoin(requestId: string, studentId: string, courseId: string): Promise<{ success: boolean; message: string }> {
    const res = await FirestoreService.rejectStudentJoin(requestId, studentId, courseId);
    if (res.success) {
      const users = this.getUsers();
      const st = users.find((u) => u.id === studentId);
      if (st) {
        st.enrolledCourses = (st.enrolledCourses || []).filter((e) => e.courseId !== courseId);
        safeSetItem(STORAGE_KEYS.USERS, users);
      }
    }
    return res;
  }

  /**
   * Memastikan seluruh kursus memiliki kode join
   */
  static async ensureCourseJoinCodes(): Promise<void> {
    await FirestoreService.ensureCourseJoinCodes();
  }
}
