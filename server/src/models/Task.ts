import { Document, Schema, Types, model } from 'mongoose';

export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface TaskDocument extends Document<Types.ObjectId> {
  board: Types.ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  position: number;
  assignee: Types.ObjectId | null;
  dueDate: Date | null;
  createdBy: Types.ObjectId;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<TaskDocument>(
  {
    board: { type: Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
    position: { type: Number, required: true, default: 0 },
    assignee: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    dueDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Task = model<TaskDocument>('Task', taskSchema);
