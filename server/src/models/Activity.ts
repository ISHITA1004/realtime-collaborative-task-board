import { Schema, model, Types } from 'mongoose';

export type ActivityType =
  | 'board_created'
  | 'board_renamed'
  | 'member_added'
  | 'member_removed'
  | 'task_created'
  | 'task_updated'
  | 'task_moved'
  | 'task_assigned'
  | 'task_completed'
  | 'task_deleted';

export interface ActivityDocument {
  _id: Types.ObjectId;
  board: Types.ObjectId;
  user: Types.ObjectId;
  type: ActivityType;
  message: string;
  meta: Record<string, unknown>;
  createdAt: Date;
}

const activitySchema = new Schema<ActivityDocument>({
  board: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    required: true,
    enum: [
      'board_created',
      'board_renamed',
      'member_added',
      'member_removed',
      'task_created',
      'task_updated',
      'task_moved',
      'task_assigned',
      'task_completed',
      'task_deleted',
    ],
  },
  message: { type: String, required: true },
  meta: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
});

export const Activity = model<ActivityDocument>('Activity', activitySchema);
