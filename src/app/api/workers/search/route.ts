import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db/mongoose';
import Worker from '@/lib/db/models/Worker';
import WorkType from '@/lib/db/models/WorkType';

// GET /api/workers/search?q=... - Search workers by name and work types by name
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q');

    if (!q || q.trim().length === 0) {
      return NextResponse.json([]);
    }

    await connectDB();
    const searchRegex = new RegExp(q.trim(), 'i');

    // Search workers by name
    const workersByName = await Worker.find({ name: searchRegex }).lean();

    // Search work types by name and get their workers
    const matchingWorkTypes = await WorkType.find({ name: searchRegex }).lean();
    const workerIdsFromWorkTypes = matchingWorkTypes.map((wt) => wt.workerId.toString());

    // Get workers found via work type match (that aren't already in name results)
    const workerNameIds = new Set(workersByName.map((w) => w._id.toString()));
    const additionalWorkerIds = workerIdsFromWorkTypes.filter((id) => !workerNameIds.has(id));
    const additionalWorkers = additionalWorkerIds.length > 0
      ? await Worker.find({ _id: { $in: additionalWorkerIds } }).lean()
      : [];

    // Combine results with match source info
    const results = [
      ...workersByName.map((w) => ({
        ...w,
        _id: w._id.toString(),
        matchType: 'worker' as const,
        matchedWorkTypes: matchingWorkTypes
          .filter((wt) => wt.workerId.toString() === w._id.toString())
          .map((wt) => ({ _id: wt._id.toString(), name: wt.name })),
      })),
      ...additionalWorkers.map((w) => ({
        ...w,
        _id: w._id.toString(),
        matchType: 'workType' as const,
        matchedWorkTypes: matchingWorkTypes
          .filter((wt) => wt.workerId.toString() === w._id.toString())
          .map((wt) => ({ _id: wt._id.toString(), name: wt.name })),
      })),
    ];

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET /api/workers/search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
