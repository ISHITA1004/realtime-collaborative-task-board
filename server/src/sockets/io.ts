import { Server } from 'socket.io';

let ioInstance: Server | null = null;

export function setIO(io: Server) {
  ioInstance = io;
}

export function boardRoom(boardId: string) {
  return `board:${boardId}`;
}

export function emitToBoard(boardId: string, event: string, payload: unknown) {
  if (!ioInstance) return;
  ioInstance.to(boardRoom(boardId)).emit(event, payload);
}
