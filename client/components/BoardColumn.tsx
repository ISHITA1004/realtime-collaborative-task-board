'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, TaskStatus, BoardMember } from '@/lib/types';
import { TaskCard } from './TaskCard';

const LABELS: Record<TaskStatus, string> = {
  todo: 'Todo',
  'in-progress': 'In Progress',
  done: 'Done',
};

export function BoardColumn({
  status,
  tasks,
  members,
  onTaskClick,
  onAddTask,
}: {
  status: TaskStatus;
  tasks: Task[];
  members: BoardMember[];
  onTaskClick: (task: Task) => void;
  onAddTask: (status: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-xl bg-neutral-100 p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{LABELS[status]}</h2>
        <span className="text-xs text-neutral-500">{tasks.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-[60px] flex-1 flex-col gap-2 rounded-lg p-1 transition-colors ${
          isOver ? 'bg-neutral-200' : ''
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              assignee={task.assignee ? memberById.get(task.assignee) ?? null : null}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </SortableContext>
      </div>

      <button
        onClick={() => onAddTask(status)}
        className="mt-3 rounded-md px-2 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-200"
      >
        + Add task
      </button>
    </div>
  );
}
