import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import Worker from '@/lib/db/models/Worker';
import WorkType from '@/lib/db/models/WorkType';
import Entry from '@/lib/db/models/Entry';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/workers/[id] - Get single worker
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await connectDB();
    const worker = await Worker.findById(id).lean();

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    return NextResponse.json({ ...worker, _id: worker._id.toString() });
  } catch (error) {
    console.error('GET /api/workers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch worker' }, { status: 500 });
  }
}

// PUT /api/workers/[id] - Update worker name
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Worker name is required' }, { status: 400 });
    }

    await connectDB();
    const worker = await Worker.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    ).lean();

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    return NextResponse.json({ ...worker, _id: worker._id.toString() });
  } catch (error) {
    console.error('PUT /api/workers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update worker' }, { status: 500 });
  }
}

// DELETE /api/workers/[id] - Delete worker + cascade
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    await connectDB();

    // Cascade delete: entries → work types → worker
    const workTypes = await WorkType.find({ workerId: id }).lean();
    const workTypeIds = workTypes.map((wt) => wt._id);

    await Entry.deleteMany({ workTypeId: { $in: workTypeIds } });
    await WorkType.deleteMany({ workerId: id });
    const worker = await Worker.findByIdAndDelete(id);

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/workers/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete worker' }, { status: 500 });
  }
}
