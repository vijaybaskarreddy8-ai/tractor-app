import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import Entry from '@/lib/db/models/Entry';

// Helper: compute duration in minutes handling midnight crossing
function computeDuration(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;

  // Handle midnight crossing
  if (endTotal <= startTotal) {
    endTotal += 24 * 60;
  }

  return endTotal - startTotal;
}

// Helper: check for overlapping entries
async function checkOverlap(
  workTypeId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeId?: string
): Promise<boolean> {
  const entries = await Entry.find({
    workTypeId,
    date,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();

  const [newStartH, newStartM] = startTime.split(':').map(Number);
  const [newEndH, newEndM] = endTime.split(':').map(Number);
  let newStart = newStartH * 60 + newStartM;
  let newEnd = newEndH * 60 + newEndM;
  if (newEnd <= newStart) newEnd += 24 * 60;

  for (const entry of entries) {
    const [eStartH, eStartM] = entry.startTime.split(':').map(Number);
    const [eEndH, eEndM] = entry.endTime.split(':').map(Number);
    let eStart = eStartH * 60 + eStartM;
    let eEnd = eEndH * 60 + eEndM;
    if (eEnd <= eStart) eEnd += 24 * 60;

    // Check overlap
    if (newStart < eEnd && newEnd > eStart) {
      return true;
    }
  }

  return false;
}

// GET /api/entries?workTypeId=... - List entries for a work type, sorted by date asc
export async function GET(request: NextRequest) {
  try {
    const workTypeId = request.nextUrl.searchParams.get('workTypeId');

    if (!workTypeId) {
      return NextResponse.json({ error: 'workTypeId is required' }, { status: 400 });
    }

    await connectDB();
    const entries = await Entry.find({ workTypeId })
      .sort({ date: 1, startTime: 1 })
      .lean();

    const formatted = entries.map((e) => ({
      ...e,
      _id: e._id.toString(),
      workTypeId: e.workTypeId.toString(),
      date: e.date.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('GET /api/entries error:', error);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}

// POST /api/entries - Create a new entry
export async function POST(request: NextRequest) {
  try {
    const { workTypeId, date, startTime, endTime, note } = await request.json();

    if (!workTypeId) {
      return NextResponse.json({ error: 'workTypeId is required' }, { status: 400 });
    }
    if (!date || !startTime || !endTime) {
      return NextResponse.json({ error: 'date, startTime, and endTime are required' }, { status: 400 });
    }

    // Validate time format HH:mm
    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return NextResponse.json({ error: 'Invalid time format. Use HH:mm.' }, { status: 400 });
    }

    const durationMinutes = computeDuration(startTime, endTime);
    const isMidnightCrossing = startTime > endTime;
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    await connectDB();

    // Check for overlapping entries (warn, don't block)
    const hasOverlap = await checkOverlap(workTypeId, entryDate, startTime, endTime);

    const entry = await Entry.create({
      workTypeId,
      date: entryDate,
      startTime,
      endTime,
      durationMinutes,
      note: note?.trim() || null,
    });

    return NextResponse.json({
      ...entry.toObject(),
      _id: entry._id.toString(),
      workTypeId: entry.workTypeId.toString(),
      date: entry.date.toISOString(),
      hasOverlap,
      isMidnightCrossing,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/entries error:', error);
    return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
  }
}
