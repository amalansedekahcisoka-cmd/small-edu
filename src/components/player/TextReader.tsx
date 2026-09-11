'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { RetroWindow } from '../ui/RetroWindow';
import { RetroButton } from '../ui/RetroButton';
import { RetroBadge } from '../ui/RetroBadge';
import { BookOpen, Clock, ArrowDownCircle, CheckCircle2, Lock, Sparkles, PauseCircle } from 'lucide-react';

interface TextReaderProps {
  title: string;
  textContent: string;
  minReadingSeconds?: number;
  isCompleted?: boolean;
  onComplete: () => void;
}

export const TextReader: React.FC<TextReaderProps> = ({
  title,
  textContent,
  minReadingSeconds = 45,
  isCompleted = false,
  onComplete,
}) => {
  const [secondsRead, setSecondsRead] = useState<number>(isCompleted ? minReadingSeconds : 0);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState<boolean>(isCompleted);
  const [isTabActive, setIsTabActive] = useState<boolean>(true);
  const [alreadyCompleted, setAlreadyCompleted] = useState<boolean>(isCompleted);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // Tab visibility tracker (AFK detection)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Dwell timer
  useEffect(() => {
    if (alreadyCompleted) return;

    const timer = setInterval(() => {
      if (isTabActive) {
        setSecondsRead((prev) => {
          if (prev >= minReadingSeconds) return prev;
          return prev + 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isTabActive, alreadyCompleted, minReadingSeconds]);

  // Scroll to bottom observer
  useEffect(() => {
    if (alreadyCompleted) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasScrolledToBottom(true);
        }
      },
      { threshold: 0.8 }
    );

    if (bottomSentinelRef.current) {
      observer.observe(bottomSentinelRef.current);
    }

    return () => observer.disconnect();
  }, [alreadyCompleted]);

  const isTimerSatisfied = secondsRead >= minReadingSeconds;
  const isEligible = (isTimerSatisfied && hasScrolledToBottom) || alreadyCompleted;

  const handleFinish = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
    setAlreadyCompleted(true);
    onComplete();
  };

  return (
    <div className="space-y-4">
      {/* Sticky Top Status Monitor */}
      <div className="bg-[#fff8db] neo-border p-3 neo-shadow-sm flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-700" />
            <span>WAKTU BACA:</span>
            <RetroBadge variant={isTimerSatisfied ? 'green' : 'yellow'} size="sm">
              {secondsRead}s / {minReadingSeconds}s
            </RetroBadge>
          </div>

          <div className="flex items-center gap-1.5">
            <ArrowDownCircle className="w-4 h-4 text-blue-700" />
            <span>SCROLL 100%:</span>
            <RetroBadge variant={hasScrolledToBottom ? 'green' : 'gray'} size="sm">
              {hasScrolledToBottom ? 'TERCAPAI' : 'BELUM KE BAWAH'}
            </RetroBadge>
          </div>
        </div>

        {!isTabActive && (
          <div className="flex items-center gap-1 text-red-600 font-bold animate-pulse">
            <PauseCircle className="w-4 h-4" />
            Timer Dijeda (Tab Tidak Aktif)
          </div>
        )}
      </div>

      {/* Reading Document Container */}
      <RetroWindow
        title={`MODUL LITERASI: ${title}`}
        headerColor="mustard"
        icon={<BookOpen className="w-4 h-4" />}
      >
        <div className="prose max-w-none space-y-4 text-zinc-900 leading-relaxed font-sans text-sm sm:text-base">
          {textContent.split('\n\n').map((paragraph, index) => {
            if (paragraph.startsWith('# ')) {
              return (
                <h1
                  key={index}
                  className="text-xl sm:text-2xl font-black border-b-2 border-black pb-2 text-black"
                >
                  {paragraph.replace('# ', '')}
                </h1>
              );
            }
            if (paragraph.startsWith('### ')) {
              return (
                <h3
                  key={index}
                  className="text-base sm:text-lg font-bold bg-[#dfdbd2] px-2 py-1 border-l-4 border-black inline-block text-black"
                >
                  {paragraph.replace('### ', '')}
                </h3>
              );
            }
            if (paragraph.startsWith('* ') || paragraph.startsWith('- ')) {
              return (
                <ul key={index} className="list-disc list-inside space-y-1 bg-[#f9f8f4] p-3 border border-black">
                  {paragraph.split('\n').map((item, i) => (
                    <li key={i} className="text-sm">
                      {item.replace(/^[\*\-]\s/, '')}
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={index} className="text-justify">
                {paragraph}
              </p>
            );
          })}

          {/* Bottom Sentinel to verify 100% scroll depth */}
          <div
            ref={bottomSentinelRef}
            className="mt-8 p-4 bg-[#79f2c0] neo-border-sm text-center text-xs font-mono font-bold"
          >
            🏁 KAMU TELAH MENCAPAI AKHIR HALAMAN MODUL
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t-2 border-black flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs font-mono text-zinc-600">
            {!isEligible ? (
              <span>
                🔒 Syarat: Baca minimal {minReadingSeconds} detik dan gulir layar hingga mencapai
                paling bawah.
              </span>
            ) : (
              <span className="text-emerald-700 font-bold">
                ✅ Seluruh syarat literasi telah terpenuhi!
              </span>
            )}
          </div>

          <RetroButton
            variant={isEligible ? 'yellow' : 'gray'}
            disabled={!isEligible || alreadyCompleted}
            onClick={handleFinish}
            icon={
              alreadyCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-green-700" />
              ) : isEligible ? (
                <Sparkles className="w-4 h-4 text-amber-600" />
              ) : (
                <Lock className="w-4 h-4" />
              )
            }
          >
            {alreadyCompleted
              ? 'Modul Ini Telah Selesai'
              : isEligible
              ? 'Selesaikan Bab 2 & Buka Bab 3 🚀'
              : 'Baca Hingga Tuntas Untuk Membuka'}
          </RetroButton>
        </div>
      </RetroWindow>
    </div>
  );
};
