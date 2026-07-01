// ====================================================
// ГЛАВНЫЙ ИНТЕРФЕЙС КОМНАТЫ
// ====================================================
function AlveriumStage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isHost, setIsHost] = useState(false); 

  // --- Стейты и рефы для записи ---
  const [isRecording, setIsRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const room = useRoomContext(); 

  useEffect(() => { setIsHost(parseJwtAdmin(token)); }, [token]);

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg.type === 'WHITEBOARD_TOGGLE') setIsWhiteboardOpen(msg.isOpen);
        else if (msg.type === 'FORCE_MUTE' && msg.target === room.localParticipant.identity) room.localParticipant.setMicrophoneEnabled(false);
        else if (msg.type === 'KICK' && msg.target === room.localParticipant.identity) {
          alert("Организатор удалил вас с урока.");
          room.disconnect();
        }
      } catch (e) { }
    };
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => { room.off(RoomEvent.DataReceived, handleDataReceived); };
  }, [room]);

  const toggleWhiteboard = () => {
    const newState = !isWhiteboardOpen;
    setIsWhiteboardOpen(newState);
    if (isHost) room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'WHITEBOARD_TOGGLE', isOpen: newState })), { reliable: true });
  };

  // --- Логика Записи Урока ---
  const startRecording = async () => {
    try {
      // Захватываем текущую вкладку со звуком
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        // @ts-ignore - нестандартное свойство, но Chrome его понимает
        preferCurrentTab: true 
      });

      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        stream.getTracks().forEach(t => t.stop()); // Выключаем шаринг экрана системно
        
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        if (blob.size > 0) {
          uploadRecordedLesson(blob);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Собираем данные каждую секунду
      setIsRecording(true);
    } catch (err) {
      console.error("Ошибка запуска записи:", err);
      alert("Не удалось запустить запись. Убедитесь, что разрешили доступ к вкладке.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
  };

  const uploadRecordedLesson = async (blob: Blob) => {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 МБ
    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
    const folder = "common"; // Папка по умолчанию
    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Alverium_Lesson_${dateStr}.webm`; // .webm так как пишем из браузера (потом Flask/ffmpeg переварит)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, blob.size);
      const chunk = blob.slice(start, end);

      const fd = new FormData();
      fd.append('file', chunk);
      fd.append('filename', filename);
      fd.append('chunkIndex', String(i));
      fd.append('totalChunks', String(totalChunks));
      fd.append('folder', folder);

      try {
        await fetch('https://video.alverium.ru/upload_chunk', {
          method: 'POST',
          body: fd
        });
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
      } catch (e) {
        alert(`Ошибка при загрузке части ${i + 1} из ${totalChunks}`);
        setUploadProgress(0);
        return;
      }
    }
    alert("Урок успешно загружен в VOD консоль!");
    setUploadProgress(0);
  };

  const screenTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const hasScreenShare = screenTracks.length > 0;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#000000] text-white font-sans selection:bg-red-900/50 relative">
      <header className="flex items-center justify-between px-4 md:px-8 py-4 bg-[#050505]/80 backdrop-blur-xl border-b border-white/5 z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-gradient-to-br from-red-800 to-red-600 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-[0_0_15px_rgba(220,38,38,0.2)]">A</div>
          <h1 className="text-sm font-semibold text-gray-100 tracking-wide hidden md:block">Alverium <span className="font-light text-gray-500">Meet</span></h1>
          
          {/* Индикатор загрузки записи */}
          {uploadProgress > 0 && (
            <div className="text-[10px] text-green-400 font-bold uppercase tracking-widest bg-green-900/20 px-3 py-1 rounded-full border border-green-800/50">
              Выгрузка: {uploadProgress}%
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 bg-white/5 border border-white/5 px-4 py-1.5 rounded-full">
          {isRecording ? (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,1)]"></div>
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500"></div>
          )}
          <span className="text-[10px] text-gray-400 font-medium tracking-widest uppercase">
            {isRecording ? 'Идет запись' : 'В эфире'}
          </span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 relative bg-[#0a0a0a]">
          {isWhiteboardOpen ? (
            <>
              <div className="absolute inset-0 p-2 md:p-4"><AlveriumWhiteboard isHost={isHost} /></div>
              {cameraTracks.length > 0 && (
                <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 w-28 md:w-48 max-h-[60vh] overflow-y-auto flex flex-col gap-2 p-1.5 md:p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                  {cameraTracks.map((track) => (<div key={track.publication?.trackSid || track.participant.identity} className="w-full aspect-video bg-black rounded-lg overflow-hidden relative"><ParticipantTile trackRef={track} /></div>))}
                </div>
              )}
            </>
          ) : hasScreenShare ? (
            <>
              <div className="absolute inset-0 p-2 md:p-4">
                <ScreenShareWrapper tracks={screenTracks} isHost={isHost} room={room} />
              </div>
              {cameraTracks.length > 0 && (
                <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20 w-28 md:w-48 max-h-[60vh] overflow-y-auto flex flex-col gap-2 p-1.5 md:p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 shadow-2xl">
                  {cameraTracks.map((track) => (<div key={track.publication?.trackSid || track.participant.identity} className="w-full aspect-video bg-black rounded-lg overflow-hidden relative"><ParticipantTile trackRef={track} /></div>))}
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 p-2 md:p-4"><GridLayout tracks={cameraTracks} style={{ height: '100%' }}><ParticipantTile /></GridLayout></div>
          )}
        </div>
        <AlveriumSidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isHost={isHost} />
      </main>

      <footer className="bg-[#050505]/90 backdrop-blur-2xl px-4 md:px-8 py-3 md:py-4 flex justify-between items-center z-20 border-t border-white/5 shrink-0">
        <div className="flex gap-2 md:gap-3 w-auto md:w-1/3">
          <button onClick={() => alert('Настройки (в разработке)')} className="hidden md:flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"><SettingsIcon /></button>
          
          {/* КНОПКА ЗАПИСИ (Только для хоста) */}
          {isHost && (
            <button 
              onClick={isRecording ? stopRecording : startRecording} 
              className={`hidden md:flex items-center justify-center w-12 h-12 rounded-xl transition-all relative overflow-hidden ${isRecording ? 'bg-red-900/40 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-white/5 border-white/5 hover:bg-red-900/20 text-gray-400'}`}
              title={isRecording ? "Остановить запись" : "Начать запись"}
            >
              <RecordIcon />
              {/* Прогресс-бар снизу кнопки при выгрузке */}
              {uploadProgress > 0 && <div className="absolute bottom-0 left-0 h-1 bg-green-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>}
            </button>
          )}

          {isHost && (
            <button onClick={toggleWhiteboard} className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl border transition-all ${isWhiteboardOpen ? 'bg-red-800 border-red-600 text-white' : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'}`}><PenIcon /></button>
          )}
        </div>
        
        <div className="flex items-center gap-1 md:gap-2 bg-[#0a0a0a] px-2 py-1.5 md:px-3 md:py-2 rounded-2xl border border-white/5 shadow-2xl">
          <TrackToggle source={Track.Source.Microphone} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />
          <TrackToggle source={Track.Source.Camera} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />
          {isHost && <TrackToggle source={Track.Source.ScreenShare} className="!bg-transparent hover:!bg-white/10 !text-gray-300 hover:!text-white !border-none !rounded-xl transition-all !w-10 !h-10 md:!w-12" />}
          <div className="w-[1px] h-6 bg-white/10 mx-1 md:mx-2"></div>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl border transition-all ${isSidebarOpen ? 'bg-white/10 text-white' : 'bg-transparent text-gray-300 hover:text-white'}`}><SidebarIcon /></button>
        </div>

        <div className="flex justify-end w-auto md:w-1/3">
          <DisconnectButton className="!bg-red-800 hover:!bg-red-700 !text-white px-4 md:px-6 py-2.5 md:py-3 !rounded-xl text-[10px] font-bold tracking-[0.2em] uppercase transition-all shadow-[0_0_20px_rgba(153,27,27,0.3)] !border !border-red-600/50">
            <span className="hidden md:inline">Завершить</span><span className="md:hidden">Выйти</span>
          </DisconnectButton>
        </div>
      </footer>
    </div>
  );
}
