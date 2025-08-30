import { useEffect, useState } from 'react';
import Modal from './Modal';
import Toast from './Toast';
import { api, op } from '../utils/postgrest';
const DEMO_CAPTAIN_ID = 'demo-uid-1';
export default function ManageTeamModal({
  isOpen,
  onClose,
  teamId,
  currentUserId,
  canManage = false,
  embedded = false,
  DEMO_TEAM_ID,
}) {
  const isDemoTeam = teamId === DEMO_TEAM_ID;
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('error');
  const [showToast, setShowToast] = useState(false);
  const setToast = (message, type = 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
  };
  const [teamName, setTeamName] = useState('');
  const [captainId, setCaptainId] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [confirmDeleteTeam, setConfirmDeleteTeam] = useState(false);
  const setToastSafe = (msg, type = 'error') => { try { setToast(msg, type); } catch { } };
  const handleDeleteTeam = async () => {
    if (!teamId) return;
    if (isDemoTeam) {
      setToast("You can't delete the Demo team.", 'error');
      setConfirmDeleteTeam(false);
      return;
    }
    try {
      await api.del('stats', { team_id: op.eq(teamId) });
      await api.del('games', { team_id: op.eq(teamId) });
      await api.del('team_members', { team_id: op.eq(teamId) });
      await api.del('teams', { id: op.eq(teamId) });
      setToast('Team deleted', 'success');
      setConfirmDeleteTeam(false);
      onClose?.();
      window.location.reload();
    } catch (e) {
      setToastSafe(e?.message || 'Failed to delete team');
    }
  };
  const fetchTeam = async () => {
    if (!teamId) return;
    if (isDemoTeam) {
      setTeamName('Demo');
      setCaptainId(DEMO_CAPTAIN_ID);
      return;
    }
    try {
      const rows = await api.get('teams', { id: op.eq(teamId), select: 'name,captain_id', limit: '1' });
      const row = rows?.[0];
      if (row) {
        setTeamName(row.name || '');
        setCaptainId(row.captain_id || null);
      }
    } catch (e) {
      setToastSafe(e?.message || 'Failed to load team');
    }
  };
  const saveTeamName = async () => {
    setSavingName(true);
    try {
      if (isDemoTeam) return;
      await api.patch('teams', { id: op.eq(teamId) }, { name: teamName });
      window.dispatchEvent(new CustomEvent('team_renamed', {
        detail: { id: teamId, name: teamName }
      }));
      setToast('Team name saved', 'success');
    } catch (e) {
      setToastSafe(e?.message || 'Failed to save team name');
    } finally {
      setSavingName(false);
    }
  };

  const actuallyOpen = embedded ? true : isOpen;
  useEffect(() => {
    if (!actuallyOpen) return;
    fetchTeam();
  }, [actuallyOpen, teamId, isDemoTeam]);
  const body = (
    <>
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">{canManage ? 'Manage Team' : 'My Team'}</h2>
        <p className="text-sm text-gray-600">
          {canManage ? 'Invite players, rename your team, and set member roles.' : 'View your team roster and roles.'}
        </p>
      </div>
      {/* Team name */}
      <div className="mt-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">Team name</label>
        {canManage ? (
          <div className="flex gap-2">
            <input
              className="flex-1 border rounded-md px-3 py-2"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Team name"
            />
            <button
              onClick={saveTeamName}
              disabled={!teamName || savingName}
              className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
            >
              Save
            </button>
          </div>
        ) : (
          <div className="px-3 py-2 border rounded-md bg-gray-50 text-gray-700">
            {teamName || '—'}
          </div>
        )}
      </div>
      {/* Danger zone: delete team */}
      {canManage && currentUserId === captainId && !isDemoTeam && (
        <div className="mt-8 pt-4 border-t flex items-center justify-between">
          <div>
            <div className="font-medium text-gray-700">Delete team</div>
            <div className="text-xs text-gray-500">
              Permanently removes the team and all of its data.<br />This cannot be undone.
            </div>
          </div>
          <button
            onClick={() => setConfirmDeleteTeam(true)}
            className="px-4 py-2 rounded-full border border-red-500 text-red-600 hover:bg-red-50 cursor-pointer"
            type="button"
          >
            Delete
          </button>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button onClick={onClose} className="px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 cursor-pointer">
          Done
        </button>
      </div>
      {confirmDeleteTeam && (
        <Modal isOpen onClose={() => setConfirmDeleteTeam(false)}>
          <div className="text-left">
            <h3 className="text-lg font-semibold mb-2">Delete team?</h3>
            <p className="text-sm text-gray-600">
              This will permanently delete <b>{teamName || 'this team'}</b> and all stats, games, and invites.
              This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteTeam(false)}
                className="px-4 py-2 rounded-md border hover:bg-gray-50 cursor-pointer"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeam}
                className="px-4 py-2 rounded-md border border-red-500 text-red-600 hover:bg-red-50 cursor-pointer"
                type="button"
              >
                Delete team
              </button>
            </div>
          </div>
        </Modal>
      )}

      <Toast message={toastMessage} show={showToast} onClose={() => setShowToast(false)} type={toastType} />
    </>
  );

  if (embedded) {
    return <div className="max-w-2xl pr-2">{body}</div>;
  }
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {body}
    </Modal>
  );
}
