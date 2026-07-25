import { RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://meet.alverium.ru';
  
  // Клиенту RoomServiceClient нужен HTTP/HTTPS, а не WSS
  const httpUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');

  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "Ключи не настроены" }, { status: 500 });
  }

  try {
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const rooms = await roomService.listRooms();
    
    const activeRooms = rooms.map(r => ({
      sid: r.sid,
      name: r.name,
      creationTime: Number(r.creationTime) * 1000,
      participants: r.numParticipants,
      isRecording: r.activeRecording,
    }));

    return NextResponse.json({ rooms: activeRooms });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
