import { Document, Schema, Types, model } from 'mongoose';

export type BoardRole = 'owner' | 'member';

export interface BoardMember {
  user: Types.ObjectId;
  role: BoardRole;
}

export interface BoardDocument extends Document<Types.ObjectId> {
  name: string;
  owner: Types.ObjectId;
  members: BoardMember[];
  createdAt: Date;
  updatedAt: Date;
}

const memberSchema = new Schema<BoardMember>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member'], required: true },
  },
  { _id: false },
);

const boardSchema = new Schema<BoardDocument>(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [memberSchema], default: [] },
  },
  { timestamps: true },
);

export const Board = model<BoardDocument>('Board', boardSchema);
