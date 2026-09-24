import { ActivityEntry } from '@/lib/types';

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ activity }: { activity: ActivityEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">Activity</h2>
      {activity.length === 0 ? (
        <p className="text-xs text-neutral-500">Nothing yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {activity.map((entry) => (
            <li key={entry.id} className="text-xs text-neutral-600">
              <span className="font-medium text-neutral-900">{entry.user?.name ?? 'Someone'}</span>{' '}
              {entry.message}
              <div className="text-neutral-400">{timeAgo(entry.createdAt)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
