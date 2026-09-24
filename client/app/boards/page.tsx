'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { api } from '@/lib/api';
import { Board } from '@/lib/types';

export default function BoardsPage() {
  const { user, loading } = useRequireAuth();
  const [boards, setBoards] = useState<Board[]>([]);
  const [fetching, setFetching] = useState(true);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    api
      .listBoards()
      .then((res) => setBoards(res.boards))
      .finally(() => setFetching(false));
  }, [user]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await api.createBoard(name.trim());
      setBoards((prev) => [res.board, ...prev]);
      setName('');
    } catch {
      setError('Could not create board');
    } finally {
      setCreating(false);
    }
  }

  if (loading || !user) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <form onSubmit={handleCreate} className="mb-8 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New board name"
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Create
          </button>
        </form>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {fetching ? (
          <p className="text-sm text-neutral-500">Loading boards...</p>
        ) : boards.length === 0 ? (
          <p className="text-sm text-neutral-500">No boards yet. Create your first one above.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {boards.map((board) => (
              <li key={board.id}>
                <Link
                  href={`/boards/${board.id}`}
                  className="block rounded-lg border border-neutral-200 p-4 hover:border-neutral-400"
                >
                  <p className="font-medium">{board.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {board.members.length} member{board.members.length === 1 ? '' : 's'}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
