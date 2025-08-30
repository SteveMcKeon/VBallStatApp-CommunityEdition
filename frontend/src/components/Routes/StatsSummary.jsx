import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import '../../App.css';
import StyledSelect from '../StyledSelect';
import ColumnSelector from '../ColumnSelector';
import { api, op } from '../../utils/postgrest';
const StatsSummary = ({ onBack, setSidebarContent: setSidebarContentProp }) => {
  const navigate = useNavigate();
  const { setSidebarContent: setSidebarFromCtx, teamId: ctxTeamId, gameId: ctxGameId, availableTeams, displayNamesById } = useOutletContext() || {};
  const setSidebarContent = setSidebarContentProp ?? setSidebarFromCtx ?? (() => { });
  const [teamId, setTeamId] = useState(ctxTeamId ? String(ctxTeamId) : '');
  const [selectedGame, setSelectedGame] = useState(ctxGameId || 'scored');
  const setLocal = (key, value) => localStorage.setItem(key, value);
  const getLocal = (key) => localStorage.getItem(key);
  const [actions, setActions] = useState([]);
  const [tableStats, setTableStats] = useState([]);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [selectedSet, setSelectedSet] = useState('all');
  const [assistData, setAssistData] = useState({});
  const [settingStats, setSettingStats] = useState([]);
  const [selectedSetter, setSelectedSetter] = useState('all');
  const filteredSettingStats = selectedSetter === 'all'
    ? settingStats
    : settingStats.filter(stat => stat.player === selectedSetter);
  const nameFor = useCallback(
    (id, fallback) => (displayNamesById?.[String(id)] || fallback || ''),
    [displayNamesById]
  );
  const NavToHome = useCallback(() => {
    if (typeof onBack === 'function') onBack();
    else navigate('/');
  }, [onBack, navigate]);
  useEffect(() => {
    if (isStatsLoading) return;
    const unique = Array.from(
      new Set(tableStats.map(s => s.action_type).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
    setActions(unique);
  }, [tableStats, isStatsLoading]);
  useEffect(() => {
    let alive = true;
    const fetchGames = async () => {
      if (!teamId) return;
      try {
        const rows = await api.get('games', {
          team_id: op.eq(teamId),
          select: 'id,title,isscored,date,processed',
          order: 'date.desc',
        });
        if (!alive) return;
        setGames(rows || []);
        setSelectedGame('scored');
      } catch (error) {
        console.error('Error fetching games:', error);
      }
    };
    fetchGames();
    return () => { alive = false; };
  }, [teamId]);
  useEffect(() => {
    let alive = true;
    const fetchStats = async () => {
      setIsStatsLoading(true);
      if (!selectedGame || !teamId) {
        if (alive) setIsStatsLoading(false);
        return;
      }
      try {
        let gameIds = [];
        if (selectedGame === 'all' || selectedGame === 'scored') {
          const params = {
            team_id: op.eq(teamId),
            select: 'id',
            order: 'date.desc',
          };
          if (selectedGame === 'scored') params.isscored = op.isTrue();
          const gamesData = await api.get('games', params);
          gameIds = (gamesData || []).map(g => g.id);
        } else {
          gameIds = [selectedGame];
        }
        if (gameIds.length === 0) {
          if (alive) {
            setTableStats([]);
            setAssistData({});
            setSettingStats([]);
            setIsStatsLoading(false);
          }
          return;
        }
        const statParams = {
          game_id: op.in(gameIds),
          select: '*',
          order: 'import_seq.asc',
        };
        if (selectedSet !== 'all') statParams.set = op.eq(selectedSet);
        const data = await api.get('stats', statParams);
        if (alive) {
          const namedStats = (data || [])
            .filter(stat => stat.player !== null)
            .filter(stat => String(stat.team_id) === String(teamId))
            .sort((a, b) =>
              String(a.game_id).localeCompare(String(b.game_id)) ||
              Number(a.set ?? 0) - Number(b.set ?? 0) ||
              Number(a.import_seq ?? 0) - Number(b.import_seq ?? 0) ||
              String(a.id).localeCompare(String(b.id))
            )
            .map(s => ({
              ...s,
              player: nameFor(s.player_user_id, s.player),
              set_to_player: nameFor(s.set_to_user_id, s.set_to_player),
            }));
          setTableStats(namedStats);
          const assistCounts = {};
          const relevantGames = (selectedGame === 'all' || selectedGame === 'scored') ? gameIds : [selectedGame];
          relevantGames.forEach(gid => {
            const gameStats = namedStats
              .filter(stat => stat.game_id === gid)
              .sort((a, b) => Number(a.import_seq ?? 0) - Number(b.import_seq ?? 0));
            for (let i = 0; i < gameStats.length - 1; i++) {
              const curr = gameStats[i];
              const next = gameStats[i + 1];
              if (
                String(curr.action_type).toLowerCase() === 'set' &&
                curr.player &&
                next && curr.rally_id === next.rally_id &&
                String(next.result).toLowerCase() === 'won point'
              ) {
                const key = nameFor(curr.player_user_id, curr.player);
                assistCounts[key] = (assistCounts[key] || 0) + 1;
              }
            }
          });
          setAssistData(assistCounts);
          const settingOnly = namedStats.filter(stat => stat.set_to_position || stat.set_to_player);
          setSettingStats(settingOnly);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
        if (alive) setTableStats([]);
      } finally {
        if (alive) setIsStatsLoading(false);
      }
    };
    fetchStats();
    return () => { alive = false; };
  }, [selectedGame, selectedSet, teamId, games]);
  const [visibleColumns, setVisibleColumns] = useState({});
  const allColumns = useMemo(
    () => actions.map(action => ({ key: action, label: action })),
    [actions]
  );
  useEffect(() => {
    const saved = getLocal('visibleColumnsStatsPage');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setVisibleColumns(parsed);
      } catch (err) {
        console.warn('Failed to parse visibleColumnsStatsPage:', err);
      }
    }
  }, []);
  useEffect(() => {
    if (allColumns.length === 0) return;
    setVisibleColumns(prev => {
      const defaultHidden = ['Success', 'Fail', 'Pass', 'Dig'];
      const updated = { ...prev };
      allColumns.forEach(col => {
        if (updated[col.key] === undefined) {
          updated[col.key] = { visible: !defaultHidden.includes(col.key) };
        }
      });
      return updated;
    });
  }, [allColumns]);
  useEffect(() => {
    if (Object.keys(visibleColumns).length > 0) {
      setLocal('visibleColumnsStatsPage', JSON.stringify(visibleColumns));
    }
  }, [visibleColumns]);
  const toggleColumn = useCallback((key) => {
    setVisibleColumns(prev => ({
      ...prev,
      [key]: { visible: !prev[key]?.visible }
    }));
  }, []);
  const allSubColumns = useMemo(() => ([
    { key: 'Qty', label: 'Qty', title: 'Number of touches' },
    { key: 'Avg', label: 'Avg', title: 'Average quality', disabled: selectedGame === 'all' },
    { key: 'Success', label: '✓', title: 'Percentage of touches that won a point' },
    { key: 'Assists', label: 'Assists', title: 'Touch led to a point via teammate', actionOnly: 'Set' },
    { key: 'Fail', label: '✗', title: 'Percentage of touches that lost a point' },
  ]), [selectedGame]);
  const [visibleSubColumns, setVisibleSubColumns] = useState(() => {
    const saved = getLocal('visibleSubColumnsStatsPage');
    let initial = {};
    allSubColumns.forEach(col => {
      const defaultHidden = ['Success', 'Fail'];
      initial[col.key] = { visible: !defaultHidden.includes(col.key) };
    });
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(key => {
          if (initial[key] !== undefined) {
            initial[key] = parsed[key];
          }
        });
      } catch (err) {
        console.warn('Failed to parse visibleSubColumnsStatsPage:', err);
      }
    }
    return initial;
  });
  useEffect(() => {
    setVisibleSubColumns(prev => {
      const newState = { ...prev };
      if (selectedGame === 'all') {
        if (newState['Avg']?.visible) {
          newState['Avg'].visible = false;
        }
      } else {
        if (newState['Avg'] && !newState['Avg'].visible) {
          newState['Avg'].visible = true;
        }
      }
      return newState;
    });
  }, [selectedGame]);
  useEffect(() => {
    setLocal('visibleSubColumnsStatsPage', JSON.stringify(visibleSubColumns));
  }, [visibleSubColumns]);
  const toggleSubColumn = useCallback((key) => {
    setVisibleSubColumns(prev => ({
      ...prev,
      [key]: { visible: !prev[key]?.visible }
    }));
  }, []);
  const countOccurrences = (arr, key) => {
    return arr.reduce((acc, item) => {
      const k = item[key];
      if (!k) return acc;
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
  };
  const calculatePercentages = (counts, total) => {
    return Object.entries(counts).map(([key, count]) => ({
      key,
      count,
      percent: total ? ((count / total) * 100).toFixed(1) + '%' : '0.0%',
    }));
  };
  const grouped = tableStats.reduce((acc, s) => {
    if (!s.action_type) return acc;
    const groupLabel = s.player;
    const { action_type, quality, result } = s;
    if (!acc[groupLabel]) acc[groupLabel] = {};
    if (!acc[groupLabel][action_type]) {
      acc[groupLabel][action_type] = { qualities: [], won: 0, lost: 0 };
    }
    acc[groupLabel][action_type].qualities.push(Number(quality));
    if (result === 'Won Point') acc[groupLabel][action_type].won += 1;
    if (result === 'Lost Point') acc[groupLabel][action_type].lost += 1;
    return acc;
  }, {});
  const players = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  const actionTotals = actions.reduce((acc, action) => {
    let qty = 0;
    let sumQuality = 0;
    let won = 0;
    let lost = 0;
    players.forEach(player => {
      const stat = grouped[player]?.[action];
      if (stat) {
        qty += stat.qualities.length;
        sumQuality += stat.qualities.reduce((a, b) => a + b, 0);
        won += stat.won || 0;
        lost += stat.lost || 0;
      }
    });
    const avg = qty ? (sumQuality / qty).toFixed(2) : '-';
    const success = qty ? ((won / qty) * 100).toFixed(1) + '%' : '';
    const fail = qty ? ((lost / qty) * 100).toFixed(1) + '%' : '';
    acc[action] = { qty, avg, success, fail };
    return acc;
  }, {});
  const grandTotals = Object.values(actionTotals).reduce(
    (acc, val) => {
      acc.qty += val.qty || 0;
      acc.sum += parseFloat(val.avg) * (val.qty || 0) || 0;
      acc.won += parseInt(val.success) * (val.qty || 0) / 100 || 0;
      acc.lost += parseInt(val.fail) * (val.qty || 0) / 100 || 0;
      return acc;
    },
    { qty: 0, sum: 0, won: 0, lost: 0 }
  );
  const totalAvg2 = grandTotals.qty ? (grandTotals.sum / grandTotals.qty).toFixed(2) : '-';
  const totalSuccess2 = grandTotals.qty ? ((grandTotals.won / grandTotals.qty) * 100).toFixed(1) + '%' : '';
  const totalFail2 = grandTotals.qty ? ((grandTotals.lost / grandTotals.qty) * 100).toFixed(1) + '%' : '';
  const teamOptions = useMemo(
    () => (availableTeams ?? []).map(t => ({ label: t.name, value: String(t.id) })),
    [availableTeams]
  );
  const renderSidebar = useCallback(() => (
    <div className="space-y-4 flex flex-col h-full">
      <div>
        <label className="font-semibold block mb-1">Team:</label>
        <StyledSelect
          options={teamOptions}
          value={teamId}
          onChange={(opt) => setTeamId(opt?.value ?? '')}
          placeholder="Select a team"
          showStatus={false}
        />
      </div>
      <div>
        <label className="font-semibold block mb-1">Select Game:</label>
        <StyledSelect
          key={`team|${teamId}`}
          options={[
            { value: 'all', label: 'All Games' },
            { value: 'scored', label: 'All Scored Games' },
            ...((games ?? [])
              .sort((a, b) => new Date(b.date) - new Date(a.date))
              .map((game) => ({
                value: game.id,
                label: game.title,
                color: game.isscored ? 'green' : 'red',
                tooltip: game.isscored ? 'Scored' : 'Not yet scored',
              }))),
          ]}
          value={selectedGame}
          onChange={(selected) => setSelectedGame(selected?.value || 'all')}
          placeholder="Select a game"
          showStatus={true}
          showTooltip={true}
        />
      </div>
      {selectedGame && (
        <div>
          <label className="font-semibold block mb-1">Select Set:</label>
          <StyledSelect
            options={[
              { value: 'all', label: 'All Sets' },
              { value: '1', label: 'Set 1' },
              { value: '2', label: 'Set 2' },
              { value: '3', label: 'Set 3' },
            ]}
            value={selectedSet}
            onChange={(selected) => setSelectedSet(selected?.value || 'scored')}
            placeholder="Select Set"
            showStatus={false}
          />
        </div>
      )}
      <div>
        <label className="font-semibold block mb-1">Visible Columns:</label>
        <ColumnSelector
          columns={allColumns}
          visibleColumns={visibleColumns}
          toggleColumn={toggleColumn}
        />
      </div>
      <div>
        <label className="font-semibold block mb-1">Visible SubColumns:</label>
        <ColumnSelector
          columns={allSubColumns}
          visibleColumns={visibleSubColumns}
          toggleColumn={toggleSubColumn}
        />
      </div>
      <div className="mt-auto p-4 space-y-4">
        <button
          onClick={NavToHome}
          className="w-full px-4 py-2 cursor-pointer rounded-xl text-white font-semibold shadow-md transform transition hover:scale-[1.03] bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800"
        >
          Return to Home
        </button>
      </div>
    </div>
  ), [
    teamId,
    teamOptions,
    selectedGame,
    selectedSet,
    games,
    allColumns,
    visibleColumns,
    allSubColumns,
    visibleSubColumns,
    toggleColumn,
    toggleSubColumn,
    NavToHome
  ]);
  useEffect(() => {
    setSidebarContent(renderSidebar());
    return () => setSidebarContent(null);
  }, [setSidebarContent, renderSidebar]);
  return (
    <div className="flex flex-col min-h-full">
      {/* Main Content */}
      <div className="flex-1 p-4 relative min-h-[60vh]">
        {/* Loader overlay */}
        {isStatsLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mr-3"></div>
            <span className="text-sm text-gray-600">Loading stats…</span>
          </div>
        )}
        {/* Content (only after everything is ready) */}
        {!isStatsLoading && (
          <>
            <div className="inline-block" key={`team|${teamId}`}>
              <table className="text-center table-auto inline-table w-auto max-w-fit">
                <thead>
                  <tr>
                    <th className="bg-white"></th>
                    {actions.filter(action => visibleColumns[action]?.visible).map(action => {
                      const subColSpan = allSubColumns.filter(
                        sub =>
                          visibleSubColumns[sub.key]?.visible &&
                          (!sub.actionOnly || sub.actionOnly === action)
                      ).length;
                      if (subColSpan === 0) return null;
                      return (
                        <th key={action} colSpan={subColSpan} className="p-1 font-semibold border border-black bg-gray-100">
                          {action}
                        </th>
                      );
                    })}
                    <th colSpan="4" className="bg-gray-100 border-black border-l-2 border-t-2 border-r-2 p-1 font-semibold ">Total</th>
                  </tr>
                  <tr>
                    <th className="bg-white"></th>
                    {actions
                      .filter(action => visibleColumns[action]?.visible)
                      .flatMap(action => {
                        const subs = allSubColumns
                          .filter(sub => visibleSubColumns[sub.key]?.visible && (!sub.actionOnly || sub.actionOnly === action));
                        return subs.map((sub, i) => (
                          <th
                            key={`${action}-${sub.key}`}
                            className={`border border-black bg-gray-100 p-1 text-xs border-x-1`}
                            title={sub.title}
                          >
                            {sub.label}
                          </th>
                        ));
                      })
                    }
                    {allSubColumns
                      .filter(
                        sub => visibleSubColumns[sub.key] && !sub.actionOnly
                      )
                      .map((sub, i, arr) => (
                        <th
                          key={`total-${sub.key}`}
                          className={`border border-black bg-gray-100 border-l-1 p-1 text-xs ${i === 0 ? 'border-l-2' : ''
                            } ${i === arr.length - 1 ? 'border-r-2' : ''}`}
                          title={sub.title}
                        >
                          {sub.label}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((player, index) => {
                    const isLastRow = index === players.length - 1;
                    const totals = Object.values(grouped[player] || {}).flatMap(obj => obj.qualities);
                    const totalQty = totals.length;
                    const totalAvg = totalQty ? (totals.reduce((a, b) => a + b, 0) / totalQty).toFixed(2) : '-';
                    const totalWon = Object.values(grouped[player] || {}).reduce((acc, obj) => acc + (obj.won || 0), 0);
                    const totalLost = Object.values(grouped[player] || {}).reduce((acc, obj) => acc + (obj.lost || 0), 0);
                    const rawTotalSuccess = totalQty ? ((totalWon / totalQty) * 100).toFixed(1) : null;
                    const rawTotalFail = totalQty ? ((totalLost / totalQty) * 100).toFixed(1) : null;
                    const totalSuccess = rawTotalSuccess && rawTotalSuccess !== '0.0' ? `${rawTotalSuccess}%` : '-';
                    const totalFail = rawTotalFail && rawTotalFail !== '0.0' ? `${rawTotalFail}%` : '-';
                    return (
                      <tr key={player}>
                        <td className="border p-1 bg-gray-200 font-semibold whitespace-nowrap">{player}</td>
                        {actions.filter(action => visibleColumns[action]?.visible).map(action => {
                          const actionStats = grouped[player]?.[action];
                          const qty = actionStats?.qualities.length ?? 0;
                          const avg = qty ? (actionStats.qualities.reduce((a, b) => a + b, 0) / qty).toFixed(2) : '-';
                          const rawSuccess = qty ? ((actionStats.won / qty) * 100).toFixed(1) : null;
                          const rawFail = qty ? ((actionStats.lost / qty) * 100).toFixed(1) : null;
                          const success = rawSuccess && rawSuccess !== '0.0' ? `${rawSuccess}%` : '-';
                          const fail = rawFail && rawFail !== '0.0' ? `${rawFail}%` : '-';
                          return (
                            <React.Fragment key={action}>
                              {allSubColumns
                                .filter(sub => visibleSubColumns[sub.key]?.visible && (!sub.actionOnly || sub.actionOnly === action))
                                .map((sub, i) => {
                                  let value = '-';
                                  if (sub.key === 'Qty') value = qty || '-';
                                  else if (sub.key === 'Avg') value = avg;
                                  else if (sub.key === 'Success') value = success;
                                  else if (sub.key === 'Fail') value = fail;
                                  else if (sub.key === 'Assists') {
                                    value = assistData?.[player] || 0;
                                  }
                                  const colorClass =
                                    sub.key === 'Success' && value !== '-' ? 'text-green-600' :
                                      sub.key === 'Assists' && value !== '-' ? 'text-green-600' :
                                        sub.key === 'Fail' && value !== '-' ? 'text-red-600' :
                                          '';
                                  return (
                                    <td
                                      key={`${action}-${sub.key}`}
                                      className={`border border-black p-1 ${colorClass} ${i === 0 ? 'border-l-1' : ''}`}
                                    >
                                      {value}
                                    </td>
                                  );
                                })}
                            </React.Fragment>
                          );
                        })}
                        <td className={`border border-l-2 p-1 font-semibold ${isLastRow ? 'border-b-2' : ''}`}>{totalQty}</td>
                        <td className={`border p-1 font-semibold ${isLastRow ? 'border-b-2' : ''}`}>{totalAvg}</td>
                        <td className={`border p-1 border-black text-green-600 font-semibold ${isLastRow ? 'border-b-2' : ''}`}>{totalSuccess}</td>
                        <td className={`border border-black text-red-600 border-r-2 p-1 font-semibold ${isLastRow ? 'border-b-2' : ''}`}>{totalFail}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-2 font-semibold">
                    <td className="border bg-gray-200 p-1 text-center">Total</td>
                    {actions.filter(action => visibleColumns[action]?.visible).map(action => {
                      const totals = actionTotals[action];
                      return (
                        <React.Fragment key={action}>
                          {allSubColumns
                            .filter(sub => visibleSubColumns[sub.key]?.visible && (!sub.actionOnly || sub.actionOnly === action))
                            .map((sub, i) => {
                              let value = '-';
                              if (sub.key === 'Qty') value = totals.qty || '-';
                              else if (sub.key === 'Avg') value = totals.avg;
                              else if (sub.key === 'Success') value = totals.success;
                              else if (sub.key === 'Fail') value = totals.fail;
                              else if (sub.key === 'Assists') value = Object.values(assistData).reduce((a, b) => a + b, 0);
                              const colorClass =
                                sub.key === 'Success' && value !== '-' ? 'text-green-600' :
                                  sub.key === 'Assists' && value !== '-' ? 'text-green-600' :
                                    sub.key === 'Fail' && value !== '-' ? 'text-red-600' :
                                      '';
                              return (
                                <td
                                  key={`${action}-${sub.key}`}
                                  className={`border border-black p-1 ${colorClass} ${i === 0 ? 'border-l-2' : ''}`}
                                >
                                  {value}
                                </td>
                              );
                            })
                          }
                        </React.Fragment>
                      );
                    })}
                    <td className="border border-l-2 p-1">{grandTotals.qty}</td>
                    <td className="border p-1">{totalAvg2}</td>
                    <td className="border border-black p-1 text-green-600">{totalSuccess2}</td>
                    <td className="border border-black border-r-2 p-1 text-red-600">{totalFail2}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {/* Setting Statistics / Distribution (render only when not loading) */}
            {settingStats.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold mb-2">Setting Statistics — Who Got Set?</h3>
                <div className="mb-4">
                  <label className="font-semibold block mb-1">Filter by Setter:</label>
                  <select
                    value={selectedSetter}
                    onChange={(e) => setSelectedSetter(e.target.value)}
                    className="border p-2 max-w-xs bg-gray-100"
                  >
                    <option value="all">All Setters</option>
                    {[...new Set(settingStats.map(s => s.player))]
                      .sort((a, b) => a.localeCompare(b))
                      .map((setter) => (
                        <option key={setter} value={setter}>
                          {setter}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="flex  flex-wrap gap-8">
                  <div>
                    <h4 className="font-semibold mb-1">{'By Position'}</h4>
                    <table className="text-center table-auto border-collapse mb-4">
                      <thead>
                        <tr>
                          <th className="p-1 font-semibold border border-black bg-gray-100">Position</th>
                          <th className="p-1 font-semibold border border-black bg-gray-100">Qty</th>
                          <th className="p-1 font-semibold border border-black bg-gray-100">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {['Power', 'Middle', 'Opposite', 'Backrow'].map(pos => {
                          const percentages = calculatePercentages(countOccurrences(filteredSettingStats, 'set_to_position'), filteredSettingStats.length)
                          const row = percentages.find(p => p.key === pos);
                          return row ? (
                            <tr key={row.key}>
                              <td className="border border-black p-1">{row.key}</td>
                              <td className="border border-black p-1">{row.count}</td>
                              <td className="border border-black p-1">{row.percent}</td>
                            </tr>
                          ) : null;
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">By Player</h4>
                    <table className="text-center table-auto border-collapse">
                      <thead>
                        <tr>
                          <th className="p-1 font-semibold border border-black bg-gray-100">Player</th>
                          <th className="p-1 font-semibold border border-black bg-gray-100">Qty</th>
                          <th className="p-1 font-semibold border border-black bg-gray-100">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {calculatePercentages(countOccurrences(filteredSettingStats, 'set_to_player'), filteredSettingStats.length)
                          .sort((a, b) => a.key.localeCompare(b.key))
                          .map(row => (
                            <tr key={row.key}>
                              <td className="border border-black p-1">{row.key}</td>
                              <td className="border border-black p-1">{row.count}</td>
                              <td className="border border-black p-1">{row.percent}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div >
  );
};
export default StatsSummary;
