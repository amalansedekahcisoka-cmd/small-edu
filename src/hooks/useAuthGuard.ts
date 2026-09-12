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
  const [user, setUser] = useState<User | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Jalankan verifikasi sesi
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
          // Redirect ke dashboard yang sesuai rolenya
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
  }, [pathname, router, allowedRoles, redirectIfUnauthenticated]);

  return { user, isAuthorized, isLoading };
}
