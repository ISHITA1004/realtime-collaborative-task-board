import { Request, Response } from 'express';
import { Board } from '../models/Board';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { Activity } from '../models/Activity';
import { ApiError } from '../utils/ApiError';
import { assertBoardMember, assertBoardOwner, getBoardOrThrow } from '../utils/boardAuth';
import { recordActivity } from '../services/activity';
import { emitToBoard } from '../sockets/io';

function toMemberDTO(member: { user: any; role: string }) {
  const user = member.user;
  return {
    id: String(user._id ?? user),
    name: user.name,
    email: user.email,
    role: member.role,
  };
}

async function toBoardDTO(boardId: string) {
  const board = await Board.findById(boardId).populate('members.user', 'name email').populate('owner', 'name email');
  if (!board) throw ApiError.notFound('Board not found');
  return {
    id: String(board._id),
    name: board.name,
    ownerId: String(board.owner),
    members: board.members.map(toMemberDTO),
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
  };
}

export async function createBoard(req: Request, res: Response) {
  const { name } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    throw ApiError.badRequest('name is required');
  }

  const board = await Board.create({
    name,
    owner: req.userId,
    members: [{ user: req.userId, role: 'owner' }],
  });

  await recordActivity({
    boardId: board._id,
    userId: req.userId!,
    type: 'board_created',
    message: 'created this board',
  });

  res.status(201).json({ board: await toBoardDTO(String(board._id)) });
}

export async function listBoards(req: Request, res: Response) {
  const boards = await Board.find({ 'members.user': req.userId })
    .populate('members.user', 'name email')
    .populate('owner', 'name email')
    .sort({ updatedAt: -1 });

  res.json({
    boards: boards.map((board) => ({
      id: String(board._id),
      name: board.name,
      ownerId: String(board.owner),
      members: board.members.map(toMemberDTO),
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
    })),
  });
}

export async function getBoard(req: Request, res: Response) {
  const board = await getBoardOrThrow(req.params.id);
  assertBoardMember(board, req.userId!);
  res.json({ board: await toBoardDTO(String(board._id)) });
}

export async function renameBoard(req: Request, res: Response) {
  const { name } = req.body ?? {};
  if (!name || typeof name !== 'string') {
    throw ApiError.badRequest('name is required');
  }

  const board = await getBoardOrThrow(req.params.id);
  assertBoardMember(board, req.userId!);

  const previousName = board.name;
  board.name = name;
  await board.save();

  await recordActivity({
    boardId: board._id,
    userId: req.userId!,
    type: 'board_renamed',
    message: `renamed the board from "${previousName}" to "${name}"`,
  });

  const dto = await toBoardDTO(String(board._id));
  emitToBoard(String(board._id), 'board:updated', { board: dto });
  res.json({ board: dto });
}

export async function deleteBoard(req: Request, res: Response) {
  const board = await getBoardOrThrow(req.params.id);
  assertBoardOwner(board, req.userId!);

  await Task.deleteMany({ board: board._id });
  await Activity.deleteMany({ board: board._id });
  await board.deleteOne();

  emitToBoard(String(board._id), 'board:deleted', { boardId: String(board._id) });
  res.status(204).send();
}

export async function addMember(req: Request, res: Response) {
  const { email } = req.body ?? {};
  if (!email || typeof email !== 'string') {
    throw ApiError.badRequest('email is required');
  }

  const board = await getBoardOrThrow(req.params.id);
  assertBoardOwner(board, req.userId!);

  const invitee = await User.findOne({ email: email.toLowerCase() });
  if (!invitee) {
    throw ApiError.notFound('No registered user with that email', 'USER_NOT_FOUND');
  }

  const alreadyMember = board.members.some((member) => member.user.toString() === String(invitee._id));
  if (alreadyMember) {
    throw ApiError.badRequest('User is already a member of this board', 'ALREADY_MEMBER');
  }

  board.members.push({ user: invitee._id, role: 'member' });
  await board.save();

  await recordActivity({
    boardId: board._id,
    userId: req.userId!,
    type: 'member_added',
    message: `added ${invitee.name} to the board`,
  });

  const dto = await toBoardDTO(String(board._id));
  emitToBoard(String(board._id), 'board:updated', { board: dto });
  res.status(201).json({ board: dto });
}

export async function removeMember(req: Request, res: Response) {
  const board = await getBoardOrThrow(req.params.id);
  assertBoardOwner(board, req.userId!);

  const targetId = req.params.userId;
  if (targetId === String(board.owner)) {
    throw ApiError.badRequest('Cannot remove the board owner', 'CANNOT_REMOVE_OWNER');
  }

  const removed = board.members.find((member) => member.user.toString() === targetId);
  board.members = board.members.filter((member) => member.user.toString() !== targetId);
  await board.save();

  if (removed) {
    const removedUser = await User.findById(targetId);
    await recordActivity({
      boardId: board._id,
      userId: req.userId!,
      type: 'member_removed',
      message: `removed ${removedUser?.name ?? 'a member'} from the board`,
    });
  }

  const dto = await toBoardDTO(String(board._id));
  emitToBoard(String(board._id), 'board:updated', { board: dto });
  res.json({ board: dto });
}

export async function listActivity(req: Request, res: Response) {
  const board = await getBoardOrThrow(req.params.id);
  assertBoardMember(board, req.userId!);

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const activity = await Activity.find({ board: board._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('user', 'name email');

  res.json({
    activity: activity.map((entry) => ({
      id: String(entry._id),
      type: entry.type,
      message: entry.message,
      meta: entry.meta,
      user: entry.user ? { id: String((entry.user as any)._id), name: (entry.user as any).name } : null,
      createdAt: entry.createdAt,
    })),
  });
}
