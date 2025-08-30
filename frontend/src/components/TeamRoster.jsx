import { useEffect, useState, useCallback } from 'react';
import { fetchTeamMembers, fetchTeamInvites } from '../utils/supabaseTeamClient';
export function TeamRoster(supabase, teamId) {
  const [members, setMembers] = useState(null);
  const [invites, setInvites] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const refresh = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [m, i] = await Promise.all([
        fetchTeamMembers(supabase, teamId),
        fetchTeamInvites(supabase, teamId),
      ]);
      setMembers(m);
      setInvites(i);
    } catch (e) {
      setErrorMsg(e?.message ?? 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [supabase, teamId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { members, invites, loading, errorMsg, refresh };
}
