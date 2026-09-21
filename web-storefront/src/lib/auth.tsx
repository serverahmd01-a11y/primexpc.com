import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, cartApi } from '@/lib/api';
import { signUp, login as gaLogin } from '@/lib/analytics';

type User = {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'ca' | 'shipping';
  imageUrl?: string;
};

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isStaff: boolean;
  isCA: boolean;
  isShipping: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

function getGuestId() {
  let id = localStorage.getItem('primex_guest_id');
  if (!id) {
    id = 'guest_' + crypto.randomUUID();
    localStorage.setItem('primex_guest_id', id);
  }
  return id;
}

function getGuestCart() {
  try {
    const raw = localStorage.getItem('primex_cart_v1');
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function mergeGuestCartToServer(token: string) {
  const guestId = localStorage.getItem('primex_guest_id');
  const guestItems = getGuestCart();
  if (!guestId || guestItems.length === 0) return;

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  try {
    for (const item of guestItems) {
      const res = await fetch(`${baseUrl}/cart`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-guest-id': guestId,
        },
        body: JSON.stringify({ productId: item.productId || item.slug, quantity: item.qty }),
      });
      if (!res.ok) throw new Error('guest cart sync failed');
    }
    const mergeRes = await fetch(`${baseUrl}/cart/merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ guestId }),
    });
    if (!mergeRes.ok) throw new Error('cart merge failed');
    localStorage.removeItem('primex_guest_id');
    localStorage.removeItem('primex_cart_v1');
  } catch {
    // non-critical, guest cart just won't merge
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const onExpired = () => {
      localStorage.removeItem('primex_token');
      localStorage.removeItem('primex_user');
      setToken(null);
      setUser(null);
      navigate('/auth');
    };
    window.addEventListener('primex-auth-expired', onExpired);
    return () => window.removeEventListener('primex-auth-expired', onExpired);
  }, [navigate]);

  useEffect(() => {
    const savedToken = localStorage.getItem('primex_token');
    const savedUser = localStorage.getItem('primex_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setUser(JSON.parse(savedUser)); } catch { localStorage.removeItem('primex_user'); }
      authApi.me()
        .then((data) => {
          if (data.user) {
            localStorage.setItem('primex_user', JSON.stringify(data.user));
            setUser(data.user);
          }
        })
        .catch(() => {
          localStorage.removeItem('primex_token');
          localStorage.removeItem('primex_user');
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    localStorage.setItem('primex_token', data.token);
    localStorage.setItem('primex_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    gaLogin();
    await mergeGuestCartToServer(data.token);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await authApi.register({ name, email, password });
    localStorage.setItem('primex_token', data.token);
    localStorage.setItem('primex_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    signUp();
    await mergeGuestCartToServer(data.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('primex_token');
    localStorage.removeItem('primex_user');
    setToken(null);
    setUser(null);
    window.dispatchEvent(new Event('primex-logout'));
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    user, token, loading,
    login, register, logout,
    isAdmin: user?.role === 'admin',
    isStaff: ['admin', 'ca', 'shipping'].includes(user?.role || ''),
    isCA: user?.role === 'ca',
    isShipping: user?.role === 'shipping',
  }), [user, token, loading, login, register, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
