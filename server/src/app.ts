import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import boardRoutes from './routes/board.routes';
import taskRoutes from './routes/task.routes';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.clientUrl }));
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/boards', boardRoutes);
  app.use('/api/tasks', taskRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
