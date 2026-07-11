import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    const response = await fetch('https://video.alverium.ru/api/convert_pdf', {
      method: 'POST',
      body: formData,
    });

    const text = await response.text();
    let data;
    try { 
      data = JSON.parse(text); 
    } catch (e) { 
      throw new Error(`VOD-сервер вернул не JSON! Статус: ${response.status}. Тело: ${text.substring(0, 100)}...`); 
    }

    return NextResponse.json(data, { status: response.ok ? 200 : response.status });

  } catch (error: any) {
    console.error("Ошибка проксирования PDF:", error);
    return NextResponse.json(
        { status: 'error', message: error.message || "Внутренняя ошибка Next.js" }, 
        { status: 500 }
    );
  }
}
