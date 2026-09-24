import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Task, TaskStatus } from '../models/Task';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { assertBoardMember, findMembership, getBoardOrThrow } from '../utils/boardAuth';
import { recordActivity } from '../services/activity';
import { emitToBoard } from '../sockets/io';

const STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

function toTaskDTO(task: any) {
  return {
    id: String(task._id),
    boardId: String(task.board),
    title: task.title,
    description: task.description,
    status: task.status,
    position: task.position,
    assignee: task.assignee ? String(task.assignee) : null,
    dueDate: task.dueDate,
    createdBy: String(task.createdBy),
    version: task.version,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

async function nextPosition(boardId: Types.ObjectId, status: TaskStatus) {
  const last = await Task.findOne({ board: boardId, status }).sort({ position: -1 });
  return last ? last.position + 1 : 0;
}

export async function createTask(req: Request, res: Response) {
  const board = await getBoardOrThrow(req.params.id);
  assertBoardMember(board, req.userId!);

  const { title, description, assignee, dueDate, status } = req.body ?? {};
  if (!title || typeof title !== 'string') {
    throw ApiError.badRequest('title is required');
  }

  const taskStatus: TaskStatus = STATUSES.includes(status) ? status : 'todo';

  if (assignee) {
    if (!findMembership(board, assignee)) {
      throw ApiError.badRequest('assignee must be a member of this board', 'INVALID_ASSIGNEE');
    }
  }

  const position = await nextPosition(board._id, taskStatus);

  const task = await Task.create({
    board: board._id,
    title,
    description: description ?? '',
    status: taskStatus,
    position,
    assignee: assignee || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    createdBy: req.userId,
  });

  await recordActivity({
    boardId: board._id,
    userId: req.userId!,
    type: 'task_created',
    message: `created task "${task.title}"`,
    meta: { taskId: String(task._id) },
  });

  const dto = toTaskDTO(task);
  emitToBoard(String(board._id), 'task:created', { task: dto });
  res.status(201).json({ task: dto });
}

export async function listTasks(req: Request, res: Response) {
  const board = await getBoardOrThrow(req.params.id);
  assertBoardMember(board, req.userId!);

  const filter: Record<string, unknown> = { board: board._id };

  if (req.query.status && STATUSES.includes(req.query.status as TaskStatus)) {
    filter.status = req.query.status;
  }
  if (req.query.assignee) {
    filter.assignee = req.query.assignee;
  }
  if (req.query.search) {
    const search = String(req.query.search);
    filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const tasks = await Task.find(filter).sort({ status: 1, position: 1 });
  res.json({ tasks: tasks.map(toTaskDTO) });
}

async function getOwningBoard(taskBoardId: Types.ObjectId, userId: string) {
  const board = await getBoardOrThrow(String(taskBoardId));
  assertBoardMember(board, userId);
  return board;
}

export async function updateTask(req: Request, res: Response) {
  if (!Types.ObjectId.isValid(req.params.id)) {
    throw ApiError.badRequest('Invalid task id', 'INVALID_ID');
  }

  const existing = await Task.findById(req.params.id);
  if (!existing) {
    throw ApiError.notFound('Task not found');
  }

  const board = await getOwningBoard(existing.board, req.userId!);

  const { title, description, status, position, assignee, dueDate, version } = req.body ?? {};

  if (typeof version !== 'number') {
    throw ApiError.badRequest('version is required for updates', 'VERSION_REQUIRED');
  }

  const changes: Record<string, unknown> = {};
  const changedFields: string[] = [];

  if (title !== undefined && title !== existing.title) {
    if (!title) throw ApiError.badRequest('title cannot be empty');
    changes.title = title;
    changedFields.push('title');
  }
  if (description !== undefined && description !== existing.description) {
    changes.description = description;
    changedFields.push('description');
  }
  if (assignee !== undefined && String(existing.assignee ?? '') !== String(assignee ?? '')) {
    if (assignee && !findMembership(board, assignee)) {
      throw ApiError.badRequest('assignee must be a member of this board', 'INVALID_ASSIGNEE');
    }
    changes.assignee = assignee || null;
    changedFields.push('assignee');
  }
  if (dueDate !== undefined) {
    changes.dueDate = dueDate ? new Date(dueDate) : null;
    changedFields.push('dueDate');
  }

  let targetStatus: TaskStatus = existing.status;
  let targetPosition = existing.position;
  let isMove = false;

  if (status !== undefined && status !== existing.status) {
    if (!STATUSES.includes(status)) {
      throw ApiError.badRequest('invalid status', 'INVALID_STATUS');
    }
    targetStatus = status;
    isMove = true;
  }
  if (position !== undefined && position !== existing.position) {
    targetPosition = position;
    isMove = true;
  }

  if (isMove) {
    changes.status = targetStatus;
    changes.position = typeof targetPosition === 'number' ? targetPosition : await nextPosition(board._id, targetStatus);
    changedFields.push('status');
  }

  if (changedFields.length === 0) {
    return res.json({ task: toTaskDTO(existing) });
  }

  const updated = await Task.findOneAndUpdate(
    { _id: existing._id, version },
    { $set: changes, $inc: { version: 1 } },
    { new: true },
  );

  if (!updated) {
    const latest = await Task.findById(existing._id);
    return res.status(409).json({
      error: { message: 'This task was changed by someone else, refresh and try again', code: 'VERSION_CONFLICT' },
      task: latest ? toTaskDTO(latest) : null,
    });
  }

  const activityMessage = buildActivityMessage(existing, updated, changedFields);
  if (activityMessage) {
    await recordActivity({
      boardId: board._id,
      userId: req.userId!,
      type: activityMessage.type,
      message: activityMessage.message,
      meta: { taskId: String(updated._id) },
    });
  }

  const dto = toTaskDTO(updated);
  emitToBoard(String(board._id), 'task:updated', { task: dto });
  res.json({ task: dto });
}

function buildActivityMessage(
  before: { title: string; status: TaskStatus; assignee: Types.ObjectId | null },
  after: { title: string; status: TaskStatus; assignee: Types.ObjectId | null },
  changedFields: string[],
): { type: 'task_updated' | 'task_moved' | 'task_assigned' | 'task_completed'; message: string } | null {
  if (changedFields.includes('status') && before.status !== after.status) {
    if (after.status === 'done') {
      return { type: 'task_completed', message: `completed task "${after.title}"` };
    }
    return { type: 'task_moved', message: `moved task "${after.title}" from ${before.status} to ${after.status}` };
  }
  if (changedFields.includes('assignee')) {
    return { type: 'task_assigned', message: `updated the assignee on task "${after.title}"` };
  }
  if (changedFields.includes('title') || changedFields.includes('description') || changedFields.includes('dueDate')) {
    return { type: 'task_updated', message: `updated task "${after.title}"` };
  }
  return null;
}

export async function deleteTask(req: Request, res: Response) {
  if (!Types.ObjectId.isValid(req.params.id)) {
    throw ApiError.badRequest('Invalid task id', 'INVALID_ID');
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  const board = await getOwningBoard(task.board, req.userId!);
  await task.deleteOne();

  await recordActivity({
    boardId: board._id,
    userId: req.userId!,
    type: 'task_deleted',
    message: `deleted task "${task.title}"`,
  });

  emitToBoard(String(board._id), 'task:deleted', { taskId: String(task._id), boardId: String(board._id) });
  res.status(204).send();
}
