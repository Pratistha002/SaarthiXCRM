import { createContext, useContext, useMemo, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sx_user') || 'null');
    } catch {
      return null;
    }
  });

  const value = useMemo(() => ({
    user,
    save(auth) {
      localStorage.setItem('sx_token', auth.token);
      localStorage.setItem('sx_user', JSON.stringify(auth.user));
      setUser(auth.user);
    },
    logout() {
      localStorage.removeItem('sx_token');
      localStorage.removeItem('sx_user');
      setUser(null);
    },
    updateUser(next) {
      localStorage.setItem('sx_user', JSON.stringify(next));
      setUser(next);
    },
  }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
