'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { Navbar } from '@/components/Navbar';
import { BoardColumn } from '@/components/BoardColumn';
import { TaskModal } from '@/components/TaskModal';
import { ActivityFeed } from '@/components/ActivityFeed';
import { MembersPanel } from '@/components/MembersPanel';
import { useAuth } from '@/lib/auth-context';
import { api, ApiRequestError } from '@/lib/api';
import { createBoardSocket } from '@/lib/socket';
import { Board, Task, TaskStatus, ActivityEntry } from '@/lib/types';

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

export default function BoardPage() {
  const { user, loading, token } = useAuth();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const boardId = params.id;

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [banner, setBanner] = useState('');
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [renamingName, setRenamingName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [modalState, setModalState] = useState<{ open: boolean; task: Task | null; defaultStatus: TaskStatus }>({
    open: false,
    task: null,
    defaultStatus: 'todo',
  });

  const socketRef = useRef<ReturnType<typeof createBoardSocket> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function resync() {
    const [boardRes, tasksRes, activityRes] = await Promise.all([
      api.getBoard(boardId),
      api.listTasks(boardId),
      api.listActivity(boardId),
    ]);
    setBoard(boardRes.board);
    setTasks(tasksRes.tasks);
    setActivity(activityRes.activity);
  }

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFetching(true);
    setAccessError('');

    resync()
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiRequestError) {
          setAccessError(err.message);
        } else {
          setAccessError('Something went wrong loading this board');
        }
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, boardId]);

  useEffect(() => {
    if (!user || !token) return;

    const socket = createBoardSocket(token);
    socketRef.current = socket;

    function join() {
      socket.emit('board:join', boardId);
    }

    socket.on('connect', join);
    socket.io.on('reconnect', () => {
      join();
      resync().catch(() => {});
    });

    socket.on('task:created', ({ task }: { task: Task }) => {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]));
    });

    socket.on('task:updated', ({ task }: { task: Task }) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
    });

    socket.on('task:deleted', ({ taskId }: { taskId: string }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    });

    socket.on('board:updated', ({ board: updated }: { board: Board }) => {
      setBoard(updated);
    });

    socket.on('board:deleted', () => {
      router.replace('/boards');
    });

    socket.on('activity:new', (entry: ActivityEntry) => {
      setActivity((prev) => [entry, ...prev].slice(0, 100));
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, token, boardId]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (assigneeFilter && task.assignee !== assigneeFilter) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        if (!task.title.toLowerCase().includes(term) && !task.description.toLowerCase().includes(term)) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, search, assigneeFilter]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = { todo: [], 'in-progress': [], done: [] };
    for (const task of visibleTasks) {
      grouped[task.status].push(task);
    }
    for (const status of STATUSES) {
      grouped[status].sort((a, b) => a.position - b.position);
    }
    return grouped;
  }, [visibleTasks]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find((t) => t.id === active.id);
    if (!activeTask) return;

    let destStatus: TaskStatus;
    let overTaskId: string | null = null;

    if (STATUSES.includes(over.id as TaskStatus)) {
      destStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      if (!overTask) return;
      destStatus = overTask.status;
      overTaskId = overTask.id;
    }

    const destTasks = tasks
      .filter((t) => t.status === destStatus && t.id !== activeTask.id)
      .sort((a, b) => a.position - b.position);

    let insertIndex = destTasks.length;
    if (overTaskId) {
      const idx = destTasks.findIndex((t) => t.id === overTaskId);
      if (idx !== -1) insertIndex = idx;
    }

    const prev = destTasks[insertIndex - 1];
    const next = destTasks[insertIndex];
    let newPosition: number;
    if (prev && next) newPosition = (prev.position + next.position) / 2;
    else if (prev) newPosition = prev.position + 1;
    else if (next) newPosition = next.position - 1;
    else newPosition = 0;

    if (destStatus === activeTask.status && Math.abs(newPosition - activeTask.position) < 1e-9) return;

    const previousTasks = tasks;
    setTasks((curr) =>
      curr.map((t) => (t.id === activeTask.id ? { ...t, status: destStatus, position: newPosition } : t)),
    );

    try {
      const res = await api.updateTask(activeTask.id, {
        status: destStatus,
        position: newPosition,
        version: activeTask.version,
      });
      setTasks((curr) => curr.map((t) => (t.id === res.task.id ? res.task : t)));
    } catch (err) {
      setTasks(previousTasks);
      const latest = err instanceof ApiRequestError && err.status === 409 ? err.payload.task : undefined;
      if (latest) {
        setTasks((curr) => curr.map((t) => (t.id === latest.id ? latest : t)));
        setBanner('Someone else moved that task first — refreshed to the latest state.');
        setTimeout(() => setBanner(''), 4000);
      }
    }
  }

  async function handleCreateOrUpdate(data: {
    title: string;
    description: string;
    assignee: string | null;
    dueDate: string | null;
    status: TaskStatus;
  }) {
    if (modalState.task) {
      try {
        const res = await api.updateTask(modalState.task.id, { ...data, version: modalState.task.version });
        setTasks((curr) => curr.map((t) => (t.id === res.task.id ? res.task : t)));
      } catch (err) {
        const latest = err instanceof ApiRequestError && err.status === 409 ? err.payload.task : undefined;
        if (latest) {
          setTasks((curr) => curr.map((t) => (t.id === latest.id ? latest : t)));
        }
        throw err;
      }
    } else {
      const res = await api.createTask(boardId, data);
      setTasks((curr) => (curr.some((t) => t.id === res.task.id) ? curr : [...curr, res.task]));
    }
  }

  async function handleDelete() {
    if (!modalState.task) return;
    const taskId = modalState.task.id;
    setTasks((curr) => curr.filter((t) => t.id !== taskId));
    try {
      await api.deleteTask(taskId);
    } catch {
      resync().catch(() => {});
    }
  }

  async function handleInvite(email: string) {
    const res = await api.addMember(boardId, email);
    setBoard(res.board);
  }

  async function handleRemoveMember(userId: string) {
    const res = await api.removeMember(boardId, userId);
    setBoard(res.board);
  }

  async function handleRename() {
    if (!board || !renamingName.trim() || renamingName === board.name) {
      setIsRenaming(false);
      return;
    }
    const res = await api.renameBoard(boardId, renamingName.trim());
    setBoard(res.board);
    setIsRenaming(false);
  }

  if (loading || !user) return null;

  if (accessError) {
    return (
      <div className="flex flex-1 flex-col">
        <Navbar />
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">{accessError}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Navbar />

      {banner && <div className="bg-amber-50 px-6 py-2 text-xs text-amber-800">{banner}</div>}

      <main className="flex flex-1 flex-col gap-4 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {isRenaming ? (
            <input
              autoFocus
              value={renamingName}
              onChange={(e) => setRenamingName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              className="rounded-md border border-neutral-300 px-2 py-1 text-lg font-semibold outline-none"
            />
          ) : (
            <h1
              className="cursor-text text-lg font-semibold"
              onClick={() => {
                setRenamingName(board?.name ?? '');
                setIsRenaming(true);
              }}
            >
              {fetching ? 'Loading...' : board?.name}
            </h1>
          )}

          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks"
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-500"
            />
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm outline-none focus:border-neutral-500"
            >
              <option value="">Everyone</option>
              {board?.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!fetching && board && (
          <div className="flex flex-1 gap-6">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
                {STATUSES.map((status) => (
                  <BoardColumn
                    key={status}
                    status={status}
                    tasks={tasksByStatus[status]}
                    members={board.members}
                    onTaskClick={(task) => setModalState({ open: true, task, defaultStatus: task.status })}
                    onAddTask={(status) => setModalState({ open: true, task: null, defaultStatus: status })}
                  />
                ))}
              </div>
            </DndContext>

            <aside className="w-64 shrink-0 space-y-6 border-l border-neutral-200 pl-6">
              <MembersPanel board={board} currentUserId={user.id} onInvite={handleInvite} onRemove={handleRemoveMember} />
              <ActivityFeed activity={activity} />
            </aside>
          </div>
        )}
      </main>

      {modalState.open && board && (
        <TaskModal
          members={board.members}
          task={modalState.task}
          defaultStatus={modalState.defaultStatus}
          onClose={() => setModalState({ open: false, task: null, defaultStatus: 'todo' })}
          onSave={handleCreateOrUpdate}
          onDelete={modalState.task ? handleDelete : undefined}
        />
      )}
    </div>
  );
}
