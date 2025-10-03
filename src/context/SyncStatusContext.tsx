import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { syncService } from '@/services/syncService.js';
import { networkService } from '@/services/networkService.js';
import { orderRepo } from '@/data/orderRepo.js';

interface SyncStatusContextType {
  isAllSynced: boolean;
  triggerFullSync: () => Promise<void>;
  isSyncing: boolean;
}

const SyncStatusContext = createContext<SyncStatusContextType | undefined>(undefined);

export const useSyncStatus = () => {
  const context = useContext(SyncStatusContext);
  if (!context) {
    throw new Error('useSyncStatus must be used within a SyncStatusProvider');
  }
  return context;
};

interface SyncStatusProviderProps {
  children: ReactNode;
}

export const SyncStatusProvider: React.FC<SyncStatusProviderProps> = ({ children }) => {
  const [isAllSynced, setIsAllSynced] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Check sync status periodically
  useEffect(() => {
    const checkSyncStatus = () => {
      try {
        // Check if all orders are synced (no pending changes)
        const allOrders = orderRepo.getAllOrderRecords();
        const hasPendingChanges = Object.values(allOrders).some(order =>
          orderRepo.hasPendingChanges(parseInt(Object.keys(allOrders).find(key => allOrders[key] === order) || '0'))
        );
        const isOnline = networkService.isOnline();

        // All synced if online and no pending changes
        setIsAllSynced(isOnline && !hasPendingChanges);
      } catch (error) {
        console.error('[SyncStatusProvider] Error checking sync status:', error);
        // Default to not synced if there's an error
        setIsAllSynced(false);
      }
    };

    // Check immediately
    checkSyncStatus();

    // Check every 5 seconds
    const interval = setInterval(checkSyncStatus, 5000);

    return () => clearInterval(interval);
  }, []);

  const triggerFullSync = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    try {
      // Alle ausstehenden Deltas synchronisieren
      await syncService.syncAllPendingChanges();

      // Mark as synced after successful sync
      setIsAllSynced(true);
    } catch (error) {
      console.error('[SyncStatusProvider] Pending sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SyncStatusContext.Provider value={{
      isAllSynced,
      triggerFullSync,
      isSyncing
    }}>
      {children}
    </SyncStatusContext.Provider>
  );
};
