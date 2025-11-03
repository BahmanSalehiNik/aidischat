import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { authApi, ApiError } from '../utils/api';

export const useAuth = () => {
  const { setAuth, logout, isAuthenticated, user, token } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.signIn(email, password);
      
      // Backend now returns token in response body for mobile clients
      const token = (response as any).token;
      const user = {
        id: (response as any).id || (response as any)._id,
        email: (response as any).email,
        status: (response as any).status,
      };
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      await setAuth(user, token);
      return { success: true };
    } catch (err) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || 'Failed to sign in';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await authApi.signUp(email, password);
      
      // Backend now returns token in response body for mobile clients
      const token = (response as any).token;
      const user = {
        id: (response as any).id || (response as any)._id,
        email: (response as any).email,
        status: (response as any).status,
      };
      
      if (!token) {
        throw new Error('No token received from server');
      }
      
      await setAuth(user, token);
      return { success: true };
    } catch (err) {
      const apiError = err as ApiError;
      const errorMessage = apiError.message || 'Failed to sign up';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await logout();
  };

  return {
    signIn,
    signUp,
    signOut,
    error,
    loading,
    isAuthenticated,
    user,
    token,
  };
};

