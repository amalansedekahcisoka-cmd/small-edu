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
import { User, Course, Chapter, Submission, UserCourseProgress, ActivityLog, ClassRoom, JoinRequest } from '@/types';

function sanitizeForFirestore<T>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  return JSON.parse(JSON.stringify(data));
}

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
      await setDoc(userRef, sanitizeForFirestore(user), { merge: true });
    } catch (e) {
      console.error('Error saving user to Firestore', e);
    }
  },

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, sanitizeForFirestore(updates), { merge: true });
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

  async updateUserPassword(userId: string, newPassword: string, mustChangePassword: boolean = false): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          password: newPassword,
          mustChangePassword,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error('Error updating password in Firestore', e);
    }
  },

  async updateUserPasswordStatus(userId: string, mustChangePassword: boolean): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { mustChangePassword }, { merge: true });
    } catch (e) {
      console.error('Error updating password status in Firestore', e);
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
      await setDoc(ref, sanitizeForFirestore(c), { merge: true });
    } catch (e) {
      console.error('Error saving class to Firestore', e);
    }
  },

  async updateClass(classId: string, updates: Partial<ClassRoom>): Promise<void> {
    try {
      const ref = doc(db, 'classes', classId);
      await updateDoc(ref, sanitizeForFirestore(updates));
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
      await setDoc(ref, sanitizeForFirestore(course), { merge: true });
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
      await setDoc(ref, sanitizeForFirestore(chapter), { merge: true });
    } catch (e) {
      console.error('Error saving chapter to Firestore', e);
    }
  },

  async updateChapter(courseId: string, chapterId: string, updates: Partial<Chapter>): Promise<void> {
    try {
      const ref = doc(db, 'courses', courseId, 'chapters', chapterId);
      await setDoc(ref, sanitizeForFirestore(updates), { merge: true });
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
      await setDoc(ref, sanitizeForFirestore(progress), { merge: true });
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
      await setDoc(ref, sanitizeForFirestore(submission), { merge: true });
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
      await setDoc(ref, sanitizeForFirestore(log), { merge: true });
    } catch (e) {
      console.error('Error saving activity log to Firestore', e);
    }
  },

  // --- JOIN CODE, REGISTRATION & COURSE APPROVAL ---
  /**
   * Helper membuat Join Code 6 digit alfanumerik (misal: "MTK-7A" atau "K8X2PQ")
   */
  generateJoinCode(subject = ''): string {
    const prefix = subject ? subject.trim().substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') : '';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let rand = '';
    for (let i = 0; i < 3; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix && prefix.length >= 2 ? `${prefix}-${rand}` : `${rand}${chars.charAt(Math.floor(Math.random() * chars.length))}${chars.charAt(Math.floor(Math.random() * chars.length))}`;
  },

  /**
   * Cari Course berdasarkan Join Code
   */
  async getCourseByJoinCode(joinCode: string): Promise<Course | null> {
    try {
      const cleaned = joinCode.trim().toUpperCase();
      const col = collection(db, 'courses');
      const q = query(col, where('joinCode', '==', cleaned));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() } as Course;
      }
      return null;
    } catch (e) {
      console.error('Error finding course by join code', e);
      return null;
    }
  },

  /**
   * Pastikan semua Course memiliki Join Code unik
   */
  async ensureCourseJoinCodes(): Promise<void> {
    try {
      const courses = await this.getCourses();
      const existingCodes = new Set<string>();
      for (const c of courses) {
        if (c.joinCode) existingCodes.add(c.joinCode);
      }

      for (const c of courses) {
        if (!c.joinCode) {
          let code = this.generateJoinCode(c.subject || c.title);
          while (existingCodes.has(code)) {
            code = this.generateJoinCode(c.subject || c.title);
          }
          existingCodes.add(code);
          await this.saveCourse({ ...c, joinCode: code });
        }
      }
    } catch (e) {
      console.error('Error ensuring course join codes', e);
    }
  },

  /**
   * Cek apakah NISN sudah terdaftar di Firestore
   */
  async checkNisnExists(nisn: string): Promise<{ exists: boolean; user?: User }> {
    try {
      const cleaned = nisn.trim();
      const col = collection(db, 'users');
      const q = query(col, where('nisn_nip', '==', cleaned));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { exists: true, user: { id: d.id, ...d.data() } as User };
      }
      return { exists: false };
    } catch (e) {
      console.error('Error checking NISN existence', e);
      return { exists: false };
    }
  },

  /**
   * Pendaftaran mandiri siswa pertama kali via Join Code
   */
  async registerStudentSelf(data: {
    name: string;
    nisn: string;
    password: string;
    courseId: string;
    courseTitle: string;
    teacherId: string;
    teacherName: string;
    gradeClass?: string;
  }): Promise<{ success: boolean; message: string; user?: User }> {
    try {
      // 1. Validasi NISN unik
      const check = await this.checkNisnExists(data.nisn);
      if (check.exists) {
        return {
          success: false,
          message: 'NISN ini sudah terdaftar di sistem. Silakan login atau hubungi guru/admin jika lupa password.'
        };
      }

      const userId = `student_${Date.now()}`;
      const now = new Date().toISOString();

      const newUser: User = {
        id: userId,
        name: data.name.trim(),
        email: `${data.nisn.trim()}@student.small-edu.id`,
        role: 'student',
        nisn_nip: data.nisn.trim(),
        password: data.password,
        mustChangePassword: false,
        starsCount: 0,
        activityPoints: 0,
        gradeClass: data.gradeClass || 'Umum',
        status: 'pending', // Menunggu persetujuan guru
        createdAt: now,
        enrolledCourses: [
          {
            courseId: data.courseId,
            teacherId: data.teacherId,
            courseTitle: data.courseTitle,
            teacherName: data.teacherName,
            status: 'pending',
            joinedAt: now
          }
        ]
      };

      // Simpan User baru
      await this.saveUser(newUser);

      // Buat Join Request agar Guru mudah membaca antrean
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const requestData: JoinRequest = {
        id: requestId,
        studentId: userId,
        studentName: data.name.trim(),
        studentNisn: data.nisn.trim(),
        studentClass: data.gradeClass || 'Umum',
        courseId: data.courseId,
        courseTitle: data.courseTitle,
        teacherId: data.teacherId,
        teacherName: data.teacherName,
        status: 'pending',
        createdAt: now
      };

      const reqRef = doc(db, 'join_requests', requestId);
      await setDoc(reqRef, sanitizeForFirestore(requestData), { merge: true });

      return { success: true, message: 'Pendaftaran berhasil dikirim. Menunggu persetujuan guru!', user: newUser };
    } catch (e: any) {
      console.error('Error registering student self', e);
      return { success: false, message: e?.message || 'Gagal melakukan pendaftaran. Silakan coba lagi.' };
    }
  },

  /**
   * Siswa yang sudah aktif mengajukan gabung ke mapel / kursus lain
   */
  async requestJoinOtherCourse(studentId: string, course: Course): Promise<{ success: boolean; message: string }> {
    try {
      const userRef = doc(db, 'users', studentId);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        return { success: false, message: 'Data siswa tidak ditemukan.' };
      }

      const student = { id: userSnap.id, ...userSnap.data() } as User;
      const enrolled = student.enrolledCourses || [];

      // Cek apakah sudah terdaftar atau sedang pending di kursus ini
      const existing = enrolled.find((e) => e.courseId === course.id);
      if (existing) {
        if (existing.status === 'active') {
          return { success: false, message: 'Anda sudah resmi terdaftar dan aktif di kelas ini.' };
        }
        if (existing.status === 'pending') {
          return { success: false, message: 'Permintaan bergabung Anda sedang menunggu persetujuan guru.' };
        }
      }

      const now = new Date().toISOString();
      const updatedEnrolled = [
        ...enrolled.filter((e) => e.courseId !== course.id),
        {
          courseId: course.id,
          teacherId: course.teacherId,
          courseTitle: course.title,
          teacherName: course.teacherName,
          status: 'pending' as const,
          joinedAt: now
        }
      ];

      // Update User enrolledCourses
      await setDoc(userRef, sanitizeForFirestore({ enrolledCourses: updatedEnrolled }), { merge: true });

      // Buat Join Request untuk Guru
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const requestData: JoinRequest = {
        id: requestId,
        studentId: student.id,
        studentName: student.name,
        studentNisn: student.nisn_nip || '',
        studentClass: student.gradeClass || 'Umum',
        courseId: course.id,
        courseTitle: course.title,
        teacherId: course.teacherId,
        teacherName: course.teacherName,
        status: 'pending',
        createdAt: now
      };

      const reqRef = doc(db, 'join_requests', requestId);
      await setDoc(reqRef, sanitizeForFirestore(requestData), { merge: true });

      return { success: true, message: `Permintaan bergabung ke kelas ${course.title} berhasil dikirim!` };
    } catch (e: any) {
      console.error('Error requesting join other course', e);
      return { success: false, message: e?.message || 'Gagal mengirim permintaan gabung kelas.' };
    }
  },

  /**
   * Guru mengambil daftar permintaan join siswa untuk kelas yang diampunya
   */
  async getTeacherJoinRequests(teacherId: string): Promise<JoinRequest[]> {
    try {
      const col = collection(db, 'join_requests');
      const q = query(col, where('teacherId', '==', teacherId), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as JoinRequest));
    } catch (e) {
      console.error('Error fetching teacher join requests', e);
      return [];
    }
  },

  /**
   * Guru menyetujui siswa bergabung ke kelas
   */
  async approveStudentJoin(requestId: string, studentId: string, courseId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Update status JoinRequest jadi 'approved'
      const reqRef = doc(db, 'join_requests', requestId);
      await setDoc(reqRef, { status: 'approved', approvedAt: new Date().toISOString() }, { merge: true });

      // 2. Update status siswa di User.enrolledCourses dan User.status
      const userRef = doc(db, 'users', studentId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const student = { id: userSnap.id, ...userSnap.data() } as User;
        const enrolled = (student.enrolledCourses || []).map((item) => {
          if (item.courseId === courseId) {
            return { ...item, status: 'active' as const };
          }
          return item;
        });

        // Pastikan akun utama siswa juga berstatus 'active'
        await setDoc(
          userRef,
          sanitizeForFirestore({
            status: 'active',
            enrolledCourses: enrolled
          }),
          { merge: true }
        );
      }

      return { success: true, message: 'Siswa berhasil disetujui bergabung ke kelas!' };
    } catch (e: any) {
      console.error('Error approving student join', e);
      return { success: false, message: e?.message || 'Gagal menyetujui siswa.' };
    }
  },

  /**
   * Guru menolak siswa bergabung ke kelas
   */
  async rejectStudentJoin(requestId: string, studentId: string, courseId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Update status JoinRequest jadi 'rejected'
      const reqRef = doc(db, 'join_requests', requestId);
      await setDoc(reqRef, { status: 'rejected', rejectedAt: new Date().toISOString() }, { merge: true });

      // 2. Update atau hapus dari enrolledCourses
      const userRef = doc(db, 'users', studentId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const student = { id: userSnap.id, ...userSnap.data() } as User;
        const enrolled = (student.enrolledCourses || []).filter((item) => item.courseId !== courseId);
        
        // Jika tidak ada kelas lain dan akun baru, bisa tandai rejected atau hapus
        const hasOtherActive = enrolled.some((e) => e.status === 'active');
        await setDoc(
          userRef,
          sanitizeForFirestore({
            status: hasOtherActive ? 'active' : 'rejected',
            enrolledCourses: enrolled
          }),
          { merge: true }
        );
      }

      return { success: true, message: 'Permintaan siswa berhasil ditolak.' };
    } catch (e: any) {
      console.error('Error rejecting student join', e);
      return { success: false, message: e?.message || 'Gagal menolak siswa.' };
    }
  }
};
