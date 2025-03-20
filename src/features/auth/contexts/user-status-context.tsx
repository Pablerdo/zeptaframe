"use client";

import { createContext, useContext, ReactNode, useState, useEffect } from "react";

export type UserPlan = "trial" | "free" | "pro";

interface UserStatus {
  isAuthenticated: boolean;
  userPlan: UserPlan;
  dailyVideoGenerations: {
    limit: number;
    used: number;
    remaining: number;
  };
  dailyImageGenerations: {
    limit: number;
    used: number;
    remaining: number;
  };
}

interface UserStatusContextType {
  userStatus: UserStatus;
  canGenerateVideo: () => boolean;
  canGenerateImage: () => boolean;
  incrementVideoUsage: () => void;
  incrementImageUsage: () => void;
  refreshUsage: () => Promise<void>;
}

const defaultUserStatus: UserStatus = {
  isAuthenticated: false,
  userPlan: "trial",
  dailyVideoGenerations: {
    limit: 0,
    used: 0,
    remaining: 0
  },
  dailyImageGenerations: {
    limit: 0,
    used: 0,
    remaining: 0
  }
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

  // Set plan-specific limits when plan changes
  useEffect(() => {
    if (userStatus.userPlan === "trial") {
      setUserStatus(prev => ({
        ...prev,
        dailyVideoGenerations: {
          limit: 0,
          used: 0,
          remaining: 0
        },
        dailyImageGenerations: {
          limit: 0,
          used: 0,
          remaining: 0
        }
      }));
    } else if (userStatus.userPlan === "free") {
      // Update limits for free plan
      setUserStatus(prev => ({
        ...prev,
        dailyVideoGenerations: {
          limit: 3,
          used: prev.dailyVideoGenerations.used,
          remaining: 3 - prev.dailyVideoGenerations.used
        },
        dailyImageGenerations: {
          limit: 5,
          used: prev.dailyImageGenerations.used,
          remaining: 5 - prev.dailyImageGenerations.used
        }
      }));
    } else if (userStatus.userPlan === "pro") {
      // For pro, we could either set a high number or keep track differently
      setUserStatus(prev => ({
        ...prev,
        dailyVideoGenerations: {
          limit: 30,
          used: prev.dailyVideoGenerations.used,
          remaining: 30 - prev.dailyVideoGenerations.used
        },
        dailyImageGenerations: {
          limit: 30,
          used: prev.dailyImageGenerations.used,
          remaining: 30 - prev.dailyImageGenerations.used
        }
      }));
    }
  }, [userStatus.userPlan]);

  // Fetch current usage from API
  const refreshUsage = async () => {
    if (!userStatus.isAuthenticated) return;
    
    try {
      const response = await fetch('/api/user/usage');
      if (response.ok) {
        const data = await response.json();
        setUserStatus(prev => ({
          ...prev,
          dailyVideoGenerations: {
            ...prev.dailyVideoGenerations,
            used: data.videoGenerationsUsed,
            remaining: prev.dailyVideoGenerations.limit - data.videoGenerationsUsed
          },
          dailyImageGenerations: {
            ...prev.dailyImageGenerations,
            used: data.imageGenerationsUsed,
            remaining: prev.dailyImageGenerations.limit - data.imageGenerationsUsed
          }
        }));
      }
    } catch (error) {
      console.error("Failed to fetch usage data:", error);
    }
  };

  // Utility function to check if user can generate video
  const canGenerateVideo = () => {
    if (userStatus.userPlan === "trial") return false;
    return userStatus.dailyVideoGenerations.remaining > 0;
  };

  // Utility function to check if user can generate image
  const canGenerateImage = () => {
    if (userStatus.userPlan === "trial") return false;
    return userStatus.dailyImageGenerations.remaining > 0;
  };

  // Increment video usage
  const incrementVideoUsage = () => {
    if (!userStatus.isAuthenticated) return;
    
    setUserStatus(prev => ({
      ...prev,
      dailyVideoGenerations: {
        ...prev.dailyVideoGenerations,
        used: prev.dailyVideoGenerations.used + 1,
        remaining: prev.dailyVideoGenerations.remaining - 1
      }
    }));
  };

  // Increment image usage
  const incrementImageUsage = () => {
    if (!userStatus.isAuthenticated) return;
    
    setUserStatus(prev => ({
      ...prev,
      dailyImageGenerations: {
        ...prev.dailyImageGenerations,
        used: prev.dailyImageGenerations.used + 1,
        remaining: prev.dailyImageGenerations.remaining - 1
      }
    }));
  };

  return (
    <UserStatusContext.Provider value={{
      userStatus,
      canGenerateVideo,
      canGenerateImage,
      incrementVideoUsage,
      incrementImageUsage,
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