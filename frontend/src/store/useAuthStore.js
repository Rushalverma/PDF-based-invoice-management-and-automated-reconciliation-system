import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiUrl } from '../utils/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null, // ? user is { id, email, username }
      token: null,
      isAuthenticated: false,


      // Call this after a successful login API request
      login: (user, token) => set({
        user,
        token,
        isAuthenticated: true
      }),

      // Call this when the user clicks logout or token expires
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false
      }),


      checkAuth: async () => {
        const token = get().token;

        if (!token) return; // No token to verify

        try {
          // ! hardcoded api path
          const response = await fetch(apiUrl('/auth/verify'), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          const data = await response.json();

          // If backend says token is expired or invalid, log the user out
          if (!data.success) {
            set({ user: null, token: null, isAuthenticated: false });
          }
        } catch (error) {
          // If server is down, handle gracefully (optional)
          console.error("Auth check failed:", error);
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
            body: JSON.stringify({ businessId })
          });

          if (!response.ok) {
            console.error("Failed to sync lastActiveBusinessId with database");
          }
        } catch (error) {
          console.error("API error syncing lastActiveBusinessId:", error);
        }
      },


      // Optional: Update specific user fields later (e.g., profile update)
      updateUser: (userData) => set((state) => ({
        user: { ...state.user, ...userData }
      })),
    }),
    {
      name: 'auth-storage', // store details under this in localStorage
    }
  )
);

export default useAuthStore;