import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    // Отправляем файл напрямую в локальный Python VOD-сервер
    const response = await fetch('http://127.0.0.1:5000/upload_chunk', {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('VOD upload failed');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
