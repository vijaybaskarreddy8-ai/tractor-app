import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import Entry from '@/lib/db/models/Entry';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: compute duration in minutes handling midnight crossing
function computeDuration(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  let startTotal = startH * 60 + startM;
  let endTotal = endH * 60 + endM;

  if (endTotal <= startTotal) {
    endTotal += 24 * 60;
  }

  return endTotal - startTotal;
}

// GET /api/entries/[id]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await connectDB();
    const entry = await Entry.findById(id).lean();

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...entry,
      _id: entry._id.toString(),
      workTypeId: entry.workTypeId.toString(),
      date: entry.date.toISOString(),
    });
  } catch (error) {
    console.error('GET /api/entries/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch entry' }, { status: 500 });
  }
}

// PUT /api/entries/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { date, startTime, endTime, note } = await request.json();

    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (date !== undefined) {
      const entryDate = new Date(date);
      entryDate.setHours(0, 0, 0, 0);
      update.date = entryDate;
    }
    if (startTime !== undefined) update.startTime = startTime;
    if (endTime !== undefined) update.endTime = endTime;
    if (note !== undefined) update.note = note?.trim() || null;

    // Recompute duration if times changed
    if (startTime !== undefined || endTime !== undefined) {
      await connectDB();
      const existing = await Entry.findById(id).lean();
      if (!existing) {
        return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
      }
      const finalStart = startTime || existing.startTime;
      const finalEnd = endTime || existing.endTime;
      update.durationMinutes = computeDuration(finalStart, finalEnd);
    }

    await connectDB();
    const entry = await Entry.findByIdAndUpdate(id, update, { new: true }).lean();

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...entry,
      _id: entry._id.toString(),
      workTypeId: entry.workTypeId.toString(),
      date: entry.date.toISOString(),
    });
  } catch (error) {
    console.error('PUT /api/entries/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}

// DELETE /api/entries/[id]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await connectDB();
    const entry = await Entry.findByIdAndDelete(id);

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/entries/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
  }
}
