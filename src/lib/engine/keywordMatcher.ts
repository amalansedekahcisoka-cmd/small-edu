import { EssayKeyword, ModeBQuestionAnalysis } from '@/types';

/**
 * Normalisasi teks untuk mempermudah pencocokan kata kunci
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Menganalisis jawaban essay siswa dengan kata kunci guru (Mode B)
 */
export function analyzeEssayWithKeywords(
  questionId: string,
  questionPrompt: string,
  studentText: string,
  keywords: EssayKeyword[],
  maxScore: number = 100
): ModeBQuestionAnalysis {
  const normalizedStudent = normalizeText(studentText);
  const matchedKeywords: string[] = [];
  const unmatchedKeywords: string[] = [];

  let totalWeight = 0;
  let earnedWeight = 0;

  for (const kw of keywords) {
    const normKeyword = normalizeText(kw.phrase);
    totalWeight += kw.weight;

    // Cek apakah frase kunci terkandung dalam teks jawaban siswa
    if (normalizedStudent.includes(normKeyword)) {
      matchedKeywords.push(kw.phrase);
      earnedWeight += kw.weight;
    } else {
      unmatchedKeywords.push(kw.phrase);
    }
  }

  // Hitung skor estimasi proporsional
  let suggestedScore = 0;
  if (totalWeight > 0) {
    suggestedScore = Math.round((earnedWeight / totalWeight) * maxScore);
  } else {
    // Jika guru tidak memberi bobot detail, cek ada teks yang wajar
    suggestedScore = studentText.trim().length >= 20 ? Math.round(maxScore * 0.75) : 0;
  }

  return {
    questionId,
    questionPrompt,
    studentText,
    matchedKeywords,
    unmatchedKeywords,
    suggestedScore,
    maxScore,
  };
}

/**
 * Memformat teks jawaban siswa dengan penanda HTML (highlight) untuk kata kunci yang cocok
 * Digunakan di Dashboard Meja Koreksi Guru
 */
export function getHighlightedHtml(studentText: string, matchedKeywords: string[]): string {
  if (!studentText) return '';
  let html = studentText;

  for (const kw of matchedKeywords) {
    // Escape regex characters
    const escaped = kw.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    html = html.replace(
      regex,
      '<span class="bg-emerald-200 text-emerald-950 font-bold px-1.5 py-0.5 rounded border border-emerald-500">$1</span>'
    );
  }

  return html;
}
