import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWorkType extends Document {
  workerId: Types.ObjectId;
  name: string;
  hourlyRate: number | null;
  createdAt: Date;
}

const WorkTypeSchema = new Schema<IWorkType>({
  workerId: {
    type: Schema.Types.ObjectId,
    ref: 'Worker',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  hourlyRate: {
    type: Number,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const WorkType = mongoose.models.WorkType || mongoose.model<IWorkType>('WorkType', WorkTypeSchema);

export default WorkType;
