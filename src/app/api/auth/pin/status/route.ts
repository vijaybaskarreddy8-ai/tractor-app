import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectDB } from '@/lib/db/mongoose';
import User from '@/lib/db/models/User';

export async function GET() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized. Please sign in with Google first.' },
      { status: 401 }
    );
  }

  await connectDB();
  const user = await User.findOne({ email: session.user.email }).lean();

  return NextResponse.json({
    hasPin: !!user?.pinHash,
  });
}
