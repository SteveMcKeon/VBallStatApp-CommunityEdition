import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import '../../App.css';
import ColumnSelector from '../ColumnSelector';
import { useSidebar } from '../SidebarContext';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import Modal from '../Modal';
import ManageTeamModal from '../ManageTeamModal';
import GameSelector from '../GameSelector';
import StyledSelect from '../StyledSelect';
import SidebarFooter from '../SidebarFooter';
import UploadGameModal from '../UploadGameModal';
import { api, op } from '../../utils/postgrest';
const DEMO_TEAM_ID = 'e2e310d6-68b1-47cb-97e4-affd7e56e1a3';
function getOrCreateLocalUserId() {
  let id = localStorage.getItem('demo_user_id');
  if (!id) {
    const rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    id = rnd;
    localStorage.setItem('demo_user_id', id);
  }
  return id;
}
const MiniSidebar = ({ onExpand, teamId, isMobile }) => {
  const handlePanelClick = () => onExpand();
  const stopPropagation = (e) => e.stopPropagation();
  return (
    <div
      onClick={handlePanelClick}
      className="h-full w-12 flex-shrink-0 cursor-e-resize flex flex-col items-center justify-between hover:bg-gray-100 transition-colors"
    >
      {/* Top: Expand */}
      <div onClick={stopPropagation}>
        <div className="flex items-center justify-between p-2">
          <button
            onClick={onExpand}
            className="ml-auto p-1 hover:bg-gray-200 rounded cursor-pointer"
            aria-label="Expand sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-rtl-flip=""><path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z"></path></svg>
          </button>
        </div>
        <div className="h-px bg-gray-300 w-6 mx-auto" />
      </div>
      {/* Bottom: user icon/footer */}
      <div onClick={stopPropagation}>
        <SidebarFooter mini teamId={teamId} isMobile={isMobile} DEMO_TEAM_ID={DEMO_TEAM_ID} />
      </div>
    </div >
  );
};
const MainPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isStats = location.pathname.includes('/stats/');
  const NEW_TEAM_VALUE = '__new-team__';
  const [availableTeams, setAvailableTeams] = useState([]);
  const teamOptions = useMemo(
    () => [
      ...availableTeams.map(t => ({ label: t.name, value: t.id, color: 'blue' })),
      { label: <em>Register new team…</em>, value: NEW_TEAM_VALUE, color: 'gray' },
    ],
    [availableTeams]
  );
  const [showCreateTeamCentered, setShowCreateTeamCentered] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [quickTeamName, setQuickTeamName] = useState('');
  const [creatingQuickTeam, setCreatingQuickTeam] = useState(false);
  const [showManageTeamModal, setShowManageTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [createError, setCreateError] = useState('');
  const [filterFrozen, setFilterFrozen] = useState(false);
  const [frozenRowIds, setFrozenRowIds] = useState([]);
  const sidebarRef = useRef(null);
  const uploadModalRef = useRef();
  const firstAutoLoadRef = useRef(false);
  const onRequestCreateFromLocal = useCallback(({ fileHandle, file }) => {
    setIsUploadModalOpen(true);
    setTimeout(() => {
      uploadModalRef.current?.addLocalFiles?.([{ fileHandle, file }]);
    }, 0);
  }, []);
  const [sidebarContent, setSidebarContent] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const handleOpenUploadModal = () => {
    requestAnimationFrame(() => {
      videoPlayerRef.current?.forceHideControls();
    });
    setIsUploadModalOpen(true);
    firstAutoLoadRef.current = false;
  };
  const onCreateTeamSubmit = (e) => {
    e.preventDefault();
    if (!creatingTeam) handleCreateTeam();
  };
  const createTeamByName = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setCreatingQuickTeam(true);
    try {
      const userId = getOrCreateLocalUserId();
      const created = await api.post('teams', [{ name: trimmed, captain_id: userId }], {
        prefer: 'return=representation'
      });
      const teamRow = Array.isArray(created) ? created[0] : created;
      await api.post('team_members', [{ team_id: teamRow.id, user_id: userId, role: 'captain' }], {
        prefer: 'resolution=merge-duplicates,return=minimal'
      });
      const next = [...availableTeams, teamRow];
      setAvailableTeams(next);
      setTeamId(teamRow.id);
      setTeamName(teamRow.name);
      setLocal('teamId', teamRow.id);
      setLocal('teamName', teamRow.name);
      await handleTeamChange({ target: { value: teamRow.id } }, { force: true });
      setShowQuickCreate(false);
      setQuickTeamName('');
      handleOpenUploadModal();
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Failed to create team');
    } finally {
      setCreatingQuickTeam(false);
    }
  };
  const handleCreateTeam = async () => {
    const name = newTeamName.trim();
    if (!name) { setCreateError('Please enter a team name'); return; }
    setCreatingTeam(true);
    setCreateError('');
    try {
      const userId = getOrCreateLocalUserId();
      const created = await api.post('teams', [{ name, captain_id: userId }], {
        prefer: 'return=representation'
      });
      const teamRow = Array.isArray(created) ? created[0] : created;
      await api.post('team_members', [{ team_id: teamRow.id, user_id: userId, role: 'captain' }], {
        prefer: 'resolution=merge-duplicates,return=minimal'
      });
      const next = [...availableTeams, teamRow];
      setAvailableTeams(next);
      setTeamId(teamRow.id);
      setTeamName(teamRow.name);
      setLocal('teamId', teamRow.id);
      setLocal('teamName', teamRow.name);
      await handleTeamChange({ target: { value: teamRow.id } }, { force: true });
      handleOpenUploadModal();
    } catch (e) {
      setCreateError(e?.message || 'Failed to create team');
    } finally {
      setCreatingTeam(false);
    }
  };
  const [currentUserId, setCurrentUserId] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState('');
  useEffect(() => {
    setCurrentUserId(getOrCreateLocalUserId());
  }, [teamName]);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const videoPlayerRef = useRef(null);
  const [gamePlayers, setGamePlayers] = useState([]);
  const setLocal = (key, value) => localStorage.setItem(key, value);
  const getLocal = (key) => localStorage.getItem(key);
  const handleTeamChange = async (e, { force = false } = {}) => {
    const selectedId = e.target.value;
    if (!force && String(selectedId) === String(teamId)) {
      return { data: teamGames, error: null, skipped: true };
    }
    setTeamId(selectedId);
    setLocal('teamId', selectedId);
    const t = availableTeams.find(tt => String(tt.id) === String(selectedId));
    setTeamName(t?.name ?? '');
    setLocal('teamName', t?.name ?? '');
    setSelectedGameId(null);
    localStorage.removeItem('selectedGameId');
    setSelectedVideo('');
    setStats([]);
    setGamePlayers([]);
    setGameId(null);
    requestAnimationFrame(() =>
      window.dispatchEvent(new Event('db_layout_change'))
    );
    return await refreshGames(selectedId);
  };
  const refreshGames = async (id = teamId) => {
    if (!id) return { data: [], error: null };
    try {
      const rows = await api.get('games', {
        team_id: op.eq(id),
        select: '*',
        order: 'date.desc'
      });
      setTeamGames(rows || []);
      if (String(id) === String(DEMO_TEAM_ID) && Array.isArray(rows) && rows.length === 1) {
        const g = rows[0];
        setSelectedGameId(g.id);
        setSelectedVideo(g.video_url || '');
        setTimeout(() => { videoRef.current?.focus(); }, 300);
      }
      return { data: rows || [], error: null };
    } catch (error) {
      console.error('Error refreshing games:', error);
      return { data: [], error };
    }
  };
  const [teamGames, setTeamGames] = useState([]);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [textColumnFilters, setTextColumnFilters] = useState({});
  const handleTextColumnFilterChange = (column, value) => {
    const colType = visibleColumns[column]?.type;
    setTextColumnFilters((prev) => {
      const next = { ...prev };
      const isEmpty =
        value == null ||
        (Array.isArray(value?.conditions) && value.conditions.length === 0);
      if (typeof value === 'string') {
        const operator = colType === 'text' ? 'contains' : 'equals';
        next[column] = { conditions: [{ operator, value }] };
      } else if (isEmpty) {
        delete next[column];
      } else {
        next[column] = value;
      }
      return next;
    });
    requestAnimationFrame(() =>
      window.dispatchEvent(new Event('db_layout_change'))
    );
  };
  const savedVisibleColumns = getLocal('visibleColumnsMainPage');
  const savedLayout = getLocal('layoutMode');
  const videoRef = useRef(null);
  const mainContentRef = useRef(null);
  const containerRef = useRef(null);
  const [stats, setStats] = useState([]);
  const idToRow = useMemo(() => new Map(stats.map(r => [r.id, r])), [stats]);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [gameId, setGameId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const handleEditModeToggle = () => setEditMode(v => !v);
  const isFiltered =
    Object.values(textColumnFilters).some((filter) => {
      const conditions = filter?.conditions ?? [];
      return conditions.some(({ operator, value }) =>
        ['blank', 'not_blank'].includes(operator) ||
        (operator === 'between'
          ? value?.min?.toString().trim() || value?.max?.toString().trim()
          : value?.toString().trim())
      );
    });
  const [showSidebar, setShowSidebar] = useState(true);
  const { registerToggle } = useSidebar();
  const isMobile = useMemo(() => {
    const coarse = !window.matchMedia("(pointer: fine)").matches;
    const narrow = window.innerWidth < 768;
    return coarse && narrow;
  }, []);
  const handleMainInteract = () => {
    if (isUploadModalOpen) return;
    if (showSidebar && isMobile) {
      setShowSidebar(false);
      requestAnimationFrame(() => window.dispatchEvent(new Event('db_layout_change')));
    }
  };
  useEffect(() => {
    const onTeamRenamed = (e) => {
      const { id, name } = e.detail || {};
      if (!id || !name) return;
      setAvailableTeams(prev =>
        prev.map(t => String(t.id) === String(id) ? { ...t, name } : t)
      );
      if (String(teamId) === String(id)) {
        setTeamName(name);
        localStorage.setItem('teamName', name);
      }
    };
    window.addEventListener('team_renamed', onTeamRenamed);
    return () => window.removeEventListener('team_renamed', onTeamRenamed);
  }, [teamId]);
  useEffect(() => {
    registerToggle(() => {
      setShowSidebar((prev) => {
        const next = !prev;
        requestAnimationFrame(() => window.dispatchEvent(new Event('db_layout_change')));
        return next;
      });
    });
  }, [registerToggle]);
  const [layoutMode, setLayoutMode] = useState(() => {
    try {
      return savedLayout ? decodeURIComponent(savedLayout) : 'stacked';
    } catch {
      return 'stacked';
    }
  });
  const [sortConfig, setSortConfig] = useState({ key: 'import_seq', direction: 'asc' });
  const defaultColumnConfig = {
    timestamp: { visible: true, type: 'float8' },
    set: { visible: false, type: 'int2' },
    rally_id: { visible: false, type: 'int2' },
    player: { visible: true, type: 'text' },
    action_type: { visible: true, type: 'text' },
    quality: { visible: true, type: 'numeric' },
    set_to_player: { visible: false, type: 'text' },
    set_to_position: { visible: false, type: 'text' },
    result: { visible: false, type: 'text' },
    score: { visible: false, type: 'int2' },
    our_score: { visible: false, type: 'int2' },
    opp_score: { visible: false, type: 'int2' },
    notes: { visible: true, type: 'text' },
  };
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const loaded = savedVisibleColumns
        ? JSON.parse(decodeURIComponent(savedVisibleColumns))
        : {};
      return Object.fromEntries(
        Object.entries(defaultColumnConfig).map(([key, def]) => [
          key,
          { ...def, ...loaded[key] },
        ])
      );
    } catch (err) {
      return defaultColumnConfig;
    }
  });
  const toggleColumn = (col) => {
    setVisibleColumns((prev) => {
      const isNowVisible = !prev[col]?.visible;
      if (col === 'score') {
        return {
          ...prev,
          score: { ...prev.score, visible: isNowVisible },
          our_score: { ...prev.our_score, visible: isNowVisible },
          opp_score: { ...prev.opp_score, visible: isNowVisible },
        };
      }
      return {
        ...prev,
        [col]: {
          ...prev[col],
          visible: isNowVisible
        }
      };
    });
    requestAnimationFrame(() => window.dispatchEvent(new Event('db_layout_change')));
  };
  const loadStatsForSelectedVideo = async (videoUrl) => {
    const useId = selectedGameId;
    if (!useId && !videoUrl) { setStats([]); return; }
    try {
      let game = null;
      if (useId) {
        const rows = await api.get('games', {
          id: op.eq(useId),
          select: 'id,players,video_url',
          limit: '1'
        });
        game = rows?.[0] || null;
      } else {
        const rows = await api.get('games', {
          team_id: op.eq(teamId),
          video_url: op.eq(videoUrl),
          select: 'id,players',
          limit: '1'
        });
        game = rows?.[0] || null;
      }
      if (!game?.id) { setStats([]); setGameId(null); setGamePlayers([]); return; }
      setGameId(game.id);
      setGamePlayers(game.players || []);
      const statRows = await api.get('stats', {
        game_id: op.eq(game.id),
        select: '*',
        order: 'import_seq.asc'
      });
      setStats(Array.isArray(statRows) ? statRows : []);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
      setStats([]);
    }
  };
  useEffect(() => {
    loadStatsForSelectedVideo(selectedVideo);
  }, [selectedVideo]);
  useEffect(() => {
    if (selectedGameId) {
      localStorage.setItem('selectedGameId', selectedGameId);
    }
  }, [selectedGameId]);
  const fetchTeamNames = async () => {
    try {
      const rows = await api.get('teams', { select: 'id,name', order: 'name.asc' });
      return rows ?? [];
    } catch (e) {
      console.error('Error fetching teams:', e);
      return [];
    }
  };
  useEffect(() => {
    setIsAppLoading(true);
    (async () => {
      const teams = await fetchTeamNames();
      setAvailableTeams(teams);
      setTeamId('');
      setTeamName('');
      setLocal('teamId', '');
      setLocal('teamName', '');
      setIsAppLoading(false);
    })();
  }, []);
  useEffect(() => {
    setLocal('visibleColumnsMainPage', JSON.stringify(visibleColumns));
  }, [visibleColumns]);
  useEffect(() => {
    setLocal('layoutMode', layoutMode);
  }, [layoutMode]);
  const refreshStats = () => loadStatsForSelectedVideo(selectedVideo);
  const baseFilteredStats = useMemo(() => stats
    .filter((s) =>
      Object.entries(visibleColumns).some(([key, col]) =>
        col.visible && s[key] !== undefined && s[key] !== null && s[key] !== ''
      )
    )
    .filter((s) =>
      Object.entries(textColumnFilters).every(([key, filter]) => {
        const colType = visibleColumns[key]?.type;
        const conditions = filter?.conditions ?? [];
        const activeConditions = conditions.filter(({ operator, value }) =>
          ['blank', 'not_blank'].includes(operator) ||
          (value !== null && value !== undefined && value !== '')
        );
        if (activeConditions.length === 0) return true;
        const evaluateText = ({ operator, value }) => {
          const cellVal = (s[key] ?? '').toString().toLowerCase();
          const v = (value ?? '').toLowerCase();
          switch (operator) {
            case 'contains': return cellVal.includes(v);
            case 'not_contains': return !cellVal.includes(v);
            case 'equals': return cellVal === v;
            case 'not_equals': return cellVal !== v;
            case 'starts_with': return cellVal.startsWith(v);
            case 'ends_with': return cellVal.endsWith(v);
            case 'blank': return cellVal.trim() === '';
            case 'not_blank': return cellVal.trim() !== '';
            default: return true;
          }
        };
        const evaluateNumber = (cond) => {
          const rawValue = s[key];
          if (cond.operator === 'blank') return rawValue == null || rawValue === '';
          if (cond.operator === 'not_blank') return rawValue != null && rawValue !== '';
          if (rawValue == null || rawValue === '') return false;
          const numericValue = Number(rawValue);
          if (isNaN(numericValue)) return false;
          switch (cond.operator) {
            case 'equals': {
              const conditionValue = Number(cond.value);
              return !isNaN(conditionValue) && numericValue === conditionValue;
            }
            case 'not_equals': {
              const conditionValue = Number(cond.value);
              return !isNaN(conditionValue) && numericValue !== conditionValue;
            }
            case 'lt': {
              const conditionValue = Number(cond.value);
              return !isNaN(conditionValue) && numericValue < conditionValue;
            }
            case 'lte': {
              const conditionValue = Number(cond.value);
              return !isNaN(conditionValue) && numericValue <= conditionValue;
            }
            case 'gt': {
              const conditionValue = Number(cond.value);
              return !isNaN(conditionValue) && numericValue > conditionValue;
            }
            case 'gte': {
              const conditionValue = Number(cond.value);
              return !isNaN(conditionValue) && numericValue >= conditionValue;
            }
            case 'between': {
              const min = Number(cond.value?.min);
              const max = Number(cond.value?.max);
              return !isNaN(min) && !isNaN(max) && numericValue >= min && numericValue <= max;
            }
            default:
              return false;
          }
        };
        const isNumberType = ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric'].includes(colType);
        const evaluator = isNumberType ? evaluateNumber : evaluateText;
        let result = null;
        for (let i = 0; i < activeConditions.length; i++) {
          const cond = activeConditions[i];
          const condResult = evaluator(cond);
          if (result === null) {
            result = condResult;
          } else {
            const logic = cond.logic || 'AND';
            if (logic === 'AND') result = result && condResult;
            if (logic === 'OR') result = result || condResult;
          }
        }
        return result ?? true;
      })
    ), [stats, visibleColumns, textColumnFilters]);
  const filteredStats = useMemo(() => {
    if (!filterFrozen) return baseFilteredStats;
    return frozenRowIds.map(id => idToRow.get(id)).filter(Boolean);
  }, [filterFrozen, frozenRowIds, idToRow, baseFilteredStats]);
  const sortedStats = [...filteredStats].sort((a, b) => {
    const { key, direction } = sortConfig;
    const aVal = a[key];
    const bVal = b[key];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
  const jumpToTime = (t) => {
    videoRef.current.currentTime = t - 1;
  };
  const setFilterFrozenSafe = useCallback((next) => {
    if (next === true) {
      setFrozenRowIds(baseFilteredStats.map(r => r.id));
      setFilterFrozen(true);
    } else if (next === false) {
      setFilterFrozen(false);
    } else {
      setFilterFrozen(!!next);
    }
  }, [baseFilteredStats]);
  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    if (mins === 0) {
      return ms > 0 ? `${secs}.${String(ms).padStart(2, '0')}` : `${secs}`;
    } else {
      const paddedSecs = String(secs).padStart(2, '0');
      const msPart = ms > 0 ? `.${String(ms).padStart(2, '0')}` : '';
      return `${mins}:${paddedSecs}${msPart}`;
    }
  };
  const { registerToggle: _ } = useSidebar();
  const handleSidebarToggle = (value) => {
    setShowSidebar(value);
    const fire = () => {
      window.dispatchEvent(new Event('db_layout_change'));
      window.dispatchEvent(new Event('resize'));
    };
    requestAnimationFrame(() => fire());
    const el = sidebarRef.current;
    if (!el) return;
    const onEnd = (e) => {
      if (['width', 'transform', 'left'].includes(e.propertyName)) {
        requestAnimationFrame(() => fire());
        requestAnimationFrame(() => fire());
        el.removeEventListener('transitionend', onEnd);
      }
    };
    el.addEventListener('transitionend', onEnd);
  };
  if (isAppLoading) {
    return (
      <div className="flex flex-col h-[100svh] justify-center items-center">
        <div className="text-lg font-semibold mb-4">Loading...</div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  if (!isAppLoading && !teamId) {
    const isDemoOnly =
      availableTeams.length === 1 &&
      String(availableTeams[0]?.id) === DEMO_TEAM_ID;
    return (
      <div className="flex flex-col h-[100svh] justify-center items-center">
        {!isDemoOnly ? (
          !showCreateTeamCentered ? (
            <>
              <div className="text-lg font-semibold mb-4">Please select your team to begin</div>
              <StyledSelect
                options={teamOptions}
                value={teamId}
                onChange={(selected) => {
                  if (!selected) return;
                  if (selected.value === NEW_TEAM_VALUE) {
                    setShowCreateTeamCentered(true);
                  } else {
                    handleTeamChange({ target: { value: selected.value } });
                  }
                }}
                placeholder="Click here to select a team"
                showStatus={false}
              />
            </>
          ) : (
            <form onSubmit={onCreateTeamSubmit} className="w-full max-w-md text-center">
              <div className="text-lg font-semibold mb-2">Register a new team</div>
              <p className="text-sm text-gray-600 mb-6">
                Enter a team name and you can invite players right away.
              </p>
              <div className="mb-3">
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  placeholder="Enter a team name (e.g., Unprotected Sets)"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  disabled={creatingTeam}
                  autoFocus
                  required
                />
                {createError && (
                  <div className="text-left text-sm text-red-600 mt-1">{createError}</div>
                )}
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  type="submit"
                  disabled={creatingTeam}
                  className="px-4 py-2 rounded-md bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-default cursor-pointer"
                >
                  {creatingTeam ? 'Creating…' : 'Create your team'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateTeamCentered(false)}
                  className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100 cursor-pointer"
                >
                  Back
                </button>
              </div>
            </form>
          )
        ) : (
          <form onSubmit={onCreateTeamSubmit} className="w-full max-w-md text-center">
            <div className="text-lg font-semibold mb-2">Welcome!</div>
            <p className="text-sm text-gray-600 mb-6">
              You can explore the site's functionality via the Demo, or create a team to get started.
            </p>
            <div className="mb-3">
              <input
                type="text"
                className="w-full border rounded px-3 py-2"
                placeholder="Enter a team name (e.g., Unprotected Sets)"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                disabled={creatingTeam}
                autoFocus
                required
              />
              {createError && (
                <div className="text-left text-sm text-red-600 mt-1">{createError}</div>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                type="submit"
                disabled={creatingTeam}
                className="px-4 py-2 rounded-md bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-default cursor-pointer"
              >
                {creatingTeam ? 'Creating…' : 'Create your team'}
              </button>
              <button
                type="button"
                onClick={() => handleTeamChange({ target: { value: DEMO_TEAM_ID } })}
                className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-100 cursor-pointer"
              >
                Explore the Demo
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col h-[100svh] overflow-hidden">
      <div className="relative flex flex-1 overflow-hidden">
        {/* Mini rail */}
        <div
          className={`
            relative flex-shrink-0 overflow-hidden
            transition-[width]
            ${showSidebar ? isMobile ? 'w-12' : 'w-0' : 'w-12'}
          `}
        >
          {!showSidebar && (
            <MiniSidebar
              onExpand={() => handleSidebarToggle(true)}
              teamId={teamId}
              isMobile={isMobile}
            />
          )}
        </div>
        {/* Sliding full sidebar */}
        <div
          ref={sidebarRef}
          className={`
            bg-gray-100 border-r border-gray-300 z-20
            transform-gpu will-change-transform transition-transform ease-out
            ${isMobile
              ? `absolute top-0 left-0 h-full w-64
            transform-gpu will-change-transform transition-transform duration-300 ease-out ${showSidebar
                ? 'translate-x-0'
                : '-translate-x-[16.25rem] opacity-0 pointer-events-none'
              }`
              : `relative overflow-x-auto ${showSidebar ? 'w-64' : 'w-0'}`}
          `}
        >
          <div className="h-full flex flex-col">
            {/* Sidebar header */}
            <div className="flex items-center justify-between p-2">
              {/* Coffee link (opens in new tab) */}
              <a
                href="https://buymeacoffee.com/stephenmckeon"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-2 py-1 rounded-md text-sm font-medium hover:bg-gray-300/30 focus:outline-none focus:ring-2 focus:ring-greay-400 cursor-pointer"
                title="Buy me a coffee"
              >
                <span aria-hidden="true">☕ Buy me a coffee</span>
                <span className="hidden sm:inline">Buy me a coffee</span>
              </a>

              {/* Collapse button (existing) */}
              <button
                className="ml-auto p-1 hover:bg-gray-200 rounded cursor-pointer"
                onClick={() => handleSidebarToggle(false)}
                aria-label="Collapse sidebar"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" data-rtl-flip=""><path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z"></path></svg>
              </button>
            </div>
            <div className="h-px bg-gray-300 mx-2" />
            {sidebarContent ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col h-full">
                {sidebarContent}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col h-full">
                <label className="font-semibold block mb-1 text-gray-800">Team:</label>
                <StyledSelect
                  options={teamOptions}
                  value={teamId}
                  onChange={(selected) => {
                    if (!selected) return;
                    if (selected.value === NEW_TEAM_VALUE) {
                      setShowQuickCreate(true);
                      return;
                    }
                    handleTeamChange({ target: { value: selected.value } });
                  }}
                  placeholder="Select a team"
                  showStatus={false}
                />
                <div>
                  <label className={`font-semibold block mb-1 ${!selectedGameId ? "text-blue-700" : ""}`}>
                    {!selectedGameId ? "🎯 Select Game:" : "Select Game:"}
                  </label>
                  <GameSelector
                    key={teamName}
                    games={teamGames}
                    value={teamGames.some(g => g.id === selectedGameId) ? selectedGameId : null}
                    onChange={(selectedOption) => {
                      if (selectedOption.value === 'upload-new') {
                        handleOpenUploadModal();
                      } else {
                        setSelectedGameId(selectedOption.value);
                        const selectedGame = teamGames.find(g => g.id === selectedOption.value);
                        setSelectedVideo(selectedGame?.video_url || '');
                        setTimeout(() => {
                          videoRef.current?.focus();
                        }, 300);
                      }
                    }}
                    videoPlayerRef={videoPlayerRef}
                    teamName={teamName}
                    currentUserId={currentUserId}
                    isUploadModalOpen={isUploadModalOpen}
                    setIsUploadModalOpen={setIsUploadModalOpen}
                    hideUploadOption={teamId === DEMO_TEAM_ID}
                    teamId={teamId}
                    onRequestCreateFromLocal={onRequestCreateFromLocal}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Display Layout:</label>
                  <StyledSelect
                    options={[
                      { label: 'Stacked', value: 'stacked', color: 'orange' },
                      { label: 'Side-by-Side', value: 'side-by-side', color: 'purple' },
                    ]}
                    value={layoutMode}
                    onChange={(selected) => {
                      setLayoutMode(selected.value);
                      const ping = () => {
                        window.dispatchEvent(new Event('db_layout_change'));
                        window.dispatchEvent(new Event('resize'));
                      };
                      requestAnimationFrame(() => requestAnimationFrame(ping));
                      setTimeout(ping, 300);
                    }}
                    placeholder="Select layout"
                    showStatus={false}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Visible Columns:</label>
                  <ColumnSelector
                    columns={[
                      { key: 'timestamp', label: 'Timestamp' },
                      { key: 'set', label: 'Set' },
                      { key: 'rally_id', label: 'Rally' },
                      { key: 'player', label: 'Player' },
                      { key: 'action_type', label: 'Action Type' },
                      { key: 'quality', label: 'Quality' },
                      { key: 'set_to_player', label: 'Set To Player' },
                      { key: 'set_to_position', label: 'Set To Position' },
                      { key: 'result', label: 'Result' },
                      { key: 'score', label: 'Score' },
                      { key: 'notes', label: 'Notes' },
                    ]}
                    visibleColumns={visibleColumns}
                    toggleColumn={toggleColumn}
                  />
                </div>
                <div className="mt-auto p-4 space-y-4">
                  <button
                    onClick={handleEditModeToggle}
                    className={`w-full px-4 py-2 rounded-xl text-white font-semibold shadow-md transform cursor-pointer transition hover:scale-[1.03] ${editMode
                      ? 'bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800'
                      : 'bg-gradient-to-r from-green-500 to-green-700 hover:from-green-600 hover:to-green-800'
                      }`}
                  >
                    {editMode ? 'Exit Edit Mode' : 'Enter Edit Mode'}
                  </button>
                  <button
                    onClick={() => {
                      if (editMode) handleEditModeToggle();
                      navigate('stats/team');
                    }}
                    className="w-full px-4 py-2 cursor-pointer rounded-xl text-white font-semibold shadow-md transform transition hover:scale-[1.03] bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
                  >
                    Statistic Matrix
                  </button>
                </div>
              </div>
            )}
            <SidebarFooter teamId={teamId} isMobile={isMobile} DEMO_TEAM_ID={DEMO_TEAM_ID} />
          </div>
        </div>
        {/* Main content */}
        <div
          ref={mainContentRef}
          onPointerDown={handleMainInteract}
          onFocusCapture={handleMainInteract}
          className={`db-list-outer relative flex-1 overflow-y-auto overflow-x-auto transform-gpu will-change-transform transition-transform duration-300 ease-out
            ${editMode ? 'bg-yellow-50 transition-colors' : ''}`}
        >
          <div className="h-full">
            <Outlet
              context={{
                availableTeams,
                mainContentRef,
                DEMO_TEAM_ID,
                selectedVideo,
                selectedGameId,
                teamGames,
                layoutMode,
                editMode: editMode,
                isMobile,
                containerRef,
                videoRef,
                videoPlayerRef,
                stats,
                setStats,
                sortedStats,
                isFiltered,
                filterFrozen,
                visibleColumns,
                setFilterFrozenSafe,
                setSidebarContent,
                gamePlayers,
                sortConfig,
                setSortConfig,
                textColumnFilters,
                handleTextColumnFilterChange,
                jumpToTime,
                formatTimestamp,
                gameId,
                refreshGames,
                refreshStats,
                teamId,
                currentUserId,
                selectedGame: teamGames.find(g => String(g.id) === String(selectedGameId)),
              }}
            />
          </div>
        </div>
      </div>
      {/* Quick-create modal */}
      <Modal isOpen={showQuickCreate} onClose={() => setShowQuickCreate(false)}>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-2">Register new team</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!creatingQuickTeam) createTeamByName(quickTeamName);
            }}
          >
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              placeholder="Team name"
              value={quickTeamName}
              onChange={(e) => setQuickTeamName(e.target.value)}
              disabled={creatingQuickTeam}
              autoFocus
              required
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShowQuickCreate(false)}
                className="px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-100 cursor-pointer"
                disabled={creatingQuickTeam}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-black text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-default cursor-pointer"
                disabled={creatingQuickTeam || !quickTeamName.trim()}
              >
                {creatingQuickTeam ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </Modal>
      {/* Manage team */}
      <ManageTeamModal
        isOpen={showManageTeamModal}
        onClose={() => setShowManageTeamModal(false)}
        teamId={teamId}
        currentUserId={currentUserId}
        DEMO_TEAM_ID={DEMO_TEAM_ID}
        canManage={true}
      />
      {/* Upload modal */}
      <UploadGameModal
        ref={uploadModalRef}
        isOpen={isUploadModalOpen}
        setIsUploadModalOpen={setIsUploadModalOpen}
        onBeforeOpen={() => videoPlayerRef?.current?.closeControlsOverlay?.()}
        onClose={() => {
          setIsUploadModalOpen(false);
          firstAutoLoadRef.current = false;
        }}
        teamId={teamId}
        userId={currentUserId}
        availableTeams={availableTeams}
        onUpload={async (row) => {
          if (firstAutoLoadRef.current) {
            await refreshGames(teamId);
            return;
          }
          firstAutoLoadRef.current = true;
          const { data } = await refreshGames(teamId);
          const actual = (data || []).find(g => String(g.id) === String(row.id)) || row;
          setSelectedGameId(actual.id);
          if (row.localFile) {
            setSelectedVideo(row.localFile);
          } else {
            setSelectedVideo(actual.video_url || '');
          }
        }}
      />
    </div>
  );
};
export default MainPage;
