import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEntry extends Document {
  workTypeId: Types.ObjectId;
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const EntrySchema = new Schema<IEntry>({
  workTypeId: {
    type: Schema.Types.ObjectId,
    ref: 'WorkType',
    required: true,
    index: true,
  },
  date: {
    type: Date,
    required: true,
    index: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  durationMinutes: {
    type: Number,
    required: true,
  },
  note: {
    type: String,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

function parseHHmm(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

EntrySchema.pre('save', function (this: any) {
  const startMinutes = parseHHmm(this.startTime);
  const endMinutes = parseHHmm(this.endTime);

  let duration = endMinutes - startMinutes;
  if (duration <= 0) {
    duration += 24 * 60;
  }

  this.durationMinutes = duration;
  this.updatedAt = new Date();
});

const Entry = mongoose.models.Entry || mongoose.model<IEntry>('Entry', EntrySchema);

export default Entry;
