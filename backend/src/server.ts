import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDB } from './db.js';
import User from './models/User.js';
import Worker from './models/Worker.js';
import WorkType from './models/WorkType.js';
import Entry from './models/Entry.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// API Key authentication middleware
const authenticateAPI = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.BACKEND_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
  }
  next();
};

// Apply API Key verification to all /api routes
app.use('/api', authenticateAPI);

// Database connection health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    await connectDB();
    res.json({ status: 'ok', database: 'connected' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Helper: check for overlapping entries
async function checkOverlap(
  workTypeId: string,
  date: Date,
  startTime: string,
  endTime: string,
  excludeId?: string
): Promise<boolean> {
  const entries = (await Entry.find({
    workTypeId,
    date,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean()) as any[];

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

    if (newStart < eEnd && newEnd > eStart) {
      return true;
    }
  }

  return false;
}

// Helper: compute duration in minutes
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

/* ==========================================================================
   WORKERS ROUTES
   ========================================================================== */

// GET /api/workers - List workers with total hours
app.get('/api/workers', async (req: Request, res: Response) => {
  try {
    await connectDB();
    const workers = (await Worker.find().sort({ createdAt: 1 }).lean()) as any[];

    const workersWithHours = await Promise.all(
      workers.map(async (worker) => {
        const workTypes = (await WorkType.find({ workerId: worker._id }).lean()) as any[];
        const workTypeIds = workTypes.map((wt) => wt._id);
        const entries = (await Entry.find({ workTypeId: { $in: workTypeIds } }).lean()) as any[];
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

    res.json(workersWithHours);
  } catch (error) {
    console.error('GET /api/workers error:', error);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// POST /api/workers - Create new worker
app.post('/api/workers', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Worker name is required' });
    }

    await connectDB();
    const worker = await Worker.create({ name: name.trim() });

    res.status(201).json({
      ...worker.toObject(),
      _id: worker._id.toString(),
      totalMinutes: 0,
      totalHours: 0,
      totalMins: 0,
    });
  } catch (error) {
    console.error('POST /api/workers error:', error);
    res.status(500).json({ error: 'Failed to create worker' });
  }
});

// GET /api/workers/search - Search workers
app.get('/api/workers/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.json([]);
    }

    await connectDB();
    const searchRegex = new RegExp(q.trim(), 'i');

    const workersByName = (await Worker.find({ name: searchRegex }).lean()) as any[];
    const matchingWorkTypes = (await WorkType.find({ name: searchRegex }).lean()) as any[];
    const workerIdsFromWorkTypes = matchingWorkTypes.map((wt) => wt.workerId.toString());

    const workerNameIds = new Set(workersByName.map((w) => w._id.toString()));
    const additionalWorkerIds = workerIdsFromWorkTypes.filter((id) => !workerNameIds.has(id));
    const additionalWorkers = (additionalWorkerIds.length > 0
      ? await Worker.find({ _id: { $in: additionalWorkerIds } }).lean()
      : []) as any[];

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

    res.json(results);
  } catch (error) {
    console.error('GET /api/workers/search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/workers/:id - Get single worker
app.get('/api/workers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await connectDB();
    const worker = (await Worker.findById(id).lean()) as any;

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    res.json({ ...worker, _id: worker._id.toString() });
  } catch (error) {
    console.error('GET /api/workers/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch worker' });
  }
});

// PUT /api/workers/:id - Update worker name
app.put('/api/workers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Worker name is required' });
    }

    await connectDB();
    const worker = (await Worker.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    ).lean()) as any;

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    res.json({ ...worker, _id: worker._id.toString() });
  } catch (error) {
    console.error('PUT /api/workers/:id error:', error);
    res.status(500).json({ error: 'Failed to update worker' });
  }
});

// DELETE /api/workers/:id - Delete worker (cascade)
app.delete('/api/workers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await connectDB();

    const workTypes = (await WorkType.find({ workerId: id }).lean()) as any[];
    const workTypeIds = workTypes.map((wt) => wt._id);

    await Entry.deleteMany({ workTypeId: { $in: workTypeIds } });
    await WorkType.deleteMany({ workerId: id });
    const worker = await Worker.findByIdAndDelete(id);

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/workers/:id error:', error);
    res.status(500).json({ error: 'Failed to delete worker' });
  }
});

/* ==========================================================================
   WORK TYPES ROUTES
   ========================================================================== */

// GET /api/work-types - List work types for a worker
app.get('/api/work-types', async (req: Request, res: Response) => {
  try {
    const { workerId } = req.query;
    if (!workerId || typeof workerId !== 'string') {
      return res.status(400).json({ error: 'workerId query parameter is required' });
    }

    await connectDB();
    const workTypes = (await WorkType.find({ workerId }).sort({ createdAt: 1 }).lean()) as any[];

    const workTypesWithHours = await Promise.all(
      workTypes.map(async (wt) => {
        const entries = (await Entry.find({ workTypeId: wt._id }).lean()) as any[];
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

    res.json(workTypesWithHours);
  } catch (error) {
    console.error('GET /api/work-types error:', error);
    res.status(500).json({ error: 'Failed to fetch work types' });
  }
});

// POST /api/work-types - Create new work type
app.post('/api/work-types', async (req: Request, res: Response) => {
  try {
    const { workerId, name, hourlyRate } = req.body;
    if (!workerId) {
      return res.status(400).json({ error: 'workerId is required' });
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Work type name is required' });
    }

    await connectDB();
    const workType = await WorkType.create({
      workerId,
      name: name.trim(),
      hourlyRate: hourlyRate != null && hourlyRate !== '' ? Number(hourlyRate) : null,
    });

    res.status(201).json({
      ...workType.toObject(),
      _id: workType._id.toString(),
      workerId: workType.workerId.toString(),
      totalMinutes: 0,
      totalHours: 0,
      totalMins: 0,
    });
  } catch (error) {
    console.error('POST /api/work-types error:', error);
    res.status(500).json({ error: 'Failed to create work type' });
  }
});

// GET /api/work-types/:id - Get single work type details
app.get('/api/work-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await connectDB();
    const workType = (await WorkType.findById(id).lean()) as any;

    if (!workType) {
      return res.status(404).json({ error: 'Work type not found' });
    }

    const entries = (await Entry.find({ workTypeId: id }).lean()) as any[];
    const totalMinutes = entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);

    res.json({
      ...workType,
      _id: workType._id.toString(),
      workerId: workType.workerId.toString(),
      totalMinutes,
      totalHours: Math.floor(totalMinutes / 60),
      totalMins: totalMinutes % 60,
    });
  } catch (error) {
    console.error('GET /api/work-types/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch work type' });
  }
});

// PUT /api/work-types/:id - Update work type
app.put('/api/work-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, hourlyRate } = req.body;

    const update: Record<string, unknown> = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Work type name is required' });
      }
      update.name = name.trim();
    }
    if (hourlyRate !== undefined) {
      update.hourlyRate = hourlyRate != null && hourlyRate !== '' ? Number(hourlyRate) : null;
    }

    await connectDB();
    const workType = (await WorkType.findByIdAndUpdate(id, update, { new: true }).lean()) as any;

    if (!workType) {
      return res.status(404).json({ error: 'Work type not found' });
    }

    res.json({
      ...workType,
      _id: workType._id.toString(),
      workerId: workType.workerId.toString(),
    });
  } catch (error) {
    console.error('PUT /api/work-types/:id error:', error);
    res.status(500).json({ error: 'Failed to update work type' });
  }
});

// DELETE /api/work-types/:id - Delete work type (cascade)
app.delete('/api/work-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await connectDB();

    await Entry.deleteMany({ workTypeId: id });
    const workType = await WorkType.findByIdAndDelete(id);

    if (!workType) {
      return res.status(404).json({ error: 'Work type not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/work-types/:id error:', error);
    res.status(500).json({ error: 'Failed to delete work type' });
  }
});

/* ==========================================================================
   ENTRIES ROUTES
   ========================================================================== */

// GET /api/entries - Get entries for workTypeId
app.get('/api/entries', async (req: Request, res: Response) => {
  try {
    const { workTypeId } = req.query;
    if (!workTypeId || typeof workTypeId !== 'string') {
      return res.status(400).json({ error: 'workTypeId query parameter is required' });
    }

    await connectDB();
    const entries = (await Entry.find({ workTypeId })
      .sort({ date: 1, startTime: 1 })
      .lean()) as any[];

    const formatted = entries.map((e) => ({
      ...e,
      _id: e._id.toString(),
      workTypeId: e.workTypeId.toString(),
      date: e.date.toISOString(),
    }));

    res.json(formatted);
  } catch (error) {
    console.error('GET /api/entries error:', error);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
});

// POST /api/entries - Create new entry
app.post('/api/entries', async (req: Request, res: Response) => {
  try {
    const { workTypeId, date, startTime, endTime, note } = req.body;
    if (!workTypeId) {
      return res.status(400).json({ error: 'workTypeId is required' });
    }
    if (!date || !startTime || !endTime) {
      return res.status(400).json({ error: 'date, startTime, and endTime are required' });
    }

    const timeRegex = /^([01]?\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:mm.' });
    }

    const durationMinutes = computeDuration(startTime, endTime);
    const isMidnightCrossing = startTime > endTime;
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    await connectDB();

    const hasOverlap = await checkOverlap(workTypeId, entryDate, startTime, endTime);

    const entry = await Entry.create({
      workTypeId,
      date: entryDate,
      startTime,
      endTime,
      durationMinutes,
      note: note?.trim() || null,
    });

    res.status(201).json({
      ...entry.toObject(),
      _id: entry._id.toString(),
      workTypeId: entry.workTypeId.toString(),
      date: entry.date.toISOString(),
      hasOverlap,
      isMidnightCrossing,
    });
  } catch (error) {
    console.error('POST /api/entries error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// GET /api/entries/:id - Get single entry
app.get('/api/entries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await connectDB();
    const entry = (await Entry.findById(id).lean()) as any;

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({
      ...entry,
      _id: entry._id.toString(),
      workTypeId: entry.workTypeId.toString(),
      date: entry.date.toISOString(),
    });
  } catch (error) {
    console.error('GET /api/entries/:id error:', error);
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
});

// PUT /api/entries/:id - Update entry
app.put('/api/entries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date, startTime, endTime, note } = req.body;

    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (date !== undefined) {
      const entryDate = new Date(date);
      entryDate.setHours(0, 0, 0, 0);
      update.date = entryDate;
    }
    if (startTime !== undefined) update.startTime = startTime;
    if (endTime !== undefined) update.endTime = endTime;
    if (note !== undefined) update.note = note?.trim() || null;

    if (startTime !== undefined || endTime !== undefined) {
      await connectDB();
      const existing = (await Entry.findById(id).lean()) as any;
      if (!existing) {
        return res.status(404).json({ error: 'Entry not found' });
      }
      const finalStart = startTime || existing.startTime;
      const finalEnd = endTime || existing.endTime;
      update.durationMinutes = computeDuration(finalStart, finalEnd);
    }

    await connectDB();
    const entry = (await Entry.findByIdAndUpdate(id, update, { new: true }).lean()) as any;

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({
      ...entry,
      _id: entry._id.toString(),
      workTypeId: entry.workTypeId.toString(),
      date: entry.date.toISOString(),
    });
  } catch (error) {
    console.error('PUT /api/entries/:id error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// DELETE /api/entries/:id - Delete entry
app.delete('/api/entries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await connectDB();
    const entry = (await Entry.findByIdAndDelete(id)) as any;

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/entries/:id error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

/* ==========================================================================
   AUTH / PIN SECURE FLOWS
   ========================================================================== */

// GET /api/auth/pin/status - Checks pin status
app.get('/api/auth/pin/status', async (req: Request, res: Response) => {
  try {
    const email = req.headers['x-user-email'];
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'X-User-Email header is required' });
    }

    await connectDB();
    const user = (await User.findOne({ email }).lean()) as any;

    res.json({
      hasPin: !!user?.pinHash,
    });
  } catch (error: any) {
    console.error('GET /api/auth/pin/status error:', error);
    res.status(500).json({ error: error.message || 'Failed to check PIN status' });
  }
});

// POST /api/auth/pin/setup - Sets up a pin
app.post('/api/auth/pin/setup', async (req: Request, res: Response) => {
  try {
    const email = req.headers['x-user-email'];
    const { pin } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'X-User-Email header is required' });
    }
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    const pinHash = await bcrypt.hash(pin, 10);

    await connectDB();
    await User.findOneAndUpdate(
      { email },
      { email, pinHash },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('POST /api/auth/pin/setup error:', error);
    res.status(500).json({ error: error.message || 'Failed to set up PIN' });
  }
});

// POST /api/auth/pin/verify - Verifies a pin
app.post('/api/auth/pin/verify', async (req: Request, res: Response) => {
  try {
    const email = req.headers['x-user-email'];
    const { pin } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'X-User-Email header is required' });
    }
    if (!pin) {
      return res.status(400).json({ error: 'PIN is required' });
    }

    await connectDB();
    const user = (await User.findOne({ email }).lean()) as any;

    if (!user?.pinHash) {
      return res.status(404).json({ error: 'No PIN set up' });
    }

    const isValid = await bcrypt.compare(pin, user.pinHash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Incorrect PIN' });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('POST /api/auth/pin/verify error:', error);
    res.status(500).json({ error: error.message || 'Verification failed' });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Tractor backend running on port ${PORT}`);
});
