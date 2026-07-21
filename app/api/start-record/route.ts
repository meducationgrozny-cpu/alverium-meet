import { NextResponse } from 'next/server';
import { EgressClient } from 'livekit-server-sdk';

const egressClient = new EgressClient(
  'http://127.0.0.1:7880',
  'alverium_live_key',
  'AlveriumSuperSecretKey2026'
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const info = await egressClient.startRoomCompositeEgress(
      body.roomName, 
      {
        file: { filepath: `/out/${body.roomName}-${Date.now()}.mp4` }
      } as any
    );
    return NextResponse.json({ success: true, egressId: info.egressId });
  } catch (err: any) {
    console.error("🔥 ОШИБКА ЗАПУСКА EGRESS:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
