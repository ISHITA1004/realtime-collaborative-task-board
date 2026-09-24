import { ActivityEntry, Board, Task, User } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  payload: { task?: Task; error?: { message: string; code: string } };

  constructor(
    status: number,
    message: string,
    code?: string,
    payload?: { task?: Task; error?: { message: string; code: string } },
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.payload = payload ?? {};
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiRequestError(res.status, body?.error?.message ?? 'Request failed', body?.error?.code, body);
  }

  return body as T;
}

export const api = {
  register: (data: { name: string; email: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  me: () => request<{ user: User }>('/api/auth/me'),

  listBoards: () => request<{ boards: Board[] }>('/api/boards'),

  createBoard: (name: string) =>
    request<{ board: Board }>('/api/boards', { method: 'POST', body: JSON.stringify({ name }) }),

  getBoard: (id: string) => request<{ board: Board }>(`/api/boards/${id}`),

  renameBoard: (id: string, name: string) =>
    request<{ board: Board }>(`/api/boards/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),

  deleteBoard: (id: string) => request<void>(`/api/boards/${id}`, { method: 'DELETE' }),

  addMember: (boardId: string, email: string) =>
    request<{ board: Board }>(`/api/boards/${boardId}/members`, { method: 'POST', body: JSON.stringify({ email }) }),

  removeMember: (boardId: string, userId: string) =>
    request<{ board: Board }>(`/api/boards/${boardId}/members/${userId}`, { method: 'DELETE' }),

  listTasks: (boardId: string, query?: { search?: string; status?: string; assignee?: string }) => {
    const params = new URLSearchParams();
    if (query?.search) params.set('search', query.search);
    if (query?.status) params.set('status', query.status);
    if (query?.assignee) params.set('assignee', query.assignee);
    const qs = params.toString();
    return request<{ tasks: Task[] }>(`/api/boards/${boardId}/tasks${qs ? `?${qs}` : ''}`);
  },

  createTask: (
    boardId: string,
    data: {
      title: string;
      description?: string;
      assignee?: string | null;
      dueDate?: string | null;
      status?: string;
    },
  ) => request<{ task: Task }>(`/api/boards/${boardId}/tasks`, { method: 'POST', body: JSON.stringify(data) }),

  updateTask: (taskId: string, data: Record<string, unknown>) =>
    request<{ task: Task }>(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteTask: (taskId: string) => request<void>(`/api/tasks/${taskId}`, { method: 'DELETE' }),

  listActivity: (boardId: string) => request<{ activity: ActivityEntry[] }>(`/api/boards/${boardId}/activity`),
};
