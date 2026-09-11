'use client';

import React, { useState } from 'react';
import { Question, QuestionType, QuestionOption, MatrixRow, EssayKeyword } from '@/types';

interface QuestionBuilderModalProps {
  initialQuestions: Question[];
  chapterTitle: string;
  onSave: (questions: Question[]) => void;
  onClose: () => void;
}

/* ────────────────────────────────────────────────────────
   Micro Win95 primitive components
──────────────────────────────────────────────────────── */

const W95_BG      = '#c0c0c0';
const W95_SHADOW  = '#808080';
const W95_DARK    = '#404040';
const W95_WHITE   = '#ffffff';
const W95_TITLE   = '#000080';

/** Raised ("button") border */
const raisedStyle: React.CSSProperties = {
  border: `2px solid`,
  borderColor: `${W95_WHITE} ${W95_DARK} ${W95_DARK} ${W95_WHITE}`,
  background: W95_BG,
};

/** Sunken ("field") border */
const sunkenStyle: React.CSSProperties = {
  border: `2px solid`,
  borderColor: `${W95_DARK} ${W95_WHITE} ${W95_WHITE} ${W95_DARK}`,
  background: W95_WHITE,
};

const groupBoxStyle: React.CSSProperties = {
  border: `2px solid`,
  borderColor: `${W95_SHADOW} ${W95_WHITE} ${W95_WHITE} ${W95_SHADOW}`,
  background: W95_BG,
  padding: '8px 10px 10px',
  position: 'relative',
};

function W95Button({
  children, onClick, style, disabled, danger, primary,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const base: React.CSSProperties = pressed
    ? { border: '2px solid', borderColor: `${W95_DARK} ${W95_WHITE} ${W95_WHITE} ${W95_DARK}`, background: W95_BG }
    : { ...raisedStyle };
  return (
    <button
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...base,
        fontFamily: '"MS Sans Serif", "Arial", sans-serif',
        fontSize: 13,
        fontWeight: 'bold',
        padding: pressed ? '5px 13px 3px 15px' : '4px 14px',
        cursor: disabled ? 'default' : 'pointer',
        color: danger ? '#8b0000' : primary ? '#000080' : '#000',
        outline: primary ? `1px dotted #000080` : 'none',
        outlineOffset: -3,
        minWidth: 80,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function W95Input({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties;
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...sunkenStyle,
        fontFamily: '"MS Sans Serif", "Arial", sans-serif',
        fontSize: 13,
        padding: '4px 8px',
        width: '100%',
        boxSizing: 'border-box',
        outline: 'none',
        ...style,
      }}
    />
  );
}

function W95Textarea({ value, onChange, placeholder, rows }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows || 3}
      style={{
        ...sunkenStyle,
        fontFamily: '"MS Sans Serif", "Arial", sans-serif',
        fontSize: 13,
        padding: '5px 8px',
        width: '100%',
        boxSizing: 'border-box',
        resize: 'vertical',
        outline: 'none',
      }}
    />
  );
}

function W95Select({ value, onChange, options, style }: {
  value: string; onChange: (v: string) => void; options: string[]; style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        ...sunkenStyle,
        fontFamily: '"MS Sans Serif", "Arial", sans-serif',
        fontSize: 13,
        padding: '4px 6px',
        outline: 'none',
        cursor: 'pointer',
        ...style,
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function W95NumberInput({ value, onChange, min, max, style }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; style?: React.CSSProperties;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={e => onChange(parseInt(e.target.value) || 0)}
      style={{
        ...sunkenStyle,
        fontFamily: '"MS Sans Serif", "Arial", sans-serif',
        fontSize: 13,
        padding: '4px 6px',
        width: 68,
        textAlign: 'center',
        outline: 'none',
        ...style,
      }}
    />
  );
}

function GroupBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ ...groupBoxStyle, marginTop: 14, padding: '12px 12px 12px' }}>
      <span style={{
        position: 'absolute',
        top: -9,
        left: 10,
        background: W95_BG,
        padding: '0 6px',
        fontFamily: '"MS Sans Serif", "Arial", sans-serif',
        fontSize: 12,
        fontWeight: 'bold',
      }}>
        {title}
      </span>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────
   Main Component
──────────────────────────────────────────────────────── */

export const QuestionBuilderModal: React.FC<QuestionBuilderModalProps> = ({
  initialQuestions,
  chapterTitle,
  onSave,
  onClose,
}) => {
  const [questions, setQuestions] = useState<Question[]>(() =>
    initialQuestions && initialQuestions.length > 0 ? JSON.parse(JSON.stringify(initialQuestions)) : []
  );

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(
    questions.length > 0 ? questions[0].id : null
  );

  const activeQuestion = questions.find(q => q.id === activeQuestionId) || null;
  const totalPoints = questions.reduce((sum, q) => sum + (q.points || 0), 0);

  const handleAddQuestion = (type: QuestionType) => {
    const newId = 'q_' + Date.now();
    let newQ: Question = { id: newId, type, prompt: '', points: 10 };
    if (type === 'SINGLE_CHOICE') {
      newQ.options = [
        { id: 'opt_1', text: 'Pilihan A' }, { id: 'opt_2', text: 'Pilihan B' },
        { id: 'opt_3', text: 'Pilihan C' }, { id: 'opt_4', text: 'Pilihan D' },
      ];
      newQ.correctAnswer = 'opt_1';
    } else if (type === 'MCMA') {
      newQ.options = [
        { id: 'opt_1', text: 'Pernyataan 1' }, { id: 'opt_2', text: 'Pernyataan 2' },
        { id: 'opt_3', text: 'Pernyataan 3' }, { id: 'opt_4', text: 'Pernyataan 4' },
      ];
      newQ.correctAnswers = ['opt_1', 'opt_2'];
    } else if (type === 'CATEGORY_MATRIX') {
      newQ.matrixColumns = ['Benar', 'Salah'];
      newQ.matrixRows = [
        { id: 'row_1', statement: 'Pernyataan ke-1...', correctCategory: 'Benar' },
        { id: 'row_2', statement: 'Pernyataan ke-2...', correctCategory: 'Salah' },
      ];
    } else if (type === 'SHORT_ESSAY') {
      newQ.shortKeywords = ['jawaban_kunci'];
      newQ.sampleAnswer = '';
    } else if (type === 'LONG_ESSAY') {
      newQ.minWords = 20;
      newQ.sampleAnswer = '';
      newQ.essayKeywords = [{ phrase: 'kata kunci utama', weight: 5, explanation: 'Menyebutkan konsep pokok' }];
    }
    const updated = [...questions, newQ];
    setQuestions(updated);
    setActiveQuestionId(newId);
  };

  const handleUpdateActiveQuestion = (patch: Partial<Question>) => {
    if (!activeQuestionId) return;
    setQuestions(prev => prev.map(q => q.id === activeQuestionId ? { ...q, ...patch } : q));
  };

  const handleDeleteQuestion = (id: string) => {
    const updated = questions.filter(q => q.id !== id);
    setQuestions(updated);
    if (activeQuestionId === id) {
      setActiveQuestionId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const getTypeShort = (type: QuestionType) => {
    switch (type) {
      case 'SINGLE_CHOICE': return 'PG Tunggal';
      case 'MCMA': return 'PG Kompleks';
      case 'CATEGORY_MATRIX': return 'Menjodohkan';
      case 'SHORT_ESSAY': return 'Isian Singkat';
      case 'LONG_ESSAY': return 'Uraian Panjang';
      default: return type;
    }
  };

  const getTypeIcon = (type: QuestionType) => {
    switch (type) {
      case 'SINGLE_CHOICE': return '🔘';
      case 'MCMA': return '☑';
      case 'CATEGORY_MATRIX': return '⊞';
      case 'SHORT_ESSAY': return '✏';
      case 'LONG_ESSAY': return '📄';
      default: return '?';
    }
  };

  const font: React.CSSProperties = {
    fontFamily: '"MS Sans Serif", "Arial", sans-serif',
    fontSize: 13,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      {/* Window */}
      <div style={{
        ...raisedStyle,
        width: '95vw', maxWidth: 1180,
        height: '88vh', minHeight: 620,
        display: 'flex', flexDirection: 'column',
        background: W95_BG,
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
      }}>
        {/* ── Title Bar ── */}
        <div style={{
          background: `linear-gradient(to right, ${W95_TITLE}, #1084d0)`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '5px 8px',
          userSelect: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>📝</span>
            <span style={{ ...font, color: '#fff', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.2 }}>
              Penyusun Butir Soal &amp; Ujian — {chapterTitle}
            </span>
          </div>
          <button
            onClick={onClose}
            title="Tutup Jendela"
            style={{
              ...raisedStyle,
              width: 22, height: 20,
              padding: 0, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 'bold', color: '#000',
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Menu Bar ── */}
        <div style={{
          ...font,
          background: W95_BG,
          borderBottom: `1px solid ${W95_SHADOW}`,
          padding: '4px 10px',
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <span style={{ cursor: 'default' }}>📁 <u>B</u>erkas</span>
          <span style={{ cursor: 'default' }}>✏️ <u>S</u>oal</span>
          <span style={{ cursor: 'default' }}>❓ <u>B</u>antuan</span>
          <span style={{ marginLeft: 'auto', color: '#333' }}>
            Total Bobot: <strong style={{ color: '#000080', fontSize: 14 }}>{totalPoints} Poin</strong>
            &nbsp;|&nbsp; Soal: <strong>{questions.length}</strong>
          </span>
        </div>

        {/* ── Toolbar ── */}
        <div style={{
          ...font,
          background: W95_BG,
          borderBottom: `2px solid ${W95_SHADOW}`,
          borderTop: `1px solid ${W95_WHITE}`,
          padding: '6px 10px',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <W95Button primary onClick={() => onSave(questions)} style={{ fontSize: 13, padding: '4px 14px' }}>
            💾 Simpan Soal
          </W95Button>
          <div style={{ width: 1, height: 24, background: W95_SHADOW, margin: '0 4px' }} />
          <span style={{ color: '#404040', fontSize: 12, fontWeight: 'bold', marginRight: 4 }}>Tambah Butir Soal:</span>
          {([
            ['SINGLE_CHOICE', '🔘 PG Tunggal'],
            ['MCMA', '☑ PG Kompleks'],
            ['CATEGORY_MATRIX', '⊞ Menjodohkan'],
            ['SHORT_ESSAY', '✏ Isian Singkat'],
            ['LONG_ESSAY', '📄 Uraian Panjang'],
          ] as [QuestionType, string][]).map(([t, label]) => (
            <W95Button key={t} onClick={() => handleAddQuestion(t)} style={{ fontSize: 12, minWidth: 'auto', padding: '3px 10px' }}>
              {label}
            </W95Button>
          ))}
        </div>

        {/* ── Main Body ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Left Panel — Question List */}
          <div style={{
            width: 260, minWidth: 260,
            borderRight: `2px solid ${W95_SHADOW}`,
            display: 'flex', flexDirection: 'column',
            background: W95_BG,
          }}>
            {/* List header */}
            <div style={{
              ...font,
              background: W95_TITLE,
              color: '#fff',
              padding: '5px 8px',
              fontWeight: 'bold',
              fontSize: 13,
            }}>
              Daftar Butir Soal ({questions.length})
            </div>

            {/* Question items (listbox style) */}
            <div style={{
              ...sunkenStyle,
              flex: 1, overflowY: 'auto', margin: 8,
              padding: 0,
            }}>
              {questions.length === 0 ? (
                <div style={{ ...font, color: W95_SHADOW, padding: 16, textAlign: 'center', fontSize: 12 }}>
                  (Belum ada butir soal)
                </div>
              ) : (
                questions.map((q, idx) => {
                  const isActive = q.id === activeQuestionId;
                  return (
                    <div
                      key={q.id}
                      onClick={() => setActiveQuestionId(q.id)}
                      style={{
                        ...font,
                        padding: '6px 8px',
                        cursor: 'pointer',
                        background: isActive ? W95_TITLE : 'transparent',
                        color: isActive ? '#fff' : '#000',
                        borderBottom: `1px solid ${isActive ? W95_TITLE : '#e0e0e0'}`,
                        userSelect: 'none',
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{getTypeIcon(q.type)}</span>
                        <span>Soal #{idx + 1}</span>
                      </div>
                      <div style={{ fontSize: 12, color: isActive ? '#c8d8ff' : '#555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                        {q.prompt || '(soal masih kosong)'}
                      </div>
                      <div style={{ fontSize: 11, color: isActive ? '#a0c0ff' : '#777', marginTop: 2 }}>
                        {getTypeShort(q.type)} · {q.points || 0} poin
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: '0 8px 8px', ...font }}>
              <div style={{ ...sunkenStyle, padding: '4px 6px', color: '#404040', fontSize: 12, textAlign: 'center' }}>
                {questions.length} butir soal terdaftar
              </div>
            </div>
          </div>

          {/* Right Panel — Editor */}
          <div style={{
            flex: 1, overflowY: 'auto',
            background: W95_BG,
            padding: 14,
          }}>
            {activeQuestion ? (
              <div style={{ ...font }}>

                {/* Top info bar */}
                <div style={{
                  ...raisedStyle,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 12px', marginBottom: 12, gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{getTypeIcon(activeQuestion.type)}</span>
                    <strong style={{ fontSize: 14, color: W95_TITLE }}>{getTypeShort(activeQuestion.type)}</strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 13, fontWeight: 'bold' }}>Bobot Poin:</label>
                    <W95NumberInput
                      value={activeQuestion.points || 10}
                      onChange={v => handleUpdateActiveQuestion({ points: v })}
                      min={1} max={100}
                    />
                    <W95Button danger onClick={() => handleDeleteQuestion(activeQuestion.id)} style={{ fontSize: 12 }}>
                      🗑 Hapus Soal
                    </W95Button>
                  </div>
                </div>

                {/* Prompt */}
                <GroupBox title="Pertanyaan / Stimulus / Instruksi Soal">
                  <W95Textarea
                    rows={4}
                    value={activeQuestion.prompt}
                    onChange={v => handleUpdateActiveQuestion({ prompt: v })}
                    placeholder="Tuliskan teks pertanyaan atau stimulus soal di sini..."
                  />
                </GroupBox>

                {/* ── SINGLE CHOICE ── */}
                {activeQuestion.type === 'SINGLE_CHOICE' && (
                  <GroupBox title="Opsi Jawaban — Pilih satu jawaban benar (○)">
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                      <W95Button onClick={() => {
                        const opts = activeQuestion.options || [];
                        const newOpt: QuestionOption = { id: `opt_${Date.now()}`, text: `Pilihan ${String.fromCharCode(65 + opts.length)}` };
                        handleUpdateActiveQuestion({ options: [...opts, newOpt] });
                      }}>
                        + Opsi Baru
                      </W95Button>
                    </div>
                    <div style={{ ...sunkenStyle, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(activeQuestion.options || []).map((opt, oIdx) => {
                        const isCorrect = activeQuestion.correctAnswer === opt.id;
                        return (
                          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="radio"
                              name={`sc_${activeQuestion.id}`}
                              checked={isCorrect}
                              onChange={() => handleUpdateActiveQuestion({ correctAnswer: opt.id })}
                              style={{ accentColor: '#000080', cursor: 'pointer', width: 16, height: 16 }}
                            />
                            <span style={{ fontWeight: 'bold', fontSize: 13, minWidth: 20, color: '#000080' }}>
                              {String.fromCharCode(65 + oIdx)}.
                            </span>
                            <input type="text"
                              value={opt.text}
                              onChange={e => {
                                const newOpts = (activeQuestion.options || []).map(o => o.id === opt.id ? { ...o, text: e.target.value } : o);
                                handleUpdateActiveQuestion({ options: newOpts });
                              }}
                              style={{
                                ...sunkenStyle,
                                flex: 1, fontSize: 13, padding: '4px 8px',
                                outline: 'none',
                                background: isCorrect ? '#e8f4e8' : W95_WHITE,
                                fontWeight: isCorrect ? 'bold' : 'normal',
                              }}
                            />
                            {isCorrect && <span style={{ fontSize: 11, color: 'green', fontWeight: 'bold', whiteSpace: 'nowrap' }}>✓ BENAR</span>}
                            {(activeQuestion.options || []).length > 2 && (
                              <W95Button danger onClick={() => {
                                const newOpts = (activeQuestion.options || []).filter(o => o.id !== opt.id);
                                const patch: Partial<Question> = { options: newOpts };
                                if (activeQuestion.correctAnswer === opt.id && newOpts.length > 0) patch.correctAnswer = newOpts[0].id;
                                handleUpdateActiveQuestion(patch);
                              }} style={{ minWidth: 26, padding: '2px 8px', fontSize: 12 }}>✕</W95Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </GroupBox>
                )}

                {/* ── MCMA ── */}
                {activeQuestion.type === 'MCMA' && (
                  <GroupBox title="Opsi Pilihan Ganda Kompleks — Centang semua jawaban benar (☑)">
                    <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                      <W95Button onClick={() => {
                        const opts = activeQuestion.options || [];
                        const newOpt: QuestionOption = { id: `opt_${Date.now()}`, text: `Pernyataan ${opts.length + 1}` };
                        handleUpdateActiveQuestion({ options: [...opts, newOpt] });
                      }}>+ Opsi Baru</W95Button>
                    </div>
                    <div style={{ ...sunkenStyle, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(activeQuestion.options || []).map(opt => {
                        const correctAnswers = activeQuestion.correctAnswers || [];
                        const isChecked = correctAnswers.includes(opt.id);
                        return (
                          <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const newAnswers = e.target.checked
                                  ? [...correctAnswers, opt.id]
                                  : correctAnswers.filter(id => id !== opt.id);
                                handleUpdateActiveQuestion({ correctAnswers: newAnswers });
                              }}
                              style={{ accentColor: '#000080', cursor: 'pointer', width: 16, height: 16 }}
                            />
                            <input type="text"
                              value={opt.text}
                              onChange={e => {
                                const newOpts = (activeQuestion.options || []).map(o => o.id === opt.id ? { ...o, text: e.target.value } : o);
                                handleUpdateActiveQuestion({ options: newOpts });
                              }}
                              style={{
                                ...sunkenStyle, flex: 1, fontSize: 13, padding: '4px 8px', outline: 'none',
                                background: isChecked ? '#e8ffe8' : W95_WHITE,
                                fontWeight: isChecked ? 'bold' : 'normal',
                              }}
                            />
                            {isChecked && <span style={{ fontSize: 11, color: 'green', fontWeight: 'bold' }}>✓</span>}
                            {(activeQuestion.options || []).length > 2 && (
                              <W95Button danger onClick={() => {
                                const newOpts = (activeQuestion.options || []).filter(o => o.id !== opt.id);
                                const newAnswers = (activeQuestion.correctAnswers || []).filter(id => id !== opt.id);
                                handleUpdateActiveQuestion({ options: newOpts, correctAnswers: newAnswers });
                              }} style={{ minWidth: 26, padding: '2px 8px', fontSize: 12 }}>✕</W95Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </GroupBox>
                )}

                {/* ── CATEGORY MATRIX ── */}
                {activeQuestion.type === 'CATEGORY_MATRIX' && (
                  <GroupBox title="Menjodohkan / Matriks Kategori">
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>
                        Kolom Kategori (pisah koma):
                      </label>
                      <W95Input
                        value={(activeQuestion.matrixColumns || ['Benar', 'Salah']).join(', ')}
                        onChange={v => {
                          const cols = v.split(',').map(s => s.trim()).filter(Boolean);
                          handleUpdateActiveQuestion({ matrixColumns: cols });
                        }}
                        placeholder="Benar, Salah  atau  Fakta, Opini"
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontWeight: 'bold', fontSize: 13 }}>Baris Pernyataan &amp; Kunci Kategori:</span>
                      <W95Button onClick={() => {
                        const rows = activeQuestion.matrixRows || [];
                        const cols = activeQuestion.matrixColumns || ['Benar', 'Salah'];
                        const newRow: MatrixRow = { id: `row_${Date.now()}`, statement: 'Pernyataan baru...', correctCategory: cols[0] || 'Benar' };
                        handleUpdateActiveQuestion({ matrixRows: [...rows, newRow] });
                      }}>+ Tambah Baris</W95Button>
                    </div>
                    <div style={{ ...sunkenStyle, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(activeQuestion.matrixRows || []).map(row => (
                        <div key={row.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="text" value={row.statement}
                            onChange={e => {
                              const newRows = (activeQuestion.matrixRows || []).map(r => r.id === row.id ? { ...r, statement: e.target.value } : r);
                              handleUpdateActiveQuestion({ matrixRows: newRows });
                            }}
                            style={{ ...sunkenStyle, flex: 1, fontSize: 13, padding: '4px 8px', outline: 'none' }}
                          />
                          <W95Select
                            value={row.correctCategory}
                            onChange={v => {
                              const newRows = (activeQuestion.matrixRows || []).map(r => r.id === row.id ? { ...r, correctCategory: v } : r);
                              handleUpdateActiveQuestion({ matrixRows: newRows });
                            }}
                            options={activeQuestion.matrixColumns || ['Benar', 'Salah']}
                          />
                          {(activeQuestion.matrixRows || []).length > 1 && (
                            <W95Button danger onClick={() => {
                              const newRows = (activeQuestion.matrixRows || []).filter(r => r.id !== row.id);
                              handleUpdateActiveQuestion({ matrixRows: newRows });
                            }} style={{ minWidth: 26, padding: '2px 8px', fontSize: 12 }}>✕</W95Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </GroupBox>
                )}

                {/* ── SHORT ESSAY ── */}
                {activeQuestion.type === 'SHORT_ESSAY' && (
                  <GroupBox title="Isian Singkat — Kata Kunci Jawaban">
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>
                        Kata Kunci (pisah koma, tidak case-sensitive):
                      </label>
                      <W95Input
                        value={(activeQuestion.shortKeywords || []).join(', ')}
                        onChange={v => {
                          const kws = v.split(',').map(s => s.trim()).filter(Boolean);
                          handleUpdateActiveQuestion({ shortKeywords: kws });
                        }}
                        placeholder="variabel, variable, penampung data"
                      />
                      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                        ℹ Siswa mendapat nilai otomatis jika jawaban mengandung salah satu kata kunci di atas.
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>
                        Kunci Jawaban Lengkap (referensi guru):
                      </label>
                      <W95Input
                        value={activeQuestion.sampleAnswer || ''}
                        onChange={v => handleUpdateActiveQuestion({ sampleAnswer: v })}
                        placeholder="Contoh jawaban ideal..."
                      />
                    </div>
                  </GroupBox>
                )}

                {/* ── LONG ESSAY ── */}
                {activeQuestion.type === 'LONG_ESSAY' && (
                  <GroupBox title="Uraian Panjang (Mode B) — Rubrik &amp; Kata Kunci">
                    <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>Minimal Kata:</label>
                        <W95NumberInput value={activeQuestion.minWords || 20} onChange={v => handleUpdateActiveQuestion({ minWords: v })} min={5} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>Rubrik Mode B:</label>
                        <span style={{ fontSize: 12, color: '#555' }}>
                          Asisten analisis kata kunci otomatis &amp; penilaian mandiri guru.
                        </span>
                      </div>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontWeight: 'bold', fontSize: 13 }}>Rubrik Kata Kunci (Asisten Skoring):</label>
                        <W95Button onClick={() => {
                          const kws = activeQuestion.essayKeywords || [];
                          const newKw: EssayKeyword = { phrase: 'kata kunci...', weight: 2, explanation: 'Kriteria...' };
                          handleUpdateActiveQuestion({ essayKeywords: [...kws, newKw] });
                        }}>+ Tambah Kriteria</W95Button>
                      </div>
                      <div style={{ ...sunkenStyle, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(activeQuestion.essayKeywords || []).map((ek, ekIdx) => (
                          <div key={ekIdx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="text" value={ek.phrase}
                              onChange={e => {
                                const newKws = [...(activeQuestion.essayKeywords || [])];
                                newKws[ekIdx] = { ...newKws[ekIdx], phrase: e.target.value };
                                handleUpdateActiveQuestion({ essayKeywords: newKws });
                              }}
                              placeholder="Frasa kata kunci..."
                              style={{ ...sunkenStyle, flex: 1, fontSize: 13, padding: '4px 8px', outline: 'none' }}
                            />
                            <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>Bobot:</span>
                            <input type="number" min={1} value={ek.weight}
                              onChange={e => {
                                const newKws = [...(activeQuestion.essayKeywords || [])];
                                newKws[ekIdx] = { ...newKws[ekIdx], weight: parseInt(e.target.value) || 1 };
                                handleUpdateActiveQuestion({ essayKeywords: newKws });
                              }}
                              style={{ ...sunkenStyle, width: 50, fontSize: 13, padding: '4px 6px', textAlign: 'center', outline: 'none' }}
                            />
                            <input type="text" value={ek.explanation || ''}
                              onChange={e => {
                                const newKws = [...(activeQuestion.essayKeywords || [])];
                                newKws[ekIdx] = { ...newKws[ekIdx], explanation: e.target.value };
                                handleUpdateActiveQuestion({ essayKeywords: newKws });
                              }}
                              placeholder="Penjelasan..."
                              style={{ ...sunkenStyle, width: 220, fontSize: 13, padding: '4px 8px', outline: 'none' }}
                            />
                            <W95Button danger onClick={() => {
                              const newKws = (activeQuestion.essayKeywords || []).filter((_, i) => i !== ekIdx);
                              handleUpdateActiveQuestion({ essayKeywords: newKws });
                            }} style={{ minWidth: 26, padding: '2px 8px', fontSize: 12 }}>✕</W95Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 4, fontSize: 13 }}>Pedoman Penilaian / Kunci Lengkap:</label>
                      <W95Textarea
                        rows={3}
                        value={activeQuestion.sampleAnswer || ''}
                        onChange={v => handleUpdateActiveQuestion({ sampleAnswer: v })}
                        placeholder="Pedoman penilaian atau contoh jawaban ideal..."
                      />
                    </div>
                  </GroupBox>
                )}
              </div>
            ) : (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                color: '#404040', ...font,
              }}>
                <div style={{ fontSize: 52, marginBottom: 14 }}>📋</div>
                <div style={{ ...sunkenStyle, padding: '12px 24px', fontSize: 14, fontWeight: 'bold' }}>
                  Pilih butir soal di panel kiri, atau tambah butir soal baru dari toolbar di atas.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Status Bar ── */}
        <div style={{
          ...font,
          borderTop: `2px solid ${W95_SHADOW}`,
          background: W95_BG,
          display: 'flex', gap: 6, padding: '4px 8px',
          fontSize: 12,
        }}>
          {[
            `📝 ${questions.length} Butir Soal`,
            `⚖ Total: ${totalPoints} Poin`,
            activeQuestion ? `✏ Aktif: Soal #${questions.findIndex(q => q.id === activeQuestionId) + 1} — ${getTypeShort(activeQuestion.type)}` : '— Tidak ada butir soal dipilih',
          ].map((s, i) => (
            <React.Fragment key={i}>
              <div style={{ ...sunkenStyle, padding: '2px 10px' }}>{s}</div>
            </React.Fragment>
          ))}
          <div style={{ ...sunkenStyle, padding: '2px 10px', marginLeft: 'auto', color: '#333' }}>
            Small-Edu Question Editor v1.0
          </div>
        </div>

        {/* ── Bottom Button Bar ── */}
        <div style={{
          ...font,
          background: W95_BG,
          borderTop: `1px solid ${W95_WHITE}`,
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '8px 12px',
        }}>
          <W95Button primary onClick={() => onSave(questions)} style={{ minWidth: 150, padding: '6px 18px', fontSize: 13 }}>
            💾 Simpan Semua Soal
          </W95Button>
          <W95Button onClick={onClose} style={{ minWidth: 90, padding: '6px 18px', fontSize: 13 }}>
            Batal
          </W95Button>
        </div>
      </div>
    </div>
  );
};
