'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  GraduationCap,
  Award,
  Users,
  ClipboardCheck,
  Activity,
  Star,
  KeyRound,
  LogOut,
  ChevronDown,
  Shield,
} from 'lucide-react';
import { DataProvider } from '@/lib/data/dataProvider';
import { User } from '@/types';
import { RetroBadge } from '../ui/RetroBadge';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const loadData = () => {
    const user = DataProvider.getCurrentUser();
    setCurrentUser(user);

    const subs = DataProvider.getSubmissions();
    const pending = subs.filter((s) => s.status === 'pending').length;
    setPendingCount(pending);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smalledu_current_user');
    }
    setCurrentUser(null);
    router.push('/');
    router.refresh();
  };

  const isLoginPage = pathname === '/';

  return (
    <header className="sticky top-0 z-50 bg-[#dfdbd2] border-b-[2.5px] border-black neo-shadow-sm select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between flex-wrap gap-3">
        {/* Brand Logo */}
        <Link href={isLoginPage ? '/' : currentUser?.role === 'admin' ? '/admin' : currentUser?.role === 'teacher' ? '/teacher' : '/student'} className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-[#008080] text-white neo-border neo-shadow-sm flex items-center justify-center font-black text-xl group-hover:bg-[#006666] transition-colors">
            S
          </div>
          <div>
            <div className="font-black tracking-tight text-lg leading-tight flex items-center gap-1.5">
              <span>SMALL-EDU</span>
              <span className="bg-black text-[#79f2c0] text-[10px] px-1 font-mono rounded-none">
                LMS
              </span>
            </div>
            <div className="text-[11px] font-mono text-zinc-600 font-bold">
              Sequential Learning Engine
            </div>
          </div>
        </Link>

        {/* If on Login Page, show simple secure badge */}
        {isLoginPage ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-zinc-600 bg-white px-2.5 py-1 neo-border-sm font-bold">
              PORTAL LOGIN RESMI
            </span>
          </div>
        ) : currentUser ? (
          <>
            {/* Dynamic Navigation Links based on Role */}
            <nav className="flex items-center gap-2 flex-wrap text-sm font-bold">
              {currentUser.role === 'student' && (
                <>
                  <Link
                    href="/student"
                    className={`px-3 py-1.5 neo-border-sm transition-all ${
                      pathname.startsWith('/student') && !pathname.includes('achievements')
                        ? 'bg-[#008080] text-white neo-shadow-sm'
                        : 'bg-white text-black hover:bg-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4" />
                      Alur Belajar
                    </span>
                  </Link>

                  <Link
                    href="/student/achievements"
                    className={`px-3 py-1.5 neo-border-sm transition-all ${
                      pathname.includes('achievements')
                        ? 'bg-[#008080] text-white neo-shadow-sm'
                        : 'bg-white text-black hover:bg-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-500" />
                      Rapor Bintang
                    </span>
                  </Link>
                </>
              )}

              {currentUser.role === 'teacher' && (
                <>
                  <Link
                    href="/teacher"
                    className={`px-3 py-1.5 neo-border-sm transition-all ${
                      pathname === '/teacher' ? 'bg-[#008080] text-white neo-shadow-sm' : 'bg-white text-black hover:bg-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="w-4 h-4" />
                      Kursus Saya
                    </span>
                  </Link>

                  <Link
                    href="/teacher/grading"
                    className={`px-3 py-1.5 neo-border-sm relative transition-all ${
                      pathname.startsWith('/teacher/grading')
                        ? 'bg-[#008080] text-white neo-shadow-sm'
                        : 'bg-white text-black hover:bg-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <ClipboardCheck className="w-4 h-4" />
                      Meja Koreksi
                      {pendingCount > 0 && (
                        <span className="bg-[#ff5e57] text-white text-xs px-1.5 py-0.2 rounded-full font-mono font-black animate-pulse">
                          {pendingCount}
                        </span>
                      )}
                    </span>
                  </Link>

                  <Link
                    href="/teacher/activity-log"
                    className={`px-3 py-1.5 neo-border-sm transition-all ${
                      pathname.startsWith('/teacher/activity-log')
                        ? 'bg-[#008080] text-white neo-shadow-sm'
                        : 'bg-white text-black hover:bg-zinc-100'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4" />
                      Log Keaktifan
                    </span>
                  </Link>
                </>
              )}

            </nav>

            {/* User Profile & Menu */}
            <div className="flex items-center gap-3">
              {currentUser.role === 'student' && (
                <div className="flex items-center gap-1.5 bg-[#fff8db] border-2 border-black px-2.5 py-1 neo-shadow-sm">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                  <span className="font-mono font-black text-sm">{currentUser.starsCount || 0}</span>
                  <span className="text-[11px] font-bold text-amber-900 hidden sm:inline">BINTANG</span>
                </div>
              )}

              <div className="relative">
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="flex items-center gap-2 bg-white neo-border-sm px-2.5 py-1.5 neo-shadow-sm hover:bg-zinc-50"
                >
                  <div className="w-6 h-6 rounded-none bg-[#4ecdc4] border border-black flex items-center justify-center font-mono font-bold text-xs">
                    {currentUser.name[0]}
                  </div>
                  <div className="text-left hidden md:block">
                    <div className="text-xs font-bold leading-tight">{currentUser.name}</div>
                    <div className="text-[10px] font-mono text-zinc-600 uppercase">
                      {currentUser.role}
                    </div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                </button>

                {isMenuOpen && (
                  <div className="absolute right-0 mt-1 w-56 bg-white neo-border neo-shadow-lg p-2 z-50 font-mono text-xs">
                    <div className="border-b-2 border-black pb-2 mb-2">
                      <p className="font-bold">{currentUser.name}</p>
                      <p className="text-[11px] text-zinc-600 truncate">{currentUser.email}</p>
                      <RetroBadge variant="teal" size="sm" className="mt-1">
                        {currentUser.role}
                      </RetroBadge>
                    </div>

                    <div className="space-y-1 font-bold">
                      <Link
                        href="/auth/change-password"
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2 p-1.5 hover:bg-[#e6f4f4] border border-transparent hover:border-black"
                      >
                        <KeyRound className="w-4 h-4" />
                        Ubah Kata Sandi
                      </Link>

                      <button
                        onClick={handleLogout}
                        className="w-full text-left flex items-center gap-2 p-1.5 text-red-600 hover:bg-red-50 border border-transparent hover:border-black"
                      >
                        <LogOut className="w-4 h-4" />
                        Keluar (Logout)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
};
