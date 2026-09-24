import { Types } from 'mongoose';
import { Activity, ActivityType } from '../models/Activity';
import { User } from '../models/User';
import { emitToBoard } from '../sockets/io';

export async function recordActivity(params: {
  boardId: Types.ObjectId | string;
  userId: Types.ObjectId | string;
  type: ActivityType;
  message: string;
  meta?: Record<string, unknown>;
}) {
  const [activity, user] = await Promise.all([
    Activity.create({
      board: params.boardId,
      user: params.userId,
      type: params.type,
      message: params.message,
      meta: params.meta ?? {},
    }),
    User.findById(params.userId, 'name'),
  ]);

  emitToBoard(String(params.boardId), 'activity:new', {
    id: String(activity._id),
    type: activity.type,
    message: activity.message,
    meta: activity.meta,
    user: user ? { id: String(user._id), name: user.name } : null,
    createdAt: activity.createdAt,
  });

  return activity;
}
