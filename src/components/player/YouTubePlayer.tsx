'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { extractYouTubeId, YouTubeWatchTracker } from '@/lib/engine/youtubeTracker';
import { RetroButton } from '../ui/RetroButton';
import { RetroBadge } from '../ui/RetroBadge';
import { RetroWindow } from '../ui/RetroWindow';
import { CheckCircle2, Play, Lock, Sparkles, AlertCircle, Clock, ShieldAlert } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoUrl: string;
  minWatchPercentage?: number;
  isCompleted?: boolean;
  onComplete: () => void;
  title: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({
  videoUrl,
  minWatchPercentage = 80,
  isCompleted = false,
  onComplete,
  title,
}) => {
  const videoId = extractYouTubeId(videoUrl) || 'kUMe1FH4CHE';
  const [watchPercent, setWatchPercent] = useState<number>(isCompleted ? 100 : 0);
  const [watchedSec, setWatchedSec] = useState<number>(0);
  const [totalSec, setTotalSec] = useState<number>(0);
  const [playerState, setPlayerState] = useState<'UNSTARTED' | 'PLAYING' | 'PAUSED' | 'ENDED' | 'BUFFERING'>('UNSTARTED');
  const [alreadyCompleted, setAlreadyCompleted] = useState<boolean>(isCompleted);
  const [scrubAlert, setScrubAlert] = useState<boolean>(false);
  const [apiReady, setApiReady] = useState<boolean>(false);

  const trackerRef = useRef<YouTubeWatchTracker>(new YouTubeWatchTracker(100));
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerId = `yt-player-${videoId}`;

  useEffect(() => {
    if (isCompleted) {
      setWatchPercent(100);
      setAlreadyCompleted(true);
    }
  }, [isCompleted]);

  // 1. Load YouTube Iframe API script if not already present
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;
      try {
        // Destroy existing instance if any
        if (playerRef.current && typeof playerRef.current.destroy === 'function') {
          playerRef.current.destroy();
        }

        playerRef.current = new window.YT.Player(containerId, {
          videoId: videoId,
          playerVars: {
            enablejsapi: 1,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (event: any) => {
              const dur = event.target.getDuration();
              if (dur > 0) {
                setTotalSec(Math.round(dur));
                trackerRef.current.setDuration(dur);
              }
              setApiReady(true);
            },
            onStateChange: (event: any) => {
              const state = event.data;
              // 1: PLAYING, 2: PAUSED, 0: ENDED, 3: BUFFERING
              if (state === 1) {
                setPlayerState('PLAYING');
                startTracking();
              } else if (state === 2) {
                setPlayerState('PAUSED');
                stopTracking();
              } else if (state === 0) {
                setPlayerState('ENDED');
                stopTracking();
              } else if (state === 3) {
                setPlayerState('BUFFERING');
              }
            },
          },
        });
      } catch (err) {
        console.warn('YouTube Player initialization fallback:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      const existingScript = document.getElementById('youtube-iframe-api-script');
      if (!existingScript) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevCallback) prevCallback();
        initPlayer();
      };
    }

    return () => {
      stopTracking();
      if (playerRef.current && typeof playerRef.current.destroy === 'function') {
        try {
          playerRef.current.destroy();
        } catch (_) {}
      }
    };
  }, [videoId]);

  const startTracking = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
        const currentTime = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        if (dur > 0 && trackerRef.current.getDuration() !== dur) {
          trackerRef.current.setDuration(dur);
          setTotalSec(Math.round(dur));
        }

        const pct = trackerRef.current.recordCurrentTime(currentTime);
        setWatchPercent(pct);
        setWatchedSec(Math.round(trackerRef.current.getWatchedSeconds()));

        // Jika siswa loncat jauh tapi persentase tontonan belum naik
        if (currentTime > 30 && pct < 15) {
          setScrubAlert(true);
        } else {
          setScrubAlert(false);
        }
      }
    }, 1000);
  };

  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleFinishChapter = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
    setAlreadyCompleted(true);
    onComplete();
  };

  const isEligible = watchPercent >= minWatchPercentage || alreadyCompleted;

  return (
    <div className="space-y-4">
      <RetroWindow
        title={`PEMUTAR VIDEO: ${title}`}
        headerColor="navy"
        icon={<Play className="w-4 h-4 text-yellow-300" />}
      >
        <div className="space-y-4">
          {/* YouTube Player Container */}
          <div className="relative w-full aspect-video bg-black neo-border overflow-hidden">
            <div id={containerId} className="w-full h-full" />
            {/* Fallback standard iframe if API is loading */}
            {!apiReady && (
              <iframe
                className="w-full h-full absolute inset-0"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&rel=0`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          {/* Watch Tracker Status & Anti-Scrubbing Feedback */}
          <div className="bg-[#fffde6] neo-border-sm p-3.5 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs uppercase flex items-center gap-1.5 text-gray-900">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Pelacak Durasi Tonton Nyata:
                </span>
                <RetroBadge variant={isEligible ? 'green' : 'yellow'} size="sm">
                  {watchPercent}% / Target Min: {minWatchPercentage}%
                </RetroBadge>
              </div>

              {alreadyCompleted ? (
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  Materi Tuntas Terselesaikan
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-700">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Status: <strong>{playerState}</strong>
                  {totalSec > 0 && (
                    <span className="text-gray-500 ml-1">
                      ({formatTime(watchedSec)} / {formatTime(totalSec)})
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Anti-Scrubbing Warning Alert */}
            {scrubAlert && !isEligible && (
              <div className="flex items-center gap-2 bg-rose-50 border border-rose-300 text-rose-800 text-xs px-3 py-2 rounded font-mono">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
                <span>
                  <strong>Anti-Loncat Aktif:</strong> Slider digeser ke menit depan, namun sistem hanya menghitung menit yang benar-benar Anda tonton secara berurutan.
                </span>
              </div>
            )}

            {/* Progress Bar (Retro Neobrutalism Bar) */}
            <div className="w-full bg-[#dfdbd2] h-6 neo-border-sm overflow-hidden p-0.5 relative">
              <div
                className={`h-full transition-all duration-500 ${
                  isEligible ? 'bg-[#79f2c0]' : 'bg-[#ffde59]'
                }`}
                style={{ width: `${watchPercent}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center font-mono font-black text-[11px] text-black">
                {watchPercent}% TERTONTON {totalSec > 0 ? `(${formatTime(watchedSec)} / ${formatTime(totalSec)})` : ''}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-600 font-mono">
              <span>Sistem membagi durasi menjadi segmen verifikasi 5-detik.</span>
              <span>Minimal syarat buka materi berikutnya: <strong>{minWatchPercentage}%</strong></span>
            </div>
          </div>

          {/* Complete Action Button */}
          <div className="pt-2 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs text-zinc-600 font-mono">
              {!isEligible
                ? `🔒 Tombol tuntas akan terbuka otomatis setelah menyimak minimal ${minWatchPercentage}%.`
                : '✅ Syarat menonton terpenuhi! Silakan simpan dan lanjutkan alur belajar.'}
            </p>

            <RetroButton
              variant={isEligible ? 'yellow' : 'gray'}
              disabled={!isEligible || alreadyCompleted}
              onClick={handleFinishChapter}
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
                ? 'Materi Video Telah Diselesaikan'
                : isEligible
                ? 'Selesai & Buka Sub-Bab Berikutnya'
                : `Tonton Min. ${minWatchPercentage}% Untuk Membuka (${watchPercent}%)`}
            </RetroButton>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
};
