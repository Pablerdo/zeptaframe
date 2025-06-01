"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";
import { generationPrices } from "@/features/subscriptions/utils";

interface UserStatus {
  isAuthenticated: boolean;
  credits: number;
  userId?: string;
}

interface UserStatusContextType {
  userStatus: UserStatus;
  canGenerateVideo: () => boolean;
  canGenerateImage: () => boolean;
  hasEnoughCredits: (amount: number) => boolean;
  deductCredits: (amount: number) => void;
  refreshUsage: () => Promise<void>;
}

const defaultUserStatus: UserStatus = {
  isAuthenticated: false,
  credits: 0, // Start with 0 and fetch from DB
  userId: undefined
};

const UserStatusContext = createContext<UserStatusContextType | undefined>(undefined);

export function UserStatusProvider({ 
  children,
  initialUserStatus
}: { 
  children: ReactNode,
  initialUserStatus?: Partial<UserStatus>
}) {
  const [userStatus, setUserStatus] = useState<UserStatus>({
    ...defaultUserStatus,
    ...initialUserStatus
  });

  // Fetch current usage from API
  const refreshUsage = async () => {
    if (!userStatus.isAuthenticated || !userStatus.userId) return;
    
    try {
      const response = await fetch(`/api/users/${userStatus.userId}/credits`);
      if (response.ok) {
        const data = await response.json();
        setUserStatus(prev => ({
          ...prev,
          credits: data.credits || 0
        }));
      }
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
    }
  };


  // Fetch credits whenever the auth state changes (e.g., on login)
  useEffect(() => {
    if (initialUserStatus?.isAuthenticated && initialUserStatus?.userId) {
      setUserStatus(prev => ({
        ...prev,
        userId: initialUserStatus.userId
      }));
      refreshUsage();
    }
  }, [initialUserStatus?.isAuthenticated, initialUserStatus?.userId]);

  // Utility function to check if user has enough credits
  const hasEnoughCredits = (amount: number) => {
    return userStatus.credits >= amount;
  };

  // Check if user can generate video based on credits
  const canGenerateVideo = () => {
    if (!userStatus.isAuthenticated) return false;
    return hasEnoughCredits(generationPrices.normalVideoCredits);
  };

  // Check if user can generate image based on credits
  const canGenerateImage = () => {
    if (!userStatus.isAuthenticated) return false;
    return hasEnoughCredits(generationPrices.image);
  };

  // Deduct credits
  const deductCredits = (amount: number) => {
    if (!userStatus.isAuthenticated || !userStatus.userId) return;
    
    // Update state optimistically
    setUserStatus(prev => ({
      ...prev,
      credits: Math.max(0, prev.credits - amount)
    }));
    
    // Update credits in the database
    fetch(`/api/users/${userStatus.userId}/credits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'deduct', 
        amount 
      })
    })
    .then(response => {
      if (response.ok) {
        return response.json();
      }
      throw new Error('Failed to update credits');
    })
    .then(data => {
      // Sync with server value
      setUserStatus(prev => ({
        ...prev,
        credits: data.credits
      }));
    })
    .catch(error => {
      console.error("Failed to update credits:", error);
      // Refresh to get accurate count
      refreshUsage();
    });
  };

  return (
    <UserStatusContext.Provider value={{
      userStatus,
      canGenerateVideo,
      canGenerateImage,
      hasEnoughCredits,
      deductCredits,
      refreshUsage
    }}>
      {children}
    </UserStatusContext.Provider>
  );
}

export function useUserStatus() {
  const context = useContext(UserStatusContext);
  if (context === undefined) {
    throw new Error("useUserStatus must be used within a UserStatusProvider");
  }
  return context;
} 