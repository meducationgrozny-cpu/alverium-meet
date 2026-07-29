"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
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
  const currentPdfUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(ROOM_KEY);
    if (saved) {
      try { linesMap.current = JSON.parse(saved); } catch(e) {}
    }
  }, [ROOM_KEY]);

  const saveToLocal = () => {
    localStorage.setItem(ROOM_KEY, JSON.stringify(linesMap.current));
  };

  const handleDoubleClick = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try { await containerRef.current.requestFullscreen(); } catch (err) { console.error("Ошибка Fullscreen:", err); }
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
    }
  };

  // Синхронизация опоздавших учеников
  useEffect(() => {
    const handleParticipantConnected = () => {
      if (isHost) {
        setTimeout(() => {
          broadcast({ type: 'WB_PAGE', page: currentPage });
          if (currentPdfUrlRef.current) {
            broadcast({ type: 'WB_PDF_URL', url: currentPdfUrlRef.current });
          }
        }, 2000);
      }
    };
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    return () => { room.off(RoomEvent.ParticipantConnected, handleParticipantConnected); };
  }, [isHost, currentPage, room]);

  useEffect(() => {
    const handleData = async (payload: Uint8Array) => {
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
        } else if (msg.type === 'WB_PDF_URL' && !isHost) {
          // Ученик получает URL и скачивает PDF
          try {
            const res = await fetch(msg.url);
            const arrayBuffer = await res.arrayBuffer();
            pdfBytesRef.current = arrayBuffer.slice(0);
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;
            pdfDocRef.current = pdf;
            setTotalPages(pdf.numPages);
            setRenderTrigger(prev => prev + 1);
          } catch (e) {
            console.error("Ошибка загрузки синхронизированного PDF", e);
          }
        }
      } catch (e) {}
    };
    room.on(RoomEvent.DataReceived, handleData);
    return () => { room.off(RoomEvent.DataReceived, handleData); };
  }, [room, currentPage, isHost]);

  useEffect(() => {
    if (pdfDocRef.current) renderPdfPage(currentPage);
    drawAllLines(currentPage);
  }, [currentPage, renderTrigger]); 

  const renderPdfPage = async (pageNum: number) => {
    if (!pdfDocRef.current || !bgCanvasRef.current) return;
    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      const scale = Math.min(VIRTUAL_W / unscaledViewport.width, VIRTUAL_H / unscaledViewport.height);
      const viewport = page.getViewport({ scale });
      const canvas = bgCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, VIRTUAL_W, VIRTUAL_H);
      const offsetX = (VIRTUAL_W - viewport.width) / 2;
      const offsetY = (VIRTUAL_H - viewport.height) / 2;
      const renderContext: any = { canvasContext: ctx, viewport: viewport, transform: [1, 0, 0, 1, offsetX, offsetY] };
      await page.render(renderContext).promise;
    } catch (err) {
      console.error("Ошибка рендера:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isHost) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        pdfBytesRef.current = arrayBuffer.slice(0);
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setRenderTrigger(prev => prev + 1);
        broadcast({ type: 'WB_PAGE', page: 1 });

        // Фоновая выгрузка (НАПРЯМУЮ В NEXT.JS БЕЗ PYTHON-СЕРВЕРА)
    const fd = new FormData();
    fd.append('file', file);
    fetch('/api/pdf-sync', { method: 'POST', body: fd })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          currentPdfUrlRef.current = data.url;
          broadcast({ type: 'WB_PDF_URL', url: data.url });
        }
      }).catch(console.error);

} catch (err) {
        alert("Ошибка чтения PDF: " + err);
    }
  };

  const getCoords = (e: React.PointerEvent) => {
    if (!drawCanvasRef.current) return { x: 0, y: 0 };
    const rect = drawCanvasRef.current.getBoundingClientRect();
    const scaleX = VIRTUAL_W / rect.width;
    const scaleY = VIRTUAL_H / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
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

  const saveAndUploadNotes = async () => {
    if (!pdfBytesRef.current) { alert("Сначала загрузите PDF!"); return; }
    setUploadProgress(1);
    try {
      const pdfDoc = await PDFDocument.load(pdfBytesRef.current);
      for (let i = 0; i < totalPages; i++) {
        const pageNum = i + 1;
        if (linesMap.current[pageNum] && linesMap.current[pageNum].length > 0) {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = VIRTUAL_W; tempCanvas.height = VIRTUAL_H;
          const ctx = tempCanvas.getContext('2d')!;
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          linesMap.current[pageNum].forEach(line => {
            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.lineWidth = line.width;
            line.points.forEach((p, idx) => {
              if (idx === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
            });
            ctx.stroke();
          });
          const pngImageBytes = await fetch(tempCanvas.toDataURL()).then(res => res.arrayBuffer());
          const pngImage = await pdfDoc.embedPng(pngImageBytes);
          const pdfPage = pdfDoc.getPage(i);
          const { width, height } = pdfPage.getSize();
          pdfPage.drawImage(pngImage, { x: 0, y: 0, width: width, height: height, opacity: 1 });
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
      const fd = new FormData();
      fd.append('file', blob.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, blob.size)));
      fd.append('filename', filename);
      fd.append('chunkIndex', String(i));
      fd.append('totalChunks', String(totalChunks));
      fd.append('folder', 'notes');

      try {
        await fetch('/api/proxy-upload', { method: 'POST', body: fd });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      } catch (e) {
        alert("Ошибка выгрузки конспекта.");
        setUploadProgress(0); return;
      }
    }
    alert(`Конспект успешно сохранен в VOD консоли как ${filename}!`);
    localStorage.removeItem(ROOM_KEY);
    setUploadProgress(0);
  };

  
  const [isToolbarOpen, setIsToolbarOpen] = React.useState(true);
  const [isFakeFullscreen, setIsFakeFullscreen] = React.useState(false);

  const toggleFullScreen = () => {
    if (containerRef.current && containerRef.current.requestFullscreen) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {
          setIsFakeFullscreen(prev => !prev);
        });
      } else {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      }
    } else {
      setIsFakeFullscreen(prev => !prev);
    }
  };

  return (
    <div ref={containerRef} className={`bg-[#1a1a1a] flex flex-col transition-all duration-300 ${isFakeFullscreen ? 'fixed inset-0 z-[9999] w-screen h-screen' : 'relative w-full h-full md:rounded-xl overflow-hidden shadow-2xl'}`}>
      
      <button onClick={toggleFullScreen} className="absolute top-4 right-4 z-50 bg-black/60 hover:bg-black/90 text-white px-3 py-2 rounded-lg backdrop-blur-md transition-all border border-white/10 text-xs md:text-sm shadow-lg">
        {isFakeFullscreen || (typeof document !== 'undefined' && document.fullscreenElement) ? '⛶ Свернуть' : '⛶ На весь экран'}
      </button>

      {isHost && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
          <button onClick={() => setIsToolbarOpen(!isToolbarOpen)} className="bg-black/60 text-white/80 hover:text-white text-[10px] md:text-xs px-4 py-1.5 rounded-full backdrop-blur-md transition-all border border-white/10 shadow-lg">
            {isToolbarOpen ? 'Скрыть панель ▲' : 'Инструменты ▼'}
          </button>
          
          {isToolbarOpen && (
            <div className="flex items-center gap-2 md:gap-4 bg-black/80 backdrop-blur-md px-2 md:px-4 py-2 rounded-2xl border border-white/10 shadow-2xl mt-2 transition-all">
              <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white text-[10px] md:text-xs font-bold px-2 py-1.5 md:px-3 rounded-lg transition-all">
                + PDF
                <input type="file" accept="application/pdf" className="hidden" onChange={handleFileUpload} />
              </label>
              <div className="flex items-center gap-1 md:gap-2 text-gray-300 font-mono text-[10px] md:text-sm">
                <button disabled={currentPage <= 1} onClick={() => { setCurrentPage(p => p - 1); broadcast({ type: 'WB_PAGE', page: currentPage - 1 }); }} className="px-1 hover:text-white disabled:opacity-50">◀</button>
                <span>{currentPage} / {totalPages}</span>
                <button disabled={currentPage >= totalPages} onClick={() => { setCurrentPage(p => p + 1); broadcast({ type: 'WB_PAGE', page: currentPage + 1 }); }} className="px-1 hover:text-white disabled:opacity-50">▶</button>
              </div>
              <button onClick={clearPage} className="text-red-400 hover:text-red-300 text-[10px] md:text-xs font-bold px-1 md:px-2 uppercase transition-colors">Очистить</button>
              <button onClick={saveAndUploadNotes} className="bg-red-800 hover:bg-red-700 text-white text-[10px] md:text-xs font-bold px-2 py-1.5 md:px-3 rounded-lg shadow-[0_0_10px_rgba(153,27,27,0.5)] transition-all">
                {uploadProgress > 0 ? `${uploadProgress}%` : '💾 В LMS'}
              </button>
            </div>
          )}
        </div>
      )}

      <div onDoubleClick={typeof handleDoubleClick !== 'undefined' ? handleDoubleClick : undefined} className="flex-1 w-full h-full p-0 flex items-center justify-center relative touch-none bg-black">
        <div className="relative shadow-2xl bg-white w-full h-full max-w-full max-h-full mx-auto flex-shrink-0 md:rounded-lg overflow-hidden flex items-center justify-center">
          <canvas ref={bgCanvasRef} width={VIRTUAL_W} height={VIRTUAL_H} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
          <canvas
            ref={drawCanvasRef}
            width={VIRTUAL_W}
            height={VIRTUAL_H}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerOut={onPointerUp}
            className={`absolute inset-0 w-full h-full object-contain ${isHost ? 'cursor-crosshair' : 'pointer-events-none'}`}
            style={{ touchAction: 'none' }}
          />
        </div>
      </div>
    </div>
  );
}