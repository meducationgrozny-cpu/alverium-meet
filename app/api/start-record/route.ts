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
    
    // Генерируем красивое название файла: Урок-ДД-ММ-ГГГГ_ЧЧ-ММ
    const now = new Date();
    const dateStr = now.toLocaleDateString('ru-RU').replace(/\./g, '-');
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }).replace(/:/g, '-');
    const niceName = `Урок-${dateStr}_${timeStr}`;

    const info = await egressClient.startRoomCompositeEgress(
      body.roomName, 
      {
        file: { filepath: `/out/${niceName}.mp4` }
      } as any,
      {
        customBaseUrl: `https://meet.alverium.ru/room/${body.roomName}`
      } as any
    );
    return NextResponse.json({ success: true, egressId: info.egressId });
  } catch (err: any) {
    console.error("🔥 ОШИБКА ЗАПУСКА EGRESS:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
