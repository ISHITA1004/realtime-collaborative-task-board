import { Document, Schema, Types, model } from 'mongoose';

export interface UserDocument extends Document<Types.ObjectId> {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

const userSchema = new Schema<UserDocument>({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const User = model<UserDocument>('User', userSchema);
