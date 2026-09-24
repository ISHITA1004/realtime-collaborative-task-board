import { Types } from 'mongoose';
import { Board, BoardDocument } from '../models/Board';
import { ApiError } from './ApiError';

export async function getBoardOrThrow(boardId: string): Promise<BoardDocument> {
  if (!Types.ObjectId.isValid(boardId)) {
    throw ApiError.badRequest('Invalid board id', 'INVALID_ID');
  }
  const board = await Board.findById(boardId);
  if (!board) {
    throw ApiError.notFound('Board not found');
  }
  return board;
}

export function findMembership(board: BoardDocument, userId: string) {
  return board.members.find((member) => member.user.toString() === userId);
}

export function assertBoardMember(board: BoardDocument, userId: string) {
  const membership = findMembership(board, userId);
  if (!membership) {
    throw ApiError.forbidden('You do not have access to this board');
  }
  return membership;
}

export function assertBoardOwner(board: BoardDocument, userId: string) {
  const membership = assertBoardMember(board, userId);
  if (membership.role !== 'owner') {
    throw ApiError.forbidden('Only the board owner can do this');
  }
  return membership;
}
