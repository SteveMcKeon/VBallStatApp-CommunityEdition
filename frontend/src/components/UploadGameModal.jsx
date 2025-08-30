import {
  useState, useEffect, useRef, forwardRef, useImperativeHandle, createRef
} from 'react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import FloatingLabelInput from './FloatingLabelInput';
import Modal from './Modal';
import Toast from './Toast';
import { api, op } from '../utils/postgrest';
/* -------------------- Sortables -------------------- */
const SortableItem = ({ upload, id, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between px-2 py-1 mb-1 bg-white rounded border border-gray-200 shadow-sm select-none w-full"
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center gap-2 flex-1 min-w-0 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
      >
        <div className="text-gray-400 text-lg flex-shrink-0" aria-hidden>≡</div>
        <div className="text-sm flex-1 min-w-0 truncate text-left" title={upload.file.name}>{upload.file.name}</div>
        <div className="text-sm text-gray-400">Game {upload.setNumber}</div>
      </div>
      <button
        onClick={() => onRemove(upload.id)}
        onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        className="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:bg-red-100 transition cursor-pointer"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};
function isValidISODate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const leap = (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
  const dim = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= dim[m - 1];
}
async function ensureNextGameRow({ teamId, date, players, fileNameFromUser }) {
  const parseGameNumFromTitle = (t = '') => {
    const m = /game\s*(\d+)/i.exec(t);
    return m ? parseInt(m[1], 10) : 0;
  };
  const parsePlayers = (value) =>
    (value || '').split(',').map((s) => s.trim()).filter(Boolean);
  const rows = await api.get('games', { team_id: op.eq(teamId), date: op.eq(date), select: 'id,title' });
  const max = (rows || []).reduce((m, r) => Math.max(m, parseGameNumFromTitle(r.title)), 0);
  const nextN = max + 1;
  const title = `${date} Game ${nextN}`;
  const video_url = fileNameFromUser ?? `${date}_Game${nextN}.mp4`;
  const existing = await api.get('games', {
    team_id: op.eq(teamId), date: op.eq(date), title: op.eq(title), select: 'id', limit: '1'
  });
  if (existing?.[0]?.id) return { id: existing[0].id, gameNumber: nextN, title, video_url };
  const payload = {
    team_id: teamId,
    date,
    title,
    video_url: fileNameFromUser,
    players: parsePlayers(players)
  };
  const inserted = await api.post('games', [payload], { prefer: 'return=representation' });
  const row = Array.isArray(inserted) ? inserted[0] : inserted;
  if (!row?.id) throw new Error('Failed to create game row');
  return { id: row.id, gameNumber: nextN, title, video_url };
}
const UploadOrderList = ({ uploads, setUploads, onRemove }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { pressDelay: 120, pressTolerance: 5 })
  );
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = uploads.findIndex(u => u.id === active.id);
    const newIndex = uploads.findIndex(u => u.id === over.id);
    const newUploads = arrayMove(uploads, oldIndex, newIndex).map((upload, idx) => ({
      ...upload,
      setNumber: idx + 1
    }));
    setUploads(newUploads);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="space-y-1 mt-2">
        <SortableContext items={uploads.map(u => u.id)} strategy={verticalListSortingStrategy}>
          {uploads.map((upload) => (
            <SortableItem key={upload.id} id={upload.id} upload={upload} onRemove={onRemove} />
          ))}
        </SortableContext>
      </div>
    </DndContext>
  );
};
/* ===========================================================
   Component
   =========================================================== */
const UploadGameModal = forwardRef((
  { isOpen, onBeforeOpen, onClose, teamId, onUpload, userId },
  ref
) => {
  const [gameGroupId, setGameGroupId] = useState(() => crypto.randomUUID());
  const [uploads, setUploads] = useState([]);
  const [autofillDate, setAutofillDate] = useState(false);
  const [autofillPlayers, setAutofillPlayers] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [date, setDate] = useState('');
  const [players, setPlayers] = useState('');
  const dragCounter = useRef(0);
  const cancelFlagsRef = useRef(new Map());
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState(null);
  const [toastDuration, setToastDuration] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const setToast = (message, type = 'error', duration) => {
    setToastMessage(message); setToastType(type); setToastDuration(duration); setShowToast(true);
  };
  useImperativeHandle(ref, () => ({
    addLocalFiles(files) {
      if (!Array.isArray(files) || files.length === 0) return;
      setUploads(prev => [
        ...prev,
        ...files.map(({ fileHandle, file }, idx) => ({
          file,
          fileHandle: fileHandle || null,
          id: crypto.randomUUID(),
          progress: 0,
          status: 'pending',
          paused: false,
          setNumber: (prev.length + idx + 1),
          metadata: {
            filename: file?.name,
            filetype: file?.type,
            date: '',
            players: '',
            team_id: teamId,
            user_id: userId,
            game_group_id: crypto.randomUUID(),
            setNumber: String(prev.length + idx + 1),
          },
        })),
      ]);
    },
  }));
  const progressRefs = useRef([]);
  useEffect(() => {
    const refs = { ...progressRefs.current };
    uploads.forEach(upload => { if (!refs[upload.id]) refs[upload.id] = createRef(); });
    progressRefs.current = refs;
  }, [uploads]);
  useEffect(() => { if (isOpen && onBeforeOpen) { setGameGroupId(crypto.randomUUID()); onBeforeOpen(); } }, [isOpen, onBeforeOpen]);
  useEffect(() => {
    const stopKeyPropagation = (e) => { if (isOpen) e.stopPropagation(); };
    window.addEventListener('keydown', stopKeyPropagation, true);
    return () => window.removeEventListener('keydown', stopKeyPropagation, true);
  }, [isOpen]);
  const handleRemoveUpload = (id) => {
    setUploads(prev =>
      prev.filter(upload => upload.id !== id)
        .map((upload, idx) => ({ ...upload, setNumber: idx + 1 }))
    );
  };
  // File picking (same UX)
  const fallbackFileInputRef = useRef(null);
  const handleFallbackFileInputChange = async (e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = [];
    let invalidCount = 0;
    for (const file of files) {
      if (file.type === 'video/mp4') {
        const metadata = {
          filename: file.name, filetype: file.type, date, players,
          team_id: teamId, user_id: userId, game_group_id: gameGroupId,
          setNumber: (uploads.length + validFiles.length + 1).toString(),
        };
        const id = [
          'local', file.name, file.type, file.size, file.lastModified,
          metadata.date, metadata.players, metadata.user_id, metadata.setNumber
        ].join('-');
        if (uploads.some(u => u.file.name === file.name) || validFiles.some(u => u.file.name === file.name)) continue;
        validFiles.push({
          file, progress: 0, status: 'pending', paused: false, fileHandle: null,
          id, setNumber: uploads.length + validFiles.length + 1, metadata
        });
      } else invalidCount++;
    }
    if (invalidCount > 0) setToast(`${invalidCount} invalid file(s) skipped (only MP4 allowed)`);
    const remainingSlots = 5 - uploads.length;
    const uploadsToAdd = validFiles.slice(0, remainingSlots);
    if (uploadsToAdd.length > 0) setUploads(prev => [...prev, ...uploadsToAdd]);
    if (uploadsToAdd.length < validFiles.length) setToast('Only 5 files allowed. Some were not added.');
    e.target.value = '';
  };
  const handleFileSelect = async () => {
    if (uploads.length >= 5) { setToast('Maximum of 5 video files allowed', 'error'); return; }
    if (!window.showOpenFilePicker) { fallbackFileInputRef.current?.click(); return; }
    try {
      const fileHandles = await window.showOpenFilePicker({
        types: [{ description: 'MP4 Videos', accept: { 'video/mp4': ['.mp4'] } }],
        excludeAcceptAllOption: true,
        multiple: true,
      });
      const newUploads = [];
      let duplicateCount = 0; let invalidCount = 0;
      for (const fileHandle of fileHandles) {
        const file = await fileHandle.getFile();
        if (file.type !== 'video/mp4') { invalidCount++; continue; }
        const metadata = {
          filename: file.name, filetype: file.type, date, players,
          team_id: teamId, user_id: userId, game_group_id: gameGroupId,
          setNumber: (uploads.length + newUploads.length + 1).toString()
        };
        const id = [
          'local', file.name, file.type, file.size, file.lastModified,
          metadata.date, metadata.players, metadata.user_id, metadata.setNumber
        ].join('-');
        if (uploads.some(u => u.file.name === file.name) || newUploads.some(u => u.file.name === file.name)) {
          duplicateCount++; continue;
        }
        newUploads.push({
          file, progress: 0, status: 'pending', paused: false, fileHandle,
          id, setNumber: uploads.length + newUploads.length + 1, metadata
        });
      }
      if (invalidCount > 0) setToast(`${invalidCount} invalid file(s) skipped (only MP4 allowed)`);
      if (newUploads.length === 0) { if (duplicateCount === 0 && invalidCount > 0) setToast('No valid MP4 files selected', 'error'); return; }
      const remainingSlots = 5 - uploads.length;
      const uploadsToAdd = newUploads.slice(0, remainingSlots);
      setUploads(prev => [...prev, ...uploadsToAdd]);
      if (uploadsToAdd.length < newUploads.length) setToast('Only 5 files allowed. Some were not added.');
    } catch { }
  };
  const dismissUpload = (id) => setUploads(prev => prev.filter(u => u.id !== id));
  const handleSubmit = async (uploadId, fileOverride = null) => {
    const item = uploads.find(u => u.id === uploadId);
    if (!item && !fileOverride) { setToast('No file selected for upload'); return; }
    const dateToUse = date;
    const playersToUse = players;
    let rowInfo;
    try {
      rowInfo = await ensureNextGameRow({
        teamId,
        date: dateToUse,
        players: playersToUse,
        fileNameFromUser: (item?.file?.name || '')
      });
    } catch (e) {
      setToast('Could not create game row.', 'error'); return 'validation-error';
    }
    const targetName = (rowInfo.video_url || `${dateToUse}_Game${rowInfo.gameNumber}.mp4`)
      .replace(/_h\.264\.mp4$/i, '.mp4');
    try {
      const { makeGameKey, storeFileHandleForKey, cacheOPFSForKey } = await import('../utils/localFiles');
      if (item?.fileHandle) {
        await storeFileHandleForKey(makeGameKey(teamId, rowInfo.title), item.fileHandle);
      } else {
      }
      try {
        await cacheOPFSForKey(makeGameKey(teamId, rowInfo.title), item.file);
      } catch { }
      setUploads(prev => prev.map(u => (u.id === uploadId ? { ...u, status: 'success', progress: 100 } : u)));
      setToast('Linked original file and registered in DB!', 'success');
      setTimeout(() => dismissUpload(uploadId), 3000);
      const base = { game_id: rowInfo.id, rally_id: 1, our_score: 0, opp_score: 0, set: 1, team_id: teamId };
      const newRows = Array.from({ length: 100 }, (_, i) => ({ ...base, import_seq: i + 1 }));
      const existing = await api.get('stats', { game_id: op.eq(rowInfo.id), select: 'id', limit: '1' });
      if (!existing?.length) {
        await api.post('stats', newRows, { prefer: 'return=representation' });
      }
      onUpload?.({ id: rowInfo.id, ...rowInfo, localFile: item?.file || null });
    } catch (err) {
      console.error(err);
      setUploads(prev => prev.map(u => (u.id === uploadId ? { ...u, status: 'error' } : u)));
      setToast(`Link failed${err?.message ? `: ${err.message}` : ''}`, 'error');
    } finally {
      cancelFlagsRef.current.delete(uploadId);
    }
  };
  /* -------------------- Render -------------------- */
  return (
    <>
      <input
        ref={fallbackFileInputRef}
        type="file"
        accept="video/mp4"
        multiple
        onChange={handleFallbackFileInputChange}
        style={{ display: 'none' }}
      />
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Register New Game</h2>
          <p className="text-sm text-gray-600">
            <br />The game will be assigned to your currently selected team.
          </p>
        </div>
        <FloatingLabelInput
          label="Date (YYYY-MM-DD)"
          id="date"
          name="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setAutofillDate(false); }}
          className={autofillDate ? 'bg-blue-100' : 'bg-white'}
        />
        <FloatingLabelInput
          label="Players (comma-separated)"
          id="players"
          name="players"
          value={players}
          onChange={(e) => { setPlayers(e.target.value); setAutofillPlayers(false); }}
          className={autofillPlayers ? 'bg-blue-100' : 'bg-white'}
        />
        {/* Drag & Drop */}
        <div
          className={`mt-6 border-2 border-dashed border-gray-300 rounded-lg px-6 pt-4 pb-4 text-center relative transition-all ${isDragging ? 'border-blue-500 ring-2 ring-blue-300' : ''}`}
          onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
          onDrop={async (e) => {
            e.preventDefault();
            dragCounter.current = 0;
            setIsDragging(false);
            const capacity = Math.max(0, 5 - uploads.length);
            if (capacity <= 0) { setToast('Only 5 files allowed. None were added.', 'error'); return; }
            const isMp4 = (f) => f && (f.type === 'video/mp4' || /\.mp4$/i.test(f.name || ''));
            const fpOf = (f) => `${f.name}::${f.size}::${f.lastModified}`;
            const seen = new Set((uploads || []).map(u => u?.file).filter(Boolean).map(fpOf));
            let invalidCount = 0;
            let duplicateCount = 0;
            const items = Array.from(e.dataTransfer.items || []);
            const filesList = Array.from(e.dataTransfer.files || []);
            const len = Math.max(items.length, filesList.length);
            const handlePromises = Array.from({ length: len }, (_, i) => {
              const it = items[i];
              if (it && it.kind === 'file' && typeof it.getAsFileSystemHandle === 'function') {
                try { return it.getAsFileSystemHandle().catch(() => null); } catch { return Promise.resolve(null); }
              }
              return Promise.resolve(null);
            });
            const handles = await Promise.all(handlePromises);
            const filePromises = Array.from({ length: len }, (_, i) => {
              const h = handles[i];
              if (h && h.kind === 'file') return h.getFile();
              const it = items[i];
              if (it && typeof it.getAsFile === 'function') return Promise.resolve(it.getAsFile());
              return Promise.resolve(filesList[i] || null);
            });
            const files = await Promise.all(filePromises);
            const candidates = [];
            for (let i = 0; i < len; i++) {
              const file = files[i];
              const handle = handles[i] && handles[i].kind === 'file' ? handles[i] : null;
              if (!file) continue;
              if (!isMp4(file)) { invalidCount++; continue; }
              const fp = fpOf(file);
              if (seen.has(fp)) { duplicateCount++; continue; }
              seen.add(fp);
              candidates.push({ file, fileHandle: handle });
            }
            if (invalidCount > 0) setToast(`${invalidCount} invalid file(s) skipped (only MP4 allowed)`, 'error');
            if (duplicateCount > 0) setToast(`${duplicateCount} duplicate file(s) skipped`, 'error');
            if (candidates.length === 0) return;
            const chosen = candidates.slice(0, capacity);
            const base = uploads.length;
            const toAdd = chosen.map((c, idx) => {
              const setNumber = base + idx + 1;
              const metadata = {
                filename: c.file.name,
                filetype: c.file.type || 'video/mp4',
                date,
                players,
                team_id: teamId,
                user_id: userId,
                game_group_id: gameGroupId,
                setNumber: String(setNumber),
              };
              const id = [
                'local',
                c.file.name,
                c.file.type,
                c.file.size,
                c.file.lastModified,
                metadata.date,
                metadata.players,
                metadata.user_id,
                metadata.setNumber,
              ].join('-');
              return {
                file: c.file,
                fileHandle: c.fileHandle,
                progress: 0,
                status: 'pending',
                paused: false,
                id,
                setNumber,
                metadata,
              };
            });
            setUploads(prev => [...prev, ...toAdd]);
            if (chosen.length < candidates.length) setToast('Only 5 files allowed. Some were not added.', 'error');
          }}
        >
          <p className="text-lg font-semibold mb-1">Drag and drop a video file</p>
          <p className="text-sm text-gray-500 mb-4">Attempts to save a file reference (Chromium only) for smoother playback.</p>
          <button
            onClick={handleFileSelect}
            className="inline-block px-6 py-2 bg-white border border-gray-300 rounded-md font-semibold text-sm cursor-pointer hover:bg-gray-100"
          >
            Select file(s)
          </button>
          {uploads.filter(upload => upload.status === 'pending').length > 0 && (
            <div className="mt-4 space-y-1">
              <UploadOrderList
                uploads={uploads.filter(u => u.status === 'pending')}
                setUploads={setUploads}
                onRemove={handleRemoveUpload}
              />
            </div>
          )}
        </div>
        {/* Bottom buttons */}
        <div className="mt-6 flex justify-between">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={async () => {
              if (!isValidISODate(date)) {
                setToast('Please enter a valid date like 1999-12-31', 'error');
                return;
              }
              if (!players.trim()) { setToast('Please enter players (comma-separated)', 'error'); return; }
              const pending = uploads.filter(u => u.status === 'pending');
              if (pending.length === 0) return;
              for (const u of pending) await handleSubmit(u.id);
              onClose();
            }}
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
          >
            Upload Game(s)
          </button>
        </div>
      </Modal>
      <Toast
        message={toastMessage}
        show={showToast}
        duration={toastDuration}
        onClose={() => setShowToast(false)}
        type={toastType}
      />
    </>
  );
});
export default UploadGameModal;
