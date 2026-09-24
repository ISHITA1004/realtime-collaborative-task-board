'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, BoardMember } from '@/lib/types';

function formatDueDate(dueDate: string) {
  const date = new Date(dueDate);
  const overdue = date.getTime() < Date.now();
  return { text: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), overdue };
}

export function TaskCard({
  task,
  assignee,
  onClick,
}: {
  task: Task;
  assignee: BoardMember | null;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const due = task.dueDate ? formatDueDate(task.dueDate) : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab rounded-lg border border-neutral-200 bg-white p-3 text-sm shadow-sm hover:border-neutral-400 active:cursor-grabbing"
    >
      <p className="font-medium">{task.title}</p>
      {task.description && <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{task.description}</p>}
      <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
        <span>{assignee ? assignee.name : 'Unassigned'}</span>
        {due && <span className={due.overdue ? 'font-medium text-red-600' : ''}>{due.text}</span>}
      </div>
    </div>
  );
}
