import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { message: 'Route not found', code: 'NOT_FOUND' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
  }

  if (err instanceof Error && err.name === 'ValidationError') {
    return res.status(400).json({ error: { message: err.message, code: 'VALIDATION_ERROR' } });
  }

  if (err instanceof Error && err.name === 'CastError') {
    return res.status(400).json({ error: { message: 'Invalid id', code: 'INVALID_ID' } });
  }

  console.error(err);
  res.status(500).json({ error: { message: 'Something went wrong', code: 'INTERNAL_ERROR' } });
}
