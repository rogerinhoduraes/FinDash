import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useFinanceStore = create(
  persist(
    (set) => ({
      user: null,
      theme: 'dark',
      sidebarCollapsed: false,

      setUser: (user) => set({ user }),
      setTheme: (theme) => {
        set({ theme })
        document.documentElement.classList.toggle('dark', theme === 'dark')
      },
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'dark' ? 'light' : 'dark'
          document.documentElement.classList.toggle('dark', next === 'dark')
          return { theme: next }
        }),
    }),
    {
      name: 'findash-prefs',
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    }
  )
)

export default useFinanceStore
