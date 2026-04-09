import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sa_user")); }
    catch { return null; }
  });

  const login = (tokenResponse) => {
    localStorage.setItem("sa_token", tokenResponse.access_token);
    const u = { id: tokenResponse.user_id, name: tokenResponse.name, role: tokenResponse.role };
    localStorage.setItem("sa_user", JSON.stringify(u));
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem("sa_token");
    localStorage.removeItem("sa_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
