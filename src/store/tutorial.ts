import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TutorialStore {
  hasSeenOnboarding: boolean
  isOpen:            boolean
  startStep:         number

  openTutorial:        (step?: number) => void
  closeTutorial:       () => void
  markOnboardingDone:  () => void
}

export const useTutorialStore = create<TutorialStore>()(
  persist(
    (set) => ({
      hasSeenOnboarding: false,
      isOpen:            false,
      startStep:         0,

      openTutorial:  (step = 0) => set({ isOpen: true, startStep: step }),
      closeTutorial: ()         => set({ isOpen: false }),
      markOnboardingDone: ()    => set({ hasSeenOnboarding: true, isOpen: false }),
    }),
    {
      name:        'excursus-tutorial',
      // só persiste o flag de onboarding — estado de UI não precisa sobreviver
      partialize:  s => ({ hasSeenOnboarding: s.hasSeenOnboarding }),
    }
  )
)
