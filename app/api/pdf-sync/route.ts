import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'temp_pdf');

// Преподаватель загружает файл сюда
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `sync_${Date.now()}.pdf`;

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

    return NextResponse.json({ success: true, url: `/api/pdf-sync?file=${filename}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Ученики скачивают файл отсюда напрямую
export async function GET(req: NextRequest) {
  const filename = req.nextUrl.searchParams.get('file');
  if (!filename) return new NextResponse('Missing file parameter', { status: 400 });

  try {
    const filePath = path.join(UPLOAD_DIR, filename);
    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error: any) {
    return new NextResponse('File not found', { status: 404 });
  }
}
