import { create } from "zustand";

type CreditsSuccessModalState = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export const useCreditsSuccessModal = create<CreditsSuccessModalState>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
})); 