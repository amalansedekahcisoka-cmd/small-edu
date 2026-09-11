import * as XLSX from 'xlsx';
import { BabLearningReport } from '@/types';

/**
 * Generates and triggers download of an Excel (.xlsx) file containing
 * the class learning recap for a specific Chapter (BAB).
 */
export function exportBabReportToExcel(
  reports: BabLearningReport[],
  courseTitle: string,
  babTitle: string,
  teacherName: string,
  targetClass: string = 'Semua Kelas'
) {
  const wb = XLSX.utils.book_new();

  // 1. Build Header Block
  const aoaData: (string | number)[][] = [
    ['REKAPITULASI CAPAIAN BELAJAR SISWA PER LINGKUP MATERI (BAB)'],
    ['DINAS PENDIDIKAN DAN KEBUDAYAAN'],
    [''],
    ['Mata Pelajaran', `: ${courseTitle}`],
    ['Lingkup Materi / BAB', `: ${babTitle}`],
    ['Kelas / Rombel', `: ${targetClass}`],
    ['Guru Pengampu', `: ${teacherName}`],
    ['Tanggal Unduh', `: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`],
    [''],
  ];

  // 2. Discover dynamically all unique assessment titles across reports to form sub-columns
  const assessmentTitleSet = new Set<string>();
  reports.forEach(r => {
    r.assessments.forEach(a => assessmentTitleSet.add(a.title));
  });
  const assessmentTitles = Array.from(assessmentTitleSet);

  // Table header row
  const tableHeaders: string[] = [
    'No',
    'NISN / ID',
    'Nama Lengkap Siswa',
    'Kelas',
    'XP BAB',
    'Bintang BAB',
    ...assessmentTitles,
    'Rata-rata Nilai BAB (Skor Rapor)',
    'Status Progres (P5 Kurikulum Merdeka)',
    'Deskripsi / Catatan Apresiasi Guru'
  ];

  aoaData.push(tableHeaders);

  // 3. Build Student Data Rows
  reports.forEach((report, index) => {
    const row: (string | number)[] = [
      index + 1,
      report.studentId,
      report.studentName,
      report.studentClass,
      report.totalXpEarned,
      report.totalStarsEarned,
    ];

    // Fill each assessment score
    assessmentTitles.forEach(title => {
      const match = report.assessments.find(a => a.title === title);
      row.push(match && match.score !== undefined ? match.score : '-');
    });

    row.push(
      report.averageScore,
      `${report.overallProgress.code} (${report.overallProgress.label})`,
      report.teacherNotes || report.overallProgress.encouragement
    );

    aoaData.push(row);
  });

  // 4. Summary / Statistics Rows
  if (reports.length > 0) {
    aoaData.push(['']);
    const scores = reports.map(r => r.averageScore);
    const avgClass = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);

    aoaData.push(['Ringkasan Capaian Kelas:']);
    aoaData.push(['Rata-rata Kelas', avgClass]);
    aoaData.push(['Nilai Rata-rata Tertinggi', highest]);
    aoaData.push(['Nilai Rata-rata Terendah', lowest]);
    aoaData.push(['Jumlah Peserta Didik', reports.length]);
  }

  // 5. Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(aoaData);

  // Set column widths
  ws['!cols'] = [
    { wch: 5 },  // No
    { wch: 14 }, // ID
    { wch: 28 }, // Nama
    { wch: 12 }, // Kelas
    { wch: 10 }, // XP
    { wch: 12 }, // Bintang
    ...assessmentTitles.map(() => ({ wch: 16 })),
    { wch: 22 }, // Rata-rata BAB
    { wch: 28 }, // P5 Status
    { wch: 55 }, // Catatan Apresiasi
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Rekap BAB');

  // 6. Generate filename and trigger download
  const cleanTitle = babTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);
  const cleanClass = targetClass.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Rekap_BAB_${cleanTitle}_${cleanClass}.xlsx`;

  XLSX.writeFile(wb, filename);
}
