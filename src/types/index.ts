export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  nisn_nip?: string;
  mustChangePassword?: boolean;
  avatar?: string;
  starsCount: number;
  activityPoints?: number;     // Akumulasi Poin Keaktifan Belajar (XP). 100 XP = 1 Bintang
  gradeClass?: string;         // untuk Siswa: kelas mereka (e.g. "X RPL 1")
  assignedClasses?: string[];  // untuk Guru: daftar kelas yang diajar
  password?: string;
  createdAt: string;
}

export interface ClassRoom {
  id: string;
  name: string; // e.g. "X RPL 1"
  major?: string; // e.g. "Rekayasa Perangkat Lunak"
  gradeLevel?: string; // e.g. "Kelas X"
  createdAt: string;
}

export type ChapterType = 'text' | 'video' | 'pdf' | 'link' | 'assignment' | 'quiz';

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MCMA'
  | 'CATEGORY_MATRIX'
  | 'SHORT_ESSAY'
  | 'LONG_ESSAY';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface MatrixRow {
  id: string;
  statement: string;
  correctCategory: string; // e.g. "Benar" | "Salah"
}

export interface EssayKeyword {
  phrase: string;
  weight: number; // point contribution
  explanation?: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options?: QuestionOption[];
  correctAnswer?: string; // for SINGLE_CHOICE
  correctAnswers?: string[]; // for MCMA
  matrixRows?: MatrixRow[];
  matrixColumns?: string[]; // e.g. ["Benar", "Salah"]
  shortKeywords?: string[]; // for SHORT_ESSAY
  essayKeywords?: EssayKeyword[]; // for LONG_ESSAY (Mode B)
  sampleAnswer?: string;
  minWords?: number;
}

export interface ChapterSchedule {
  startDate?: string; // Format YYYY-MM-DD atau ISO (Rentang Hari Mulai)
  endDate?: string;   // Format YYYY-MM-DD atau ISO (Rentang Hari Berakhir)
  isEnabled?: boolean; // Apakah pembatasan rentang waktu aktif diaktifkan
}

export interface Chapter {
  id: string;
  courseId: string;
  title: string;
  description: string;
  order_index: number; // 1, 2, 3 ...
  type: ChapterType;
  passing_grade: number; // default 75
  
  // Struktur Hierarki Buku (BAB -> Sub-Bab -> Tugas)
  babTitle?: string;              // e.g. "BAB 1: MENGENAL TIPE DATA STRING DAN NUMBER"
  babNumber?: number;             // e.g. 1, 2, 3
  subChapterNumber?: string;      // e.g. "1.1", "1.2"
  itemCategory?: 'sub_chapter' | 'assignment'; // 'sub_chapter' (materi pembahasan) atau 'assignment' (tugas sub-bab)
  parentSubChapterId?: string;    // id sub-bab induk jika item ini merupakan tugas sub-bab

  // Video Chapter
  videoUrl?: string; // YouTube URL
  min_watch_percentage?: number; // e.g. 85%
  
  // Text Chapter
  textContent?: string;
  min_reading_seconds?: number; // e.g. 180s

  // Document / PDF Chapter
  fileUrl?: string; // URL PDF / Berkas materi

  // Link / Web Chapter
  externalUrl?: string; // URL Link referensi luar
  
  // Quiz & Assignment specific
  schedule?: ChapterSchedule; // Rentang hari pengerjaan
  durationMinutes?: number; // Batas durasi pengerjaan (menit)
  // Custom Star & XP Reward setting by Teacher
  activityRewardPoints?: number; // Poin XP Keaktifan khusus bab ini (opsional, default per tipe materi)
  assignmentPrompt?: string;
  instructions?: string;
  questions?: Question[];
}

export interface CourseStarSettings {
  xpPerStar: number;            // Berapa XP untuk dapat 1 Bintang (default 100)
  defaultVideoXp: number;       // default 25
  defaultPdfXp: number;         // default 20
  defaultTextXp: number;        // default 20
  defaultLinkXp: number;        // default 15
  defaultAssignmentXp: number;  // default 30
  defaultQuizXp: number;        // default 30
  onTimeBonusXp: number;        // default 15
}

export interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  gradeLevel: string;          // e.g. "Kelas X", "Kelas XI"
  thumbnailBg: string;
  teacherId: string;
  teacherName: string;
  chaptersCount: number;
  isPublished: boolean;
  targetClasses?: string[];    // kelas yang berhak akses course ini (e.g. ["X RPL 1", "X RPL 2"])
  starSettings?: CourseStarSettings; // Konfigurasi pemberian poin keaktifan & bintang oleh Guru
}

export type ChapterStatus =
  | 'locked'
  | 'unlocked'
  | 'in_progress'
  | 'waiting_grading'
  | 'passed'
  | 'failed';

export interface ChapterProgress {
  chapterId: string;
  order_index: number;
  is_completed: boolean;
  score?: number;
  watchPercentage?: number;
  readDwellSeconds?: number;
  status: ChapterStatus;
  lastAttemptAt?: string;
  startedAt?: string; // For countdown timer persistence
  xpClaimed?: boolean;
}

export interface UserCourseProgress {
  userId: string;
  courseId: string;
  current_chapter_index: number;
  chapters: Record<string, ChapterProgress>;
  totalStarsEarned: number;
  completedAt?: string;
}

export interface ModeBQuestionAnalysis {
  questionId: string;
  questionPrompt: string;
  studentText: string;
  matchedKeywords: string[];
  unmatchedKeywords: string[];
  suggestedScore: number;
  maxScore: number;
  teacherApprovedScore?: number;
}

export interface Submission {
  id: string;
  courseId: string;
  chapterId: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  answers: Record<string, any>;
  autoScore: number;
  finalScore: number;
  status: 'pending' | 'graded';
  modeBAnalysis?: ModeBQuestionAnalysis[];
  teacherFeedback?: string;
  gradedBy?: string;
  gradedAt?: string;
}

export type StarCategory =
  | 'ACADEMIC_EXCELLENCE'
  | 'FAST_RESPONDER'
  | 'ON_TIME'
  | 'PERSISTENCE'
  | 'DAILY_STREAK';

export interface StarAchievement {
  id: string;
  userId: string;
  category: StarCategory;
  title: string;
  description: string;
  stars: number;
  xpGained?: number;
  earnedAt: string;
  iconName: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userClass?: string;
  action: string;
  details: string;
  courseId?: string;
  chapterId?: string;
  xpGained?: number;
  timestamp: string;
}

// --- EVALUASI APRESIATIF GAYA P5 / KURIKULUM MERDEKA ---
export type P5ProgressLevel =
  | 'SANGAT_BERKEMBANG'      // 85 - 100 (SB)
  | 'BERKEMBANG_SESUAI'      // 75 - 84 (BSH)
  | 'MULAI_BERKEMBANG'       // 65 - 74 (MB)
  | 'SEDANG_BERPROSES';      // < 65 (SBp)

export interface P5LevelInfo {
  level: P5ProgressLevel;
  code: string;              // 'SB' | 'BSH' | 'MB' | 'SBp'
  label: string;             // 'Sangat Berkembang' | 'Berkembang Sesuai Harapan' | ...
  badgeVariant: 'green' | 'yellow' | 'blue' | 'purple';
  encouragement: string;
}

export function getP5ProgressInfo(score: number): P5LevelInfo {
  if (score >= 85) {
    return {
      level: 'SANGAT_BERKEMBANG',
      code: 'SB',
      label: 'Sangat Berkembang',
      badgeVariant: 'green',
      encouragement: 'Istimewa! Penguasaan materi sangat mendalam dan mandiri.',
    };
  } else if (score >= 75) {
    return {
      level: 'BERKEMBANG_SESUAI',
      code: 'BSH',
      label: 'Berkembang Sesuai Harapan',
      badgeVariant: 'blue',
      encouragement: 'Hebat! Telah menguasai capaian pembelajaran dengan sangat baik.',
    };
  } else if (score >= 65) {
    return {
      level: 'MULAI_BERKEMBANG',
      code: 'MB',
      label: 'Mulai Berkembang',
      badgeVariant: 'yellow',
      encouragement: 'Bagus! Pemahaman sudah terbentuk dengan baik, terus asah potensimu.',
    };
  } else {
    return {
      level: 'SEDANG_BERPROSES',
      code: 'SBp',
      label: 'Sedang Berproses',
      badgeVariant: 'purple',
      encouragement: 'Semangat Berproses! Usahamu sudah luar biasa, guru siap mendampingi langkah belajarmu selanjutnya.',
    };
  }
}

export interface BabAssessmentItem {
  chapterId: string;
  order_index: number;
  title: string;
  type: ChapterType;
  score: number;
  progressInfo: P5LevelInfo;
  isCompleted: boolean;
  completedAt?: string;
  feedback?: string;
}

export interface BabLearningReport {
  babNumber: number;
  babTitle: string;
  courseId: string;
  courseTitle: string;
  courseSubject: string;
  studentId: string;
  studentName: string;
  studentClass: string;
  nisn: string;
  teacherName: string;
  location?: string;
  completedAt: string;
  totalXpEarned: number;
  totalStarsEarned: number;
  assessments: BabAssessmentItem[];
  averageScore: number;
  overallProgress: P5LevelInfo;
  isBabFullyCompleted: boolean;
  teacherNotes?: string;
}
