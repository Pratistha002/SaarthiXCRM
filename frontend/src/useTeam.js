import { useEffect, useState } from 'react';
import { api } from './api';

/** Workspace teammates, loaded once per page that needs an owner or assignee picker. */
export function useTeam() {
  const [members, setMembers] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    api('/api/team')
      .then((data) => {
        if (!alive) return;
        setMembers(data.members || []);
        setWorkspace(data.workspace || null);
        setIsAdmin(Boolean(data.youAreAdmin));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return { members, workspace, isAdmin };
}
