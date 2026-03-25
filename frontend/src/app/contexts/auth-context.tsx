import {
  createContext,
  ReactNode,
  useContext,
  useState,
} from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const AUTH_STORAGE_KEY = 'stem-boomerang-auth-user';

interface AuthContextType {
  isReady: boolean;
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem(AUTH_STORAGE_KEY);
  });

  const login = async (inputUsername: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: inputUsername,
        password,
      }),
    });

    if (!response.ok) {
      let detail = 'Login failed';
      try {
        const errorData = await response.json();
        if (typeof errorData?.detail === 'string') {
          detail = errorData.detail;
        }
      } catch {
        // Keep fallback.
      }
      throw new Error(detail);
    }

    const data = await response.json();
    window.localStorage.setItem(AUTH_STORAGE_KEY, data.username);
    setUsername(data.username);
  };

  const logout = () => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setUsername(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isReady: true,
        isAuthenticated: Boolean(username),
        username,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
