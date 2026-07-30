import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiUrl } from '../utils/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true
      }),

      logout: async () => {
        try {
          await fetch(apiUrl('/auth/logout'), {
            method: 'POST',
            credentials: 'include'
          });
        } catch (error) {
          console.error('Logout request failed:', error);
        } finally {
          set({
            user: null,
            token: null,
            isAuthenticated: false
          });
        }
      },

      refreshToken: async () => {
        try {
          const response = await fetch(apiUrl('/auth/refresh'), {
            method: 'POST',
            credentials: 'include'
          });
          const data = await response.json();
          if (response.ok && data.success && data.token) {
            set({
              user: data.user,
              token: data.token,
              isAuthenticated: true
            });
            return data.token;
          } else {
            set({ user: null, token: null, isAuthenticated: false });
            return null;
          }
        } catch (error) {
          console.error("Token refresh failed:", error);
          set({ user: null, token: null, isAuthenticated: false });
          return null;
        }
      },

      checkAuth: async () => {
        const token = get().token;

        if (!token) {
          // Attempt silent refresh via httpOnly cookie if state token is missing
          await get().refreshToken();
          return;
        }

        try {
          const response = await fetch(apiUrl('/auth/verify'), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
          });

          const data = await response.json();

          // If token expired, attempt automatic refresh
          if (!data.success) {
            await get().refreshToken();
          }
        } catch (error) {
          console.error("Auth check failed:", error);
          await get().refreshToken();
        }
      },

      setLastActiveBusinessId: async (businessId, businessName = null) => {
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                lastActiveBusinessId: businessId,
                lastActiveBusinessName: businessName
              }
            : null
        }));

        const token = get().token;
        if (!token) return;

        try {
          const response = await fetch(apiUrl('/settings/active-business'), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ businessId }),
            credentials: 'include'
          });

          if (!response.ok) {
            console.error("Failed to sync lastActiveBusinessId with database");
          }
        } catch (error) {
          console.error("API error syncing lastActiveBusinessId:", error);
        }
      },

      updateUser: (userData) => set((state) => ({
        user: { ...state.user, ...userData }
      })),
    }),
    {
      name: 'auth-storage',
    }
  )
);

export default useAuthStore;