import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import WorkType from '@/lib/db/models/WorkType';
import Entry from '@/lib/db/models/Entry';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/work-types/[id]
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await connectDB();
    const workType = await WorkType.findById(id).lean();

    if (!workType) {
      return NextResponse.json({ error: 'Work type not found' }, { status: 404 });
    }

    const entries = await Entry.find({ workTypeId: id }).lean();
    const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

    return NextResponse.json({
      ...workType,
      _id: workType._id.toString(),
      workerId: workType.workerId.toString(),
      totalMinutes,
      totalHours: Math.floor(totalMinutes / 60),
      totalMins: totalMinutes % 60,
    });
  } catch (error) {
    console.error('GET /api/work-types/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch work type' }, { status: 500 });
  }
}

// PUT /api/work-types/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { name, hourlyRate } = await request.json();

    const update: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Work type name is required' }, { status: 400 });
      }
      update.name = name.trim();
    }
    if (hourlyRate !== undefined) {
      update.hourlyRate = hourlyRate != null && hourlyRate !== '' ? Number(hourlyRate) : null;
    }

    await connectDB();
    const workType = await WorkType.findByIdAndUpdate(id, update, { new: true }).lean();

    if (!workType) {
      return NextResponse.json({ error: 'Work type not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...workType,
      _id: workType._id.toString(),
      workerId: workType.workerId.toString(),
    });
  } catch (error) {
    console.error('PUT /api/work-types/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update work type' }, { status: 500 });
  }
}

// DELETE /api/work-types/[id] - Delete work type + cascade entries
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await connectDB();

    await Entry.deleteMany({ workTypeId: id });
    const workType = await WorkType.findByIdAndDelete(id);

    if (!workType) {
      return NextResponse.json({ error: 'Work type not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/work-types/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete work type' }, { status: 500 });
  }
}
