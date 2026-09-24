'use client';

import { FormEvent, useState } from 'react';
import { Board } from '@/lib/types';
import { ApiRequestError } from '@/lib/api';

export function MembersPanel({
  board,
  currentUserId,
  onInvite,
  onRemove,
}: {
  board: Board;
  currentUserId: string;
  onInvite: (email: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const isOwner = board.members.find((m) => m.id === currentUserId)?.role === 'owner';

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await onInvite(email.trim());
      setEmail('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Could not invite that user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Members</h2>
      <ul className="flex flex-col gap-2">
        {board.members.map((member) => (
          <li key={member.id} className="flex items-center justify-between text-xs">
            <span>
              {member.name} <span className="text-neutral-400">({member.role})</span>
            </span>
            {isOwner && member.role !== 'owner' && (
              <button onClick={() => onRemove(member.id)} className="text-neutral-400 hover:text-red-600">
                remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={handleInvite} className="flex flex-col gap-2">
          <input
            type="email"
            placeholder="Invite by email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-neutral-300 px-2 py-1.5 text-xs outline-none focus:border-neutral-500"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-neutral-900 px-2 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            Invite
          </button>
        </form>
      )}
    </div>
  );
}
