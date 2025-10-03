import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { networkService } from '@/services/networkService.js';

interface OfflineAwareContextType {
  isOfflineMode: boolean;
  offlineQueueSize: number;
  forceOfflineMode: () => void;
  forceOnlineMode: () => void;
  clearOfflineQueue: () => void;
}

const OfflineAwareContext = createContext<OfflineAwareContextType | undefined>(undefined);

export const useOfflineAware = () => {
  const context = useContext(OfflineAwareContext);
  if (!context) {
    throw new Error('useOfflineAware must be used within an OfflineAwareProvider');
  }
  return context;
};

interface OfflineAwareProviderProps {
  children: ReactNode;
}

export const OfflineAwareProvider: React.FC<OfflineAwareProviderProps> = ({ children }) => {
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineQueueSize, setOfflineQueueSize] = useState(0);
  
  useEffect(() => {
    const updateOfflineStatus = () => {
      const isOnline = networkService.isOnline();
      const queueStatus = networkService.getQueueStatus();
      
      setIsOfflineMode(!isOnline || queueStatus.total > 0);
      setOfflineQueueSize(queueStatus.total);
    };
    
    const unsubscribe = networkService.addNetworkListener(updateOfflineStatus);
    updateOfflineStatus();
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);
  
  const forceOfflineMode = () => {
    setIsOfflineMode(true);
    localStorage.setItem('forceOfflineMode', 'true');
  };
  
  const forceOnlineMode = () => {
    setIsOfflineMode(false);
    localStorage.removeItem('forceOfflineMode');
  };
  
  const clearOfflineQueue = () => {
    networkService.clearQueue();
    setOfflineQueueSize(0);
  };
  
  return (
    <OfflineAwareContext.Provider value={{
      isOfflineMode,
      offlineQueueSize,
      forceOfflineMode,
      forceOnlineMode,
      clearOfflineQueue
    }}>
      {children}
    </OfflineAwareContext.Provider>
  );
};