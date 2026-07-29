const fs = require('fs');
const file = './app/room/[id]/Whiteboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const returnIndex = code.lastIndexOf('return (');

if (returnIndex !== -1) {
  const toggleCode = `
  const [isToolbarOpen, setIsToolbarOpen] = React.useState(true);
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };
  `;

  const newReturn = `return (
    <div ref={containerRef} className="relative w-full h-full bg-[#1a1a1a] flex flex-col md:rounded-xl overflow-hidden shadow-2xl">
      
      {/* Кнопка во весь экран для всех (ПК и Телефоны) */}
      <button onClick={toggleFullScreen} className="absolute top-4 right-4 z-50 bg-black/60 hover:bg-black/90 text-white px-3 py-2 rounded-lg backdrop-blur-md transition-all border border-white/10 text-xs md:text-sm shadow-lg">
        ⛶ На весь экран
      </button>

      {/* Умная сворачиваемая панель управления */}
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
                {uploadProgress > 0 ? \`\${uploadProgress}%\` : '💾 В LMS'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Резиновый холст */}
      <div onDoubleClick={handleDoubleClick} className="flex-1 w-full h-full p-0 flex items-center justify-center relative touch-none bg-black">
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
            className={\`absolute inset-0 w-full h-full object-contain \${isHost ? 'cursor-crosshair' : 'pointer-events-none'}\`}
            style={{ touchAction: 'none' }}
          />
        </div>
      </div>
    </div>
  );`;

  code = code.substring(0, returnIndex) + toggleCode + newReturn;
  fs.writeFileSync(file, code);
  console.log("Успех! UI доски обновлен.");
} else {
  console.log("Ошибка: блок return не найден!");
}
