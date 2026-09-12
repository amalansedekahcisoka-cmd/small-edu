'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { DataProvider } from '@/lib/data/dataProvider';
import { User, UserRole } from '@/types';

interface UseAuthGuardOptions {
  allowedRoles?: UserRole[];
  redirectIfUnauthenticated?: boolean;
}

interface UseAuthGuardResult {
  user: User | null;
  isAuthorized: boolean;
  isLoading: boolean;
}

export function useAuthGuard({
  allowedRoles,
  redirectIfUnauthenticated = true,
}: UseAuthGuardOptions = {}): UseAuthGuardResult {
  const router = useRouter();
  const pathname = usePathname();
  const rolesKey = allowedRoles ? allowedRoles.join(',') : '';

  // Inisialisasi awal instan dari DataProvider
  const [user, setUser] = useState<User | null>(() => DataProvider.getCurrentUser());
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    const u = DataProvider.getCurrentUser();
    if (!u) return false;
    if (u.mustChangePassword && pathname !== '/auth/change-password') return false;
    if (allowedRoles && allowedRoles.length > 0) return allowedRoles.includes(u.role);
    return true;
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return !DataProvider.getCurrentUser();
  });

  useEffect(() => {
    const verifySession = () => {
      const currentUser = DataProvider.getCurrentUser();

      // 1. Belum login sama sekali (device/browser baru tanpa session cache)
      if (!currentUser) {
        setIsAuthorized(false);
        setIsLoading(false);
        if (redirectIfUnauthenticated) {
          const redirectTarget = encodeURIComponent(pathname);
          router.replace(`/?redirect=${redirectTarget}&auth_required=1`);
        }
        return;
      }

      // 2. Wajib ganti password jika flag aktif
      if (currentUser.mustChangePassword && pathname !== '/auth/change-password') {
        setIsAuthorized(false);
        setIsLoading(false);
        router.replace('/auth/change-password');
        return;
      }

      // 3. Pengecekan Hak Akses Peran (Role-based access)
      if (allowedRoles && allowedRoles.length > 0) {
        const hasAccess = allowedRoles.includes(currentUser.role);
        if (!hasAccess) {
          setIsAuthorized(false);
          setIsLoading(false);
          const fallbackPath =
            currentUser.role === 'admin'
              ? '/admin'
              : currentUser.role === 'teacher'
              ? '/teacher'
              : '/student';
          router.replace(fallbackPath);
          return;
        }
      }

      // Sesi valid dan terotorisasi
      setUser(currentUser);
      setIsAuthorized(true);
      setIsLoading(false);
    };

    verifySession();
  }, [pathname, router, rolesKey, redirectIfUnauthenticated]);

  return { user, isAuthorized, isLoading };
}
