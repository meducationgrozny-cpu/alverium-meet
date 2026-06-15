import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = 'alverium_live_key';
  const apiSecret = 'AlveriumSuperSecretKey2026';
  const roomName = 'main-room';
  const participantName = `user-${Math.floor(Math.random() * 10000)}`;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
  });

  at.addGrant({ roomJoin: true, room: roomName });

  return NextResponse.json({ token: await at.toJwt() });
}