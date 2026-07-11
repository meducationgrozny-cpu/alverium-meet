import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // Сервер Next.js отправляет файл, обходя браузерные ограничения CORS
    const response = await fetch('https://video.alverium.ru/api/convert_pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
        throw new Error(`Ошибка VOD-сервера: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });

  } catch (error: any) {
    console.error("Ошибка проксирования PDF:", error);
    return NextResponse.json(
        { status: 'error', message: error.message || "Внутренняя ошибка сервера" }, 
        { status: 500 }
    );
  }
}
