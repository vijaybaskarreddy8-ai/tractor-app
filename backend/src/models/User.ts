import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  pinHash: string | null;
  deletePinHash: string | null;
  preferredLanguage: 'en' | 'te';
}

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  pinHash: {
    type: String,
    default: null,
  },
  deletePinHash: {
    type: String,
    default: null,
  },
  preferredLanguage: {
    type: String,
    enum: ['en', 'te'],
    default: 'en',
  },
});

const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
