'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  return (
    <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
      <Link href="/boards" className="font-semibold">
        Task Board
      </Link>
      {user && (
        <div className="flex items-center gap-4 text-sm text-neutral-600">
          <span>{user.name}</span>
          <button onClick={handleLogout} className="text-neutral-500 hover:text-neutral-900">
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
