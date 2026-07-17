import mongoose, { Schema, Document } from 'mongoose';

export interface IWorker extends Document {
  name: string;
  createdAt: Date;
}

const WorkerSchema = new Schema<IWorker>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Worker = mongoose.models.Worker || mongoose.model<IWorker>('Worker', WorkerSchema);

export default Worker;
