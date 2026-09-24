import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { verifyToken } from '../utils/jwt';
import { getBoardOrThrow, assertBoardMember } from '../utils/boardAuth';
import { boardRoom, setIO } from './io';

interface AuthedSocket extends Socket {
  userId?: string;
}

export function initSockets(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientUrl },
  });

  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = verifyToken(token);
      socket.userId = payload.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthedSocket) => {
    socket.on('board:join', async (boardId: string, ack?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        const board = await getBoardOrThrow(boardId);
        assertBoardMember(board, socket.userId!);
        socket.join(boardRoom(boardId));
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err instanceof Error ? err.message : 'Unable to join board' });
      }
    });

    socket.on('board:leave', (boardId: string) => {
      socket.leave(boardRoom(boardId));
    });
  });

  setIO(io);
  return io;
}
