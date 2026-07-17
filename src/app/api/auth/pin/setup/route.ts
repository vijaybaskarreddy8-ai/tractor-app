import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '@/auth';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in with Google first.' },
      { status: 401 }
    );
  }

  let body: { pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body.' },
      { status: 400 }
    );
  }

  const { pin } = body;

  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json(
      { error: 'PIN must be 4-6 digits.' },
      { status: 400 }
    );
  }

  const pinHash = await bcrypt.hash(pin, 10);

  await connectDB();

  await User.findOneAndUpdate(
    { email: session.user.email },
    { email: session.user.email, pinHash },
    { upsert: true, new: true }
  );

  return NextResponse.json({ success: true });
}
