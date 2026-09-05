import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface StoredUser extends User {
  password: string;
}

const DEFAULT_USERS: StoredUser[] = [
  {
    id: 'usr_admin',
    name: 'Fleet Admin',
    email: 'admin@fleet.com',
    password: 'admin123',
    role: 'admin',
  },
  {
    id: 'usr_operator',
    name: 'Operator',
    email: 'user@fleet.com',
    password: 'user123',
    role: 'user',
  },
];

interface AuthStore {
  isAuthenticated: boolean;
  currentUser: User | null;
  users: StoredUser[];

  login: (email: string, password: string) => { success: boolean; error?: string };
  signup: (name: string, email: string, password: string) => { success: boolean; error?: string };
  addAdmin: (name: string, email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      currentUser: null,
      users: DEFAULT_USERS,

      login: (email, password) => {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPassword = password || '';
        const allUsers = get().users || [];
        const found = allUsers.find(
          (u) => u.email.trim().toLowerCase() === cleanEmail && u.password === cleanPassword,
        );

        if (!found) {
          return { success: false, error: 'Invalid email or password' };
        }

        const user: User = {
          id: found.id,
          name: found.name,
          email: found.email,
          role: found.role,
        };

        set({ isAuthenticated: true, currentUser: user });
        return { success: true };
      },

      signup: (name, email, password) => {
        const cleanName = (name || '').trim();
        const cleanEmail = (email || '').trim().toLowerCase();

        if (!cleanName || !cleanEmail || !password) {
          return { success: false, error: 'All fields are required' };
        }

        const allUsers = get().users || [];
        const exists = allUsers.some((u) => u.email.trim().toLowerCase() === cleanEmail);
        if (exists) {
          return { success: false, error: 'An account with this email already exists' };
        }

        const newUser: StoredUser = {
          id: `usr_${Date.now()}`,
          name: cleanName,
          email: cleanEmail,
          password,
          role: 'user', // Always user for normal signup
        };

        const userPublic: User = {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        };

        set((state) => ({
          users: [...(state.users || []), newUser],
          isAuthenticated: true,
          currentUser: userPublic,
        }));

        return { success: true };
      },

      addAdmin: (name, email, password) => {
        const current = get().currentUser;
        if (!current || current.role !== 'admin') {
          return { success: false, error: 'Unauthorized: Admin privileges required' };
        }

        const cleanName = (name || '').trim();
        const cleanEmail = (email || '').trim().toLowerCase();

        if (!cleanName || !cleanEmail || !password) {
          return { success: false, error: 'All fields are required' };
        }

        const allUsers = get().users || [];
        const exists = allUsers.some((u) => u.email.trim().toLowerCase() === cleanEmail);
        if (exists) {
          return { success: false, error: 'An account with this email already exists' };
        }

        const newAdmin: StoredUser = {
          id: `usr_admin_${Date.now()}`,
          name: cleanName,
          email: cleanEmail,
          password,
          role: 'admin',
        };

        set((state) => ({
          users: [...(state.users || []), newAdmin],
        }));

        return { success: true };
      },

      logout: () => {
        set({ isAuthenticated: false, currentUser: null });
      },
    }),
    {
      name: 'edge-fleet-auth',
      storage: createJSONStorage(() => sessionStorage),
      merge: (persistedState, currentState) => {
        const pState = persistedState as Partial<AuthStore> | undefined;
        const storedUsers = pState?.users || [];

        // Safely merge DEFAULT_USERS and stored users without duplicates
        const userMap = new Map<string, StoredUser>();
        for (const u of DEFAULT_USERS) {
          userMap.set(u.email.trim().toLowerCase(), u);
        }
        for (const u of storedUsers) {
          if (u && u.email) {
            userMap.set(u.email.trim().toLowerCase(), u);
          }
        }

        return {
          ...currentState,
          ...pState,
          users: Array.from(userMap.values()),
        };
      },
    },
  ),
);
