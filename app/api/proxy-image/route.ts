import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url parameter', { status: 400 });

  // Перенаправляем запрос во внутреннюю сеть сервера (напрямую в VOD)
  const targetUrl = url.replace(/^https?:\/\/[^\/]+/, 'http://127.0.0.1:5000');

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error('Bad response');
    
    const arrayBuffer = await response.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400', // Кэшируем для мгновенной загрузки
        'Access-Control-Allow-Origin': '*' // Разрешаем доступ всем
      },
    });
  } catch (error: any) {
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
