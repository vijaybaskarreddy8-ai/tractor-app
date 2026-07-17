import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import WorkType from '@/lib/db/models/WorkType';
import Entry from '@/lib/db/models/Entry';

// GET /api/work-types?workerId=... - List work types for a worker
export async function GET(request: NextRequest) {
  try {
    const workerId = request.nextUrl.searchParams.get('workerId');

    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
    }

    await connectDB();
    const workTypes = await WorkType.find({ workerId }).sort({ createdAt: 1 }).lean();

    // Aggregate total hours per work type
    const workTypesWithHours = await Promise.all(
      workTypes.map(async (wt) => {
        const entries = await Entry.find({ workTypeId: wt._id }).lean();
        const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

        return {
          ...wt,
          _id: wt._id.toString(),
          workerId: wt.workerId.toString(),
          totalMinutes,
          totalHours: Math.floor(totalMinutes / 60),
          totalMins: totalMinutes % 60,
        };
      })
    );

    return NextResponse.json(workTypesWithHours);
  } catch (error) {
    console.error('GET /api/work-types error:', error);
    return NextResponse.json({ error: 'Failed to fetch work types' }, { status: 500 });
  }
}

// POST /api/work-types - Create a new work type
export async function POST(request: NextRequest) {
  try {
    const { workerId, name, hourlyRate } = await request.json();

    if (!workerId) {
      return NextResponse.json({ error: 'workerId is required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Work type name is required' }, { status: 400 });
    }

    await connectDB();
    const workType = await WorkType.create({
      workerId,
      name: name.trim(),
      hourlyRate: hourlyRate != null && hourlyRate !== '' ? Number(hourlyRate) : null,
    });

    return NextResponse.json({
      ...workType.toObject(),
      _id: workType._id.toString(),
      workerId: workType.workerId.toString(),
      totalMinutes: 0,
      totalHours: 0,
      totalMins: 0,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/work-types error:', error);
    return NextResponse.json({ error: 'Failed to create work type' }, { status: 500 });
  }
}
