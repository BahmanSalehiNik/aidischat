import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface User {
  id: string;
  email: string;
  status?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  loadAuth: () => Promise<void>;
}

const TOKEN_KEY = '@auth_token';
const USER_KEY = '@auth_user';

export const useAuthStore = create<AuthState>((set: any, get: any) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (user: User, token: string) => {
    try {
      await AsyncStorage.multiSet([
        [TOKEN_KEY, token],
        [USER_KEY, JSON.stringify(user)],
      ]);
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      console.error('Error saving auth:', error);
    }
  },

  logout: async () => {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      set({ user: null, token: null, isAuthenticated: false });
    } catch (error) {
      console.error('Error logging out:', error);
    }
  },

  signOut: async () => {
    try {
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      set({ user: null, token: null, isAuthenticated: false });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  },

  loadAuth: async () => {
    try {
      const [token, userStr] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
      if (token[1] && userStr[1]) {
        const user = JSON.parse(userStr[1]);
        set({ user, token: token[1], isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error loading auth:', error);
      set({ isLoading: false });
    }
  },
}));

