"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Используем самый стабильный CDN для воркера (Cloudflare) с обязательным .mjs
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

interface Point { x: number; y: number; }
interface Line { points: Point[]; color: string; width: number; }

export default function AlveriumWhiteboard({ isHost }: { isHost: boolean }) {
  const room = useRoomContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const VIRTUAL_W = 1920;
  const VIRTUAL_H = 1080;
  const ROOM_KEY = `alverium_wb_${room.name}`;

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renderTrigger, setRenderTrigger] = useState(0);

  const linesMap = useRef<Record<number, Line[]>>({});
  const currentLine = useRef<Line | null>(null);

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const pdfBytesRef = useRef<ArrayBuffer | null>(null);

  // Восстановление рисунков после обновления страницы
  useEffect(() => {
    const saved = localStorage.getItem(ROOM_KEY);
    if (saved) {
      try { linesMap.current = JSON.parse(saved); } catch(e) {}
    }
  }, [ROOM_KEY]);

  const saveToLocal = () => {
    localStorage.setItem(ROOM_KEY, JSON.stringify(linesMap.current));
  };

  // Защита от случайного закрытия вкладки
  useEffect(() => {
    const handleUnload = (e: BeforeUnloadEvent) => {
      if (isHost && (totalPages > 1 || Object.keys(linesMap.current).length > 0)) {
        e.preventDefault();
        e.returnValue = 'У вас есть несохраненные изменения. Точно хотите выйти?';
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [isHost, totalPages]);

  useEffect(() => {
    const handleData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'WB_DRAW') {
          if (!linesMap.current[msg.page]) linesMap.current[msg.page] = [];
          linesMap.current[msg.page].push(msg.line);
          saveToLocal();
          if (msg.page === currentPage) drawAllLines(msg.page);
        } else if (msg.type === 'WB_PAGE') {
          setCurrentPage(msg.page);
        } else if (msg.type === 'WB_CLEAR') {
          linesMap.current[msg.page] = [];
          saveToLocal();
          if (msg.page === currentPage) drawAllLines(msg.page);
        }
      } catch (e) {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, currentPage]);

  useEffect(() => {
    if (pdfDocRef.current) renderPdfPage(currentPage);
    drawAllLines(currentPage);
  }, [currentPage, renderTrigger]); 

  const renderPdfPage = async (pageNum: number) => {
    if (!pdfDocRef.current || !bgCanvasRef.current) return;
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      
      const canvas = bgCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);

      const renderContext: any = { canvasContext: ctx, viewport: viewport };
      await page.render(renderContext).promise;
    } catch (err) {
      console.error("Ошибка рендера страницы:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isHost) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfBytesRef.current = arrayBuffer;
        
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        
        setRenderTrigger(prev => prev + 1);
        broadcast({ type: 'WB_PAGE', page: 1 });
    } catch (err) {
        alert("Сбросьте кэш браузера (Ctrl+F5). Ошибка: " + err);
    }
  };

  const getCoords = (e: React.PointerEvent) => {
    if (!drawCanvasRef.current) return { x: 0, y: 0 };
    const rect = drawCanvasRef.current.getBoundingClientRect();
    const scaleX = VIRTUAL_W / rect.width;
    const scaleY = VIRTUAL_H / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isHost) return;
    setIsDrawing(true);
    const coords = getCoords(e);
    currentLine.current = { points: [coords], color: '#ef4444', width: 4 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentLine.current || !isHost) return;
    currentLine.current.points.push(getCoords(e));
    drawAllLines(currentPage, currentLine.current);
  };

  const onPointerUp = () => {
    if (!isDrawing || !currentLine.current || !isHost) return;
    setIsDrawing(false);
    
    if (!linesMap.current[currentPage]) linesMap.current[currentPage] = [];
    linesMap.current[currentPage].push(currentLine.current);
    saveToLocal();
    
    broadcast({ type: 'WB_DRAW', page: currentPage, line: currentLine.current });
    currentLine.current = null;
  };

  const drawAllLines = (page: number, activeLine?: Line) => {
    const ctx = drawCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, VIRTUAL_W, VIRTUAL_H);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const lines = linesMap.current[page] || [];
    const allLines = activeLine ? [...lines, activeLine] : lines;

    allLines.forEach(line => {
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;
      line.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  };

  const broadcast = (msg: any) => {
    room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(msg)), { reliable: true });
  };

  const clearPage = () => {
    linesMap.current[currentPage] = [];
    saveToLocal();
    drawAllLines(currentPage);
    broadcast({ type: 'WB_CLEAR', page: currentPage });
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!isHost) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
             const reader = new FileReader();
             reader.onload = (ev) => {
               const img = new Image();
               img.onload = () => {
                 const ctx = bgCanvasRef.current?.getContext('2d');
                 if (ctx) {
                   ctx.fillStyle = '#ffffff';
                   ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
                   ctx.drawImage(img, 0, 0, VIRTUAL_W, VIRTUAL_H);
                 }
               };
               img.src = ev.target?.result as string;
             };
             reader.readAsDataURL(file);
          }
        }
      }
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isHost]);

  const saveAndUploadNotes = async () => {
    if (!pdfBytesRef.current) {
      alert("Сначала загрузите PDF презентацию!");
      return;
    }
    
    setUploadProgress(1);
    try {
      const pdfDoc = await PDFDocument.load(pdfBytesRef.current);
      
      for (let i = 0; i < totalPages; i++) {
        const pageNum = i + 1;
        if (linesMap.current[pageNum] && linesMap.current[pageNum].length > 0) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = VIRTUAL_W;
          tempCanvas.height = VIRTUAL_H;
          const ctx = tempCanvas.getContext('2d')!;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          
          linesMap.current[pageNum].forEach(line => {
            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.width;
            line.points.forEach((p, idx) => {
              if (idx === 0) ctx.moveTo(p.x, p.y);
              else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
          });

          const pngImageBytes = await fetch(tempCanvas.toDataURL()).then(res => res.arrayBuffer());
          const pngImage = await pdfDoc.embedPng(pngImageBytes);
          const pdfPage = pdfDoc.getPage(i);
          const { width, height } = pdfPage.getSize();
          
          pdfPage.drawImage(pngImage, {
            x: 0, y: 0, width: width, height: height, opacity: 1
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      
      uploadChunked(blob);

    } catch (err) {
      console.error(err);
      alert("Ошибка при сохранении PDF");
      setUploadProgress(0);
    }
  };

  const uploadChunked = async (blob: Blob) => {
    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Alverium_Notes_${dateStr}.pdf`;

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, blob.size);
      const fd = new FormData();
      fd.append('file', blob.slice(start, end));
      fd.append('filename', filename);
      fd.append('chunkIndex', String(i));
      fd.append('totalChunks', String(totalChunks));
      fd.append('folder', 'common');

      try {
        await fetch('https://video.alverium.ru/upload_chunk', { method: 'POST', body: fd });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      } catch (e) {
        alert("Ошибка выгрузки конспекта.");
        setUploadProgress(0);
        return;
      }
    }
    alert(`Конспект успешно сохранен в VOD консоли как ${filename}!`);
    // Очищаем память после успешной выгрузки
    localStorage.removeItem(ROOM_KEY);
    setUploadProgress(0);
  };

  return (
    <div className="relative w-full h-full bg-[#1a1a1a] flex flex-col rounded-xl overflow-hidden shadow-2xl">
      {isHost && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 bg-black/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl">
          <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-all">
            + PDF
            <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
          </label>
          
          <div className="flex items-center gap-2 text-gray-300 font-mono text-sm">
            <button disabled={currentPage <= 1} onClick={() => { setCurrentPage(p => p - 1); broadcast({ type: 'WB_PAGE', page: currentPage - 1 }); }} className="px-2 hover:text-white disabled:opacity-50">◀</button>
            <span>{currentPage} / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => { setCurrentPage(p => p + 1); broadcast({ type: 'WB_PAGE', page: currentPage + 1 }); }} className="px-2 hover:text-white disabled:opacity-50">▶</button>
          </div>

          <button onClick={clearPage} className="text-red-400 hover:text-red-300 text-xs font-bold px-2 uppercase transition-colors">Очистить</button>
          <button onClick={saveAndUploadNotes} className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-[0_0_10px_rgba(153,27,27,0.5)] transition-all">
            {uploadProgress > 0 ? `Сохранение: ${uploadProgress}%` : '💾 В LMS'}
          </button>
        </div>
      )}

      <div ref={containerRef} className="flex-1 w-full h-full p-4 flex items-center justify-center relative touch-none">
        {/* ЖЕСТКАЯ ФИКСАЦИЯ БЕЛОГО ФОНА И РАЗМЕРОВ */}
        <div className="relative shadow-2xl bg-white w-full max-w-full mx-auto flex-shrink-0" style={{ aspectRatio: '16/9', maxHeight: '100%' }}>
          <canvas ref={bgCanvasRef} width={VIRTUAL_W} height={VIRTUAL_H} className="absolute inset-0 w-full h-full object-contain pointer-events-none rounded-lg" />
          <canvas
            ref={drawCanvasRef}
            width={VIRTUAL_W}
            height={VIRTUAL_H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerOut={onPointerUp}
            className={`absolute inset-0 w-full h-full object-contain rounded-lg ${isHost ? 'cursor-crosshair' : 'pointer-events-none'}`}
            style={{ touchAction: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}
