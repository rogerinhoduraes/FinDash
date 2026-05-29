import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

const useFinanceStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      privacyMode: false,

      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'dark' ? 'light' : 'dark'
          applyTheme(next)
          return { theme: next }
        }),
      togglePrivacy: () => set((s) => ({ privacyMode: !s.privacyMode })),
    }),
    {
      name: 'findash-prefs',
      partialize: (s) => ({ theme: s.theme, privacyMode: s.privacyMode }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme ?? 'dark')
      },
    }
  )
)

export default useFinanceStore
