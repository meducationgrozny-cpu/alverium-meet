import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { roomName, participantName, role } = await req.json();
    
    // Берем ключи из переменных окружения
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "Ключи LiveKit не найдены на сервере" }, { status: 500 });
    }

    // Создаем токен
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: participantName,
    });

    // Настраиваем права в зависимости от роли
    const isHost = role === 'host';
    const isBot = role === 'bot';

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: !isBot,
      canSubscribe: true,
      roomAdmin: isHost, // Дает права управлять доской и кнопкой записи
      hidden: isBot,
      recorder: isBot,
    });

    const token = await at.toJwt();
    return NextResponse.json({ token, roomUrl: `/room/${roomName}?token=${token}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
