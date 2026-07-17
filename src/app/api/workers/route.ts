import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import Worker from '@/lib/db/models/Worker';
import WorkType from '@/lib/db/models/WorkType';
import Entry from '@/lib/db/models/Entry';

// GET /api/workers - List all workers with total hours
export async function GET() {
  try {
    await connectDB();
    const workers = await Worker.find().sort({ createdAt: 1 }).lean();

    // Aggregate total hours per worker
    const workersWithHours = await Promise.all(
      workers.map(async (worker) => {
        const workTypes = await WorkType.find({ workerId: worker._id }).lean();
        const workTypeIds = workTypes.map((wt) => wt._id);
        const entries = await Entry.find({ workTypeId: { $in: workTypeIds } }).lean();
        const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

        return {
          ...worker,
          _id: worker._id.toString(),
          totalMinutes,
          totalHours: Math.floor(totalMinutes / 60),
          totalMins: totalMinutes % 60,
        };
      })
    );

    return NextResponse.json(workersWithHours);
  } catch (error) {
    console.error('GET /api/workers error:', error);
    return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 });
  }
}

// POST /api/workers - Create a new worker
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
    }

    await connectDB();
    const worker = await Worker.create({ name: name.trim() });

    return NextResponse.json({
      ...worker.toObject(),
      _id: worker._id.toString(),
      totalMinutes: 0,
      totalHours: 0,
      totalMins: 0,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/workers error:', error);
    return NextResponse.json({ error: 'Failed to create worker' }, { status: 500 });
  }
}
