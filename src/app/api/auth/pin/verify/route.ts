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

  if (!pin) {
    return NextResponse.json(
      { error: 'PIN is required.' },
      { status: 400 }
    );
  }

  await connectDB();

  const user = await User.findOne({ email: session.user.email });

  if (!user?.pinHash) {
    return NextResponse.json(
      { error: 'No PIN has been set up. Please set up a PIN first.' },
      { status: 404 }
    );
  }

  const isValid = await bcrypt.compare(pin, user.pinHash);

  if (!isValid) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set('pin_verified', 'true', {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });

  return response;
}
