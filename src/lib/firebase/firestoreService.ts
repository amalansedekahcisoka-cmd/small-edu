import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './client';
import { User, Course, Chapter, Submission, UserCourseProgress, ActivityLog, ClassRoom } from '@/types';

export const FirestoreService = {
  /**
   * Cek koneksi ke Firebase Firestore
   */
  async testConnection(): Promise<{ connected: boolean; message: string; projectId?: string }> {
    if (!isFirebaseConfigured) {
      return { connected: false, message: 'Kredensial Firebase belum terkonfigurasi di .env.local' };
    }
    try {
      const usersCol = collection(db, 'users');
      await getDocs(usersCol);
      return { connected: true, message: 'Terhubung langsung ke Cloud Firestore!', projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID };
    } catch (error: any) {
      console.error('Firebase connection error:', error);
      return { connected: false, message: error?.message || 'Gagal tersambung ke Firestore' };
    }
  },

  // --- USERS (CRUD) ---
  async getUsers(): Promise<User[]> {
    try {
      const col = collection(db, 'users');
      const snap = await getDocs(col);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as User));
    } catch (e) {
      console.warn('Fallback to local: error fetching users from Firestore', e);
      return [];
    }
  },

  async saveUser(user: User): Promise<void> {
    try {
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, user, { merge: true });
    } catch (e) {
      console.error('Error saving user to Firestore', e);
    }
  },

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, updates);
    } catch (e) {
      console.error('Error updating user in Firestore', e);
    }
  },

  async deleteUser(userId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await deleteDoc(userRef);
      await this.saveDeletedUserId(userId);
    } catch (e) {
      console.error('Error deleting user from Firestore', e);
    }
  },

  async getDeletedUserIds(): Promise<string[]> {
    try {
      const ref = doc(db, 'metadata', 'deleted_users');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        return Array.isArray(data?.ids) ? data.ids : [];
      }
      return [];
    } catch (e) {
      console.warn('Fallback: could not fetch deleted user IDs from Firestore', e);
      return [];
    }
  },

  async saveDeletedUserId(userId: string): Promise<void> {
    try {
      const ref = doc(db, 'metadata', 'deleted_users');
      const snap = await getDoc(ref);
      let currentIds: string[] = [];
      if (snap.exists()) {
        const data = snap.data();
        currentIds = Array.isArray(data?.ids) ? [...data.ids] : [];
      }
      if (!currentIds.includes(userId)) {
        currentIds.push(userId);
        await setDoc(ref, { ids: currentIds, updatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch (e) {
      console.error('Error saving deleted user ID to Firestore', e);
    }
  },

  async updateUserPasswordStatus(userId: string, mustChangePassword: boolean): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { mustChangePassword });
    } catch (e) {
      console.error('Error updating password status', e);
    }
  },

  // --- CLASSES (CRUD) ---
  async getClasses(): Promise<ClassRoom[]> {
    try {
      const col = collection(db, 'classes');
      const snap = await getDocs(col);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassRoom));
    } catch (e) {
      return [];
    }
  },

  async saveClass(c: ClassRoom): Promise<void> {
    try {
      const ref = doc(db, 'classes', c.id);
      await setDoc(ref, c, { merge: true });
    } catch (e) {
      console.error('Error saving class to Firestore', e);
    }
  },

  async updateClass(classId: string, updates: Partial<ClassRoom>): Promise<void> {
    try {
      const ref = doc(db, 'classes', classId);
      await updateDoc(ref, updates);
    } catch (e) {
      console.error('Error updating class in Firestore', e);
    }
  },

  async deleteClass(classId: string): Promise<void> {
    try {
      const ref = doc(db, 'classes', classId);
      await deleteDoc(ref);
      await this.saveDeletedClassId(classId);
    } catch (e) {
      console.error('Error deleting class from Firestore', e);
    }
  },

  async getDeletedClassIds(): Promise<string[]> {
    try {
      const ref = doc(db, 'metadata', 'deleted_classes');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        return Array.isArray(data?.ids) ? data.ids : [];
      }
      return [];
    } catch (e) {
      console.warn('Fallback: could not fetch deleted class IDs from Firestore', e);
      return [];
    }
  },

  async saveDeletedClassId(classId: string): Promise<void> {
    try {
      const ref = doc(db, 'metadata', 'deleted_classes');
      const snap = await getDoc(ref);
      let currentIds: string[] = [];
      if (snap.exists()) {
        const data = snap.data();
        currentIds = Array.isArray(data?.ids) ? [...data.ids] : [];
      }
      if (!currentIds.includes(classId)) {
        currentIds.push(classId);
        await setDoc(ref, { ids: currentIds, updatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch (e) {
      console.error('Error saving deleted class ID to Firestore', e);
    }
  },

  // --- COURSES & CHAPTERS ---
  async getCourses(): Promise<Course[]> {
    try {
      const col = collection(db, 'courses');
      const snap = await getDocs(col);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Course));
    } catch (e) {
      return [];
    }
  },

  async saveCourse(course: Course): Promise<void> {
    try {
      const ref = doc(db, 'courses', course.id);
      await setDoc(ref, course, { merge: true });
    } catch (e) {
      console.error('Error saving course to Firestore', e);
    }
  },

  async deleteCourse(courseId: string): Promise<void> {
    try {
      const ref = doc(db, 'courses', courseId);
      await deleteDoc(ref);
      await this.saveDeletedCourseId(courseId);
    } catch (e) {
      console.error('Error deleting course from Firestore', e);
    }
  },

  async getDeletedCourseIds(): Promise<string[]> {
    try {
      const ref = doc(db, 'metadata', 'deleted_courses');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data();
        return Array.isArray(data?.ids) ? data.ids : [];
      }
      return [];
    } catch (e) {
      console.warn('Fallback: could not fetch deleted course IDs from Firestore', e);
      return [];
    }
  },

  async saveDeletedCourseId(courseId: string): Promise<void> {
    try {
      const ref = doc(db, 'metadata', 'deleted_courses');
      const snap = await getDoc(ref);
      let currentIds: string[] = [];
      if (snap.exists()) {
        const data = snap.data();
        currentIds = Array.isArray(data?.ids) ? [...data.ids] : [];
      }
      if (!currentIds.includes(courseId)) {
        currentIds.push(courseId);
        await setDoc(ref, { ids: currentIds, updatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch (e) {
      console.error('Error saving deleted course ID to Firestore', e);
    }
  },

  async getChapters(courseId: string): Promise<Chapter[]> {
    try {
      const col = collection(db, 'courses', courseId, 'chapters');
      const snap = await getDocs(col);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chapter));
    } catch (e) {
      return [];
    }
  },

  async getAllChapters(): Promise<Chapter[]> {
    try {
      const courses = await this.getCourses();
      if (!courses || courses.length === 0) return [];
      const chapterPromises = courses.map((c) => this.getChapters(c.id));
      const chapterArrays = await Promise.all(chapterPromises);
      return chapterArrays.flat();
    } catch (e) {
      console.warn('Fallback: could not fetch all chapters from Firestore', e);
      return [];
    }
  },

  async saveChapter(courseId: string, chapter: Chapter): Promise<void> {
    try {
      const ref = doc(db, 'courses', courseId, 'chapters', chapter.id);
      await setDoc(ref, chapter, { merge: true });
    } catch (e) {
      console.error('Error saving chapter to Firestore', e);
    }
  },

  async updateChapter(courseId: string, chapterId: string, updates: Partial<Chapter>): Promise<void> {
    try {
      const ref = doc(db, 'courses', courseId, 'chapters', chapterId);
      await updateDoc(ref, updates);
    } catch (e) {
      console.error('Error updating chapter in Firestore', e);
    }
  },

  async deleteChapter(courseId: string, chapterId: string): Promise<void> {
    try {
      const ref = doc(db, 'courses', courseId, 'chapters', chapterId);
      await deleteDoc(ref);
    } catch (e) {
      console.error('Error deleting chapter from Firestore', e);
    }
  },

  // --- PROGRESS ---
  async getAllUserProgress(): Promise<UserCourseProgress[]> {
    try {
      const col = collection(db, 'user_progress');
      const snap = await getDocs(col);
      return snap.docs.map((d) => d.data() as UserCourseProgress);
    } catch (e) {
      console.warn('Fallback: could not fetch all progress from Firestore', e);
      return [];
    }
  },

  async getUserProgress(userId: string, courseId: string): Promise<UserCourseProgress | null> {
    try {
      const key = `${userId}_${courseId}`;
      const ref = doc(db, 'user_progress', key);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return snap.data() as UserCourseProgress;
      }
      return null;
    } catch (e) {
      console.warn('Fallback to local: error fetching user progress from Firestore', e);
      return null;
    }
  },

  async saveUserProgress(progress: UserCourseProgress): Promise<void> {
    try {
      const key = `${progress.userId}_${progress.courseId}`;
      const ref = doc(db, 'user_progress', key);
      await setDoc(ref, progress, { merge: true });
    } catch (e) {
      console.error('Error saving progress to Firestore', e);
    }
  },

  // --- SUBMISSIONS ---
  async getSubmissions(): Promise<Submission[]> {
    try {
      const col = collection(db, 'submissions');
      const snap = await getDocs(col);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Submission));
    } catch (e) {
      console.warn('Fallback: could not fetch submissions from Firestore', e);
      return [];
    }
  },

  async saveSubmission(submission: Submission): Promise<void> {
    try {
      const ref = doc(db, 'submissions', submission.id);
      await setDoc(ref, submission, { merge: true });
    } catch (e) {
      console.error('Error saving submission to Firestore', e);
    }
  },

  // --- ACTIVITY LOGS ---
  async getActivityLogs(maxLogs = 200): Promise<ActivityLog[]> {
    try {
      const col = collection(db, 'activity_logs');
      try {
        const q = query(col, orderBy('timestamp', 'desc'), limit(maxLogs));
        const snap = await getDocs(q);
        return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
      } catch (orderErr) {
        // Fallback without server-side orderBy if compound index isn't ready
        const snap = await getDocs(col);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityLog));
        return list
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, maxLogs);
      }
    } catch (e) {
      console.warn('Fallback: could not fetch activity logs from Firestore', e);
      return [];
    }
  },

  async saveActivityLog(log: ActivityLog): Promise<void> {
    try {
      const ref = doc(db, 'activity_logs', log.id);
      await setDoc(ref, log, { merge: true });
    } catch (e) {
      console.error('Error saving activity log to Firestore', e);
    }
  }
};
