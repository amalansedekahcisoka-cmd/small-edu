'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DataProvider } from '@/lib/data/dataProvider';
import { StarAchievement, User } from '@/types';
import { RetroWindow } from '@/components/ui/RetroWindow';
import { RetroButton } from '@/components/ui/RetroButton';
import { RetroBadge } from '@/components/ui/RetroBadge';
import { Star, Award, Zap, Flame, Clock, ShieldCheck, ArrowLeft } from 'lucide-react';

export default function StudentAchievementsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [achievements, setAchievements] = useState<StarAchievement[]>([]);

  useEffect(() => {
    const currentUser = DataProvider.getCurrentUser();
    setUser(currentUser);
    const achs = DataProvider.getAchievements(currentUser.id);
    setAchievements(achs);
  }, []);

  if (!user) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'FAST_RESPONDER':
        return <Zap className="w-6 h-6 text-amber-500" />;
      case 'DAILY_STREAK':
        return <Flame className="w-6 h-6 text-orange-500" />;
      case 'ON_TIME':
        return <Clock className="w-6 h-6 text-blue-500" />;
      case 'ACADEMIC_EXCELLENCE':
      default:
        return <Award className="w-6 h-6 text-yellow-500" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href="/student">
          <RetroButton variant="white" size="sm" icon={<ArrowLeft className="w-4 h-4" />}>
            Kembali ke Ruang Belajar
          </RetroButton>
        </Link>
        <span className="text-xs font-mono font-bold text-zinc-600 uppercase">
          SISTEM REWARD & GAMIFIKASI SISWA
        </span>
      </div>

      {/* Trophy Banner */}
      <div className="bg-[#fff8db] neo-border neo-shadow-lg p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 bg-black text-[#ffde59] px-2.5 py-0.5 font-mono text-xs font-bold">
            <Star className="w-3.5 h-3.5 fill-yellow-400" />
            RAPOR BINTANG KEAKTIFAN BELAJAR
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">
            Buku Koleksi Bintang: {user.name}
          </h1>
          <p className="text-sm font-sans text-zinc-700 max-w-xl">
            Sistem bintang dihitung berdasarkan <strong>Keaktifan & Kedisiplinan Belajar</strong>. Ditetapkan langsung oleh guru pembimbing dengan target pencapaian per bintang dan bobot tiap materi pembelajaran.
          </p>
        </div>

        {(() => {
          const starSettings = DataProvider.getCourseStarSettings();
          const xpPerStar = starSettings.xpPerStar || 100;
          const currentXpInCycle = (user.activityPoints || 0) % xpPerStar;
          const xpPercentInCycle = Math.min(100, Math.round((currentXpInCycle / xpPerStar) * 100));
          return (
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <div className="bg-white neo-border p-4 text-center min-w-[140px] neo-shadow">
                <div className="text-3xl font-black text-amber-500 flex items-center justify-center gap-1.5">
                  <Star className="w-7 h-7 fill-amber-400 text-amber-500" />
                  {user.starsCount || 0}
                </div>
                <div className="text-xs font-mono font-bold text-zinc-600 mt-1">
                  BINTANG AKTIF
                </div>
              </div>

              <div className="bg-white neo-border p-4 text-center min-w-[150px] neo-shadow space-y-1">
                <div className="text-2xl font-black text-[#008080]">
                  {user.activityPoints || 0} XP
                </div>
                <div className="w-full bg-zinc-200 h-2 border border-black/30 overflow-hidden">
                  <div
                    className="bg-[#008080] h-full"
                    style={{ width: `${xpPercentInCycle}%` }}
                  />
                </div>
                <div className="text-[10px] font-mono text-zinc-500">
                  {currentXpInCycle}/{xpPerStar} XP ke ⭐ berikutnya
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Badges Grid */}
      <RetroWindow
        title="DAFTAR LENCANA & PENCAPAIAN YANG DIRAIH"
        headerColor="navy"
        icon={<Award className="w-4 h-4 text-yellow-300" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {achievements.map((ach) => (
            <div
              key={ach.id}
              className="bg-white neo-border neo-shadow-sm p-4 flex items-start gap-4"
            >
              <div className="w-12 h-12 bg-[#f7f4ec] neo-border-sm flex items-center justify-center shrink-0">
                {getCategoryIcon(ach.category)}
              </div>

              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-black text-base">{ach.title}</h3>
                  <RetroBadge variant="yellow" size="sm">
                    +{ach.stars} ⭐
                  </RetroBadge>
                </div>
                <p className="text-xs text-zinc-600 font-sans">{ach.description}</p>
                <div className="text-[10px] font-mono text-zinc-500 pt-1">
                  Didapatkan pada: {new Date(ach.earnedAt).toLocaleDateString('id-ID')}
                </div>
              </div>
            </div>
          ))}

          {achievements.length === 0 && (
            <div className="col-span-2 text-center p-8 font-mono text-sm text-zinc-500">
              Belum ada bintang yang diperoleh. Kerjakan bab pertama untuk mulai mengumpulkan bintang!
            </div>
          )}
        </div>
      </RetroWindow>
    </div>
  );
}
