import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Отправляем файл на нарезку в локальный VOD
    const response = await fetch('http://127.0.0.1:5000/api/convert_pdf', {
      method: 'POST',
      body: formData,
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`VOD-сервер вернул не JSON! Статус: ${response.status}`);
    }

    // РЕКУРСИВНАЯ МАГИЯ: Ищем все ссылки от VOD и пропускаем их через наш новый прокси
    const rewriteUrls = (obj: any) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string' && (obj[key].startsWith('http://') || obj[key].startsWith('https://'))) {
          // Заменяем оригинальную ссылку на нашу внутреннюю
          obj[key] = `/api/proxy-image?url=${encodeURIComponent(obj[key])}`;
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          rewriteUrls(obj[key]);
        }
      }
    };
    
    rewriteUrls(data);

    return NextResponse.json(data, { status: response.ok ? 200 : response.status });

  } catch (error: any) {
    console.error("Ошибка проксирования PDF:", error);
    return NextResponse.json(
        { status: 'error', message: error.message || "Внутренняя ошибка Next.js" },
        { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) return new NextResponse('Missing url parameter', { status: 400 });

  // Перенаправляем запрос во внутреннюю сеть (напрямую в VOD)
  const targetUrl = url.replace(/^https?:\/\/[^\/]+/, 'http://127.0.0.1:5000');

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error('Bad response');
    
    const arrayBuffer = await response.arrayBuffer();
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Access-Control-Allow-Origin': '*' // Разрешаем доступ всем устройствам
      },
    });
  } catch (error: any) {
    return new NextResponse('Error fetching PDF', { status: 500 });
  }
}
