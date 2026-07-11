import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    
    // Сервер Next.js сам стучится к Flask, обходя браузерные ограничения CORS
    const response = await fetch('https://video.alverium.ru/api/convert_pdf', {
      method: 'POST',
      body: formData,
      // ВАЖНО: Если на VOD-сервере стоит базовая авторизация (Nginx auth_basic), 
      // раскомментируй строки ниже и впиши логин/пароль
      // headers: {
      //   'Authorization': 'Basic ' + Buffer.from('твой_логин:твой_пароль').toString('base64')
      // }
    });

    if (!response.ok) {
        throw new Error(`Ошибка VOD-сервера: ${response.statusText}`);
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
