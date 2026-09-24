export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface User {
  id: string;
  name: string;
  email: string;
}

export type BoardRole = 'owner' | 'member';

export interface BoardMember {
  id: string;
  name: string;
  email: string;
  role: BoardRole;
}

export interface Board {
  id: string;
  name: string;
  ownerId: string;
  members: BoardMember[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  boardId: string;
  title: string;
  description: string;
  status: TaskStatus;
  position: number;
  assignee: string | null;
  dueDate: string | null;
  createdBy: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  meta: Record<string, unknown>;
  user: { id: string; name: string } | null;
  createdAt: string;
}
