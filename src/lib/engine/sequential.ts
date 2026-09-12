import { Chapter, ChapterProgress, UserCourseProgress } from '@/types';

export interface SequentialCheckResult {
  canAccess: boolean;
  reason?: string;
  previousChapter?: Chapter;
  previousProgress?: ChapterProgress;
  lockType?: 'sequential' | 'not_started' | 'overdue' | 'cascade_overdue';
  overdueChapter?: Chapter;
}

/**
 * Helper untuk memformat tanggal Indonesia yang ramah (contoh: 23 September 2026)
 */
export function formatScheduleDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Mengecek apakah suatu bab memiliki jadwal dan apakah saat ini berada sebelum startDate atau lewat endDate.
 */
export function getChapterScheduleStatus(chapter: Chapter): {
  hasSchedule: boolean;
  notStartedYet: boolean;
  isOverdue: boolean;
  startDateFormatted: string;
  endDateFormatted: string;
} {
  const sched = chapter.schedule;
  if (!sched || sched.isEnabled === false || (!sched.startDate && !sched.endDate)) {
    return {
      hasSchedule: false,
      notStartedYet: false,
      isOverdue: false,
      startDateFormatted: '',
      endDateFormatted: '',
    };
  }

  const now = new Date();
  let notStartedYet = false;
  let isOverdue = false;

  if (sched.startDate) {
    const start = new Date(sched.startDate);
    // Set jam mulai ke awal hari lokal (00:00:00)
    start.setHours(0, 0, 0, 0);
    if (now < start) {
      notStartedYet = true;
    }
  }

  if (sched.endDate) {
    const end = new Date(sched.endDate);
    // Set batas akhir ke penghujung hari (23:59:59.999)
    end.setHours(23, 59, 59, 999);
    if (now > end) {
      isOverdue = true;
    }
  }

  return {
    hasSchedule: true,
    notStartedYet,
    isOverdue,
    startDateFormatted: formatScheduleDate(sched.startDate),
    endDateFormatted: formatScheduleDate(sched.endDate),
  };
}

/**
 * Validasi akses bab berurutan (Sequential Access Check) & Rentang Waktu Aktif (Schedule Window)
 * Aturan:
 * 1. CEK KEDALUWARSA KASSET (Cascade Overdue):
 *    Jika ada bab prasyarat sebelumnya (order_index < targetChapter.order_index) yang:
 *    - Melewati batas waktu akhir (endDate)
 *    - Siswa BELUM menyelesaikannya (is_completed !== true)
 *    Maka targetChapter OTOMATIS TERKUNCI karena siswa tidak aktif menyelesaikan bab sebelumnya sesuai tenggat!
 * 
 * 2. CEK JADWAL BAB TARGET SENDIRI:
 *    - Jika belum mencapai startDate: Terkunci (not_started)
 *    - Jika sudah lewat endDate DAN siswa belum selesai: Terkunci (overdue)
 * 
 * 3. CEK KETUNTASAN SEKUENSIAL:
 *    - Bab 1 terbuka jika jadwalnya aktif.
 *    - Bab N terbuka jika Bab N-1 is_completed dan score >= passing_grade.
 */
export function checkSequentialAccess(
  targetChapter: Chapter,
  allChaptersSorted: Chapter[],
  userProgress: UserCourseProgress | null
): SequentialCheckResult {
  // Urutkan bab berdasarkan order_index
  const sorted = [...allChaptersSorted].sort((a, b) => a.order_index - b.order_index);

  // 1. CEK KASSET KEDALUWARSA PADA BAB-BAB SEBELUMNYA
  // Jika ada bab sebelum target ini yang sudah deadline dan siswa tidak aktif menyelesaikannya,
  // maka seluruh materi di bawahnya terkunci otomatis!
  for (const ch of sorted) {
    if (ch.order_index < targetChapter.order_index) {
      const prog = userProgress?.chapters?.[ch.id];
      const isDone = !!prog?.is_completed;
      if (!isDone) {
        const sched = getChapterScheduleStatus(ch);
        if (sched.hasSchedule && sched.isOverdue) {
          return {
            canAccess: false,
            reason: `Materi sebelumnya (${ch.title}) telah melewati batas waktu (${sched.endDateFormatted}) tanpa kamu selesaikan. Sesuai aturan kedisiplinan belajar, materi ini terkunci otomatis. Hubungi guru pembimbing Anda.`,
            lockType: 'cascade_overdue',
            overdueChapter: ch,
          };
        }
      }
    }
  }

  // 2. CEK JADWAL RENTANG WAKTU PADA TARGET CHAPTER SENDIRI
  const targetSched = getChapterScheduleStatus(targetChapter);
  const targetProg = userProgress?.chapters?.[targetChapter.id];
  const isTargetCompleted = !!targetProg?.is_completed;

  if (targetSched.hasSchedule) {
    if (targetSched.notStartedYet) {
      return {
        canAccess: false,
        reason: `Materi ini baru akan dibuka pada tanggal ${targetSched.startDateFormatted}. Silakan kembali lagi saat materi telah aktif.`,
        lockType: 'not_started',
      };
    }

    if (targetSched.isOverdue && !isTargetCompleted) {
      return {
        canAccess: false,
        reason: `Batas waktu aktif materi ini telah berakhir pada ${targetSched.endDateFormatted}. Kamu belum menyelesaikannya sehingga materi ini terkunci otomatis.`,
        lockType: 'overdue',
        overdueChapter: targetChapter,
      };
    }
  }

  // 3. ATURAN SEKUENSIAL STANDAR (Bab 1 vs Bab N)
  if (targetChapter.order_index === 1) {
    return { canAccess: true };
  }

  // Cari Bab N-1
  const previousIndex = targetChapter.order_index - 1;
  const previousChapter = sorted.find((ch) => ch.order_index === previousIndex);

  if (!previousChapter) {
    return { canAccess: true };
  }

  const prevProg = userProgress?.chapters?.[previousChapter.id];

  if (!prevProg) {
    return {
      canAccess: false,
      reason: `Bab ${previousChapter.order_index} (${previousChapter.title}) belum diselesaikan.`,
      previousChapter,
      lockType: 'sequential',
    };
  }

  // Cek apakah bab sebelumnya masih menunggu penilaian guru
  if (prevProg.status === 'waiting_grading') {
    return {
      canAccess: false,
      reason: `Bab ${previousChapter.order_index} sedang menunggu koreksi & verifikasi nilai dari Guru.`,
      previousChapter,
      previousProgress: prevProg,
      lockType: 'sequential',
    };
  }

  // Cek status penyelesaian (siswa sudah membaca/mengerjakan materi bab sebelumnya)
  const isPreviousFinished = prevProg.is_completed || prevProg.status === 'passed' || prevProg.status === 'failed';
  if (!isPreviousFinished) {
    return {
      canAccess: false,
      reason: `Kamu harus menyelesaikan Bab ${previousChapter.order_index} (${previousChapter.title}) terlebih dahulu.`,
      previousChapter,
      previousProgress: prevProg,
      lockType: 'sequential',
    };
  }

  // Catatan: Sesuai kebijakan pedagogis, berapa pun nilai yang diperoleh siswa (meskipun belum mencapai KKM),
  // siswa tetap diizinkan untuk melangkah ke bab materi ajar berikutnya agar alur belajar tidak terkunci permanen.
  return {
    canAccess: true,
    previousChapter,
    previousProgress: prevProg,
  };
}
