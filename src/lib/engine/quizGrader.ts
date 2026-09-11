import { Question, ModeBQuestionAnalysis } from '@/types';
import { analyzeEssayWithKeywords, normalizeText } from './keywordMatcher';

export interface GradingResult {
  totalPossiblePoints: number;
  autoEarnedPoints: number;
  finalPercentage: number;
  hasLongEssayPending: boolean; // Jika true, nilai final menunggu guru
  modeBAnalyses: ModeBQuestionAnalysis[];
  questionResults: Record<
    string,
    {
      isCorrect?: boolean;
      pointsEarned: number;
      maxPoints: number;
      feedback?: string;
    }
  >;
}

export function gradeQuizSubmission(
  questions: Question[],
  answers: Record<string, any>
): GradingResult {
  let totalPossiblePoints = 0;
  let autoEarnedPoints = 0;
  let hasLongEssayPending = false;
  const modeBAnalyses: ModeBQuestionAnalysis[] = [];
  const questionResults: Record<string, any> = {};

  for (const q of questions) {
    totalPossiblePoints += q.points;
    const ans = answers[q.id];

    switch (q.type) {
      case 'SINGLE_CHOICE': {
        const isCorrect = ans !== undefined && ans === q.correctAnswer;
        const pts = isCorrect ? q.points : 0;
        autoEarnedPoints += pts;
        questionResults[q.id] = {
          isCorrect,
          pointsEarned: pts,
          maxPoints: q.points,
        };
        break;
      }

      case 'MCMA': {
        // Multiple Choice Multiple Answers
        const correctSet = new Set(q.correctAnswers || []);
        const selectedArr: string[] = Array.isArray(ans) ? ans : [];
        const selectedSet = new Set(selectedArr);

        if (correctSet.size === 0) {
          questionResults[q.id] = { pointsEarned: 0, maxPoints: q.points };
          break;
        }

        // Hitung proporsional (benar dapat poin, salah mengurangi)
        let correctCount = 0;
        let incorrectCount = 0;

        for (const item of selectedArr) {
          if (correctSet.has(item)) correctCount++;
          else incorrectCount++;
        }

        const ratio = Math.max(0, (correctCount - incorrectCount) / correctSet.size);
        const pts = Math.round(ratio * q.points);
        autoEarnedPoints += pts;

        questionResults[q.id] = {
          isCorrect: ratio === 1,
          pointsEarned: pts,
          maxPoints: q.points,
        };
        break;
      }

      case 'CATEGORY_MATRIX': {
        // Tabel Pernyataan (Benar / Salah)
        const rows = q.matrixRows || [];
        const studentAns: Record<string, string> = typeof ans === 'object' && ans !== null ? ans : {};
        let rowCorrect = 0;

        for (const row of rows) {
          if (studentAns[row.id] === row.correctCategory) {
            rowCorrect++;
          }
        }

        const pts = rows.length > 0 ? Math.round((rowCorrect / rows.length) * q.points) : 0;
        autoEarnedPoints += pts;

        questionResults[q.id] = {
          isCorrect: rowCorrect === rows.length,
          pointsEarned: pts,
          maxPoints: q.points,
          feedback: `${rowCorrect} dari ${rows.length} pernyataan dijawab dengan tepat.`,
        };
        break;
      }

      case 'SHORT_ESSAY': {
        const studentText = typeof ans === 'string' ? ans : '';
        const normStudent = normalizeText(studentText);
        const keywords = (q.shortKeywords || []).map(normalizeText);

        // Cek apakah mengandung salah satu frasa kunci
        const isMatch = keywords.some((kw) => normStudent.includes(kw));
        const pts = isMatch ? q.points : 0;
        autoEarnedPoints += pts;

        questionResults[q.id] = {
          isCorrect: isMatch,
          pointsEarned: pts,
          maxPoints: q.points,
        };
        break;
      }

      case 'LONG_ESSAY': {
        hasLongEssayPending = true;
        const studentText = typeof ans === 'string' ? ans : '';
        const analysis = analyzeEssayWithKeywords(
          q.id,
          q.prompt,
          studentText,
          q.essayKeywords || [],
          q.points
        );
        modeBAnalyses.push(analysis);

        // Nilai awal diambil dari saran kata kunci otomatis
        questionResults[q.id] = {
          isCorrect: undefined,
          pointsEarned: analysis.suggestedScore,
          maxPoints: q.points,
          feedback: 'Menunggu pengesahan nilai oleh Guru.',
        };
        autoEarnedPoints += analysis.suggestedScore;
        break;
      }
    }
  }

  const finalPercentage =
    totalPossiblePoints > 0 ? Math.round((autoEarnedPoints / totalPossiblePoints) * 100) : 0;

  return {
    totalPossiblePoints,
    autoEarnedPoints,
    finalPercentage,
    hasLongEssayPending,
    modeBAnalyses,
    questionResults,
  };
}
