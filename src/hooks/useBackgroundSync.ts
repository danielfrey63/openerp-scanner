import { useState, useEffect, useCallback } from 'react';
import { syncService, SyncResult, SyncConflict } from '@/services/syncService.js';
import { networkService } from '@/services/networkService.js';

export interface BackgroundSyncState {
  isSyncing: boolean;
  lastSyncTime: number;
  conflicts: SyncConflict[];
  syncResult: SyncResult | null;
  isOnline: boolean;
  queueStatus: {
    total: number;
    byPriority: {
      high: number;
      normal: number;
      low: number;
    };
    processing: boolean;
  };
}

export interface BackgroundSyncActions {
  triggerSync: (orderId?: number) => Promise<void>;
  resolveConflict: (conflictId: string, resolution: 'local' | 'server') => Promise<void>;
  clearSyncResult: () => void;
  enableAutoSync: () => void;
  disableAutoSync: () => void;
}

export function useBackgroundSync(): BackgroundSyncState & BackgroundSyncActions {
  const [state, setState] = useState<BackgroundSyncState>({
    isSyncing: false,
    lastSyncTime: syncService.getLastSyncTime(),
    conflicts: syncService.getConflicts(),
    syncResult: null,
    isOnline: networkService.getNetworkStatus().online,
    queueStatus: networkService.getQueueStatus()
  });

  // Removed autoSyncEnabled - no automatic sync anymore

  // Update state when sync status changes
  const updateState = useCallback(() => {
    setState(prev => ({
      ...prev,
      isSyncing: syncService.isSyncInProgress(),
      lastSyncTime: syncService.getLastSyncTime(),
      conflicts: syncService.getConflicts(),
      isOnline: networkService.getNetworkStatus().online,
      queueStatus: networkService.getQueueStatus()
    }));
  }, []);

  // Trigger manual sync
  const triggerSync = useCallback(async (orderId?: number) => {
    if (state.isSyncing) {
      console.log('[useBackgroundSync] Sync already in progress');
      return;
    }

    if (!state.isOnline) {
      console.log('[useBackgroundSync] Cannot sync while offline');
      return;
    }

    try {
      setState(prev => ({ ...prev, isSyncing: true, syncResult: null }));
      
      const result = await syncService.sync({ 
        orderId,
        resolveConflicts: 'manual' // Let user resolve conflicts manually
      });
      
      setState(prev => ({ 
        ...prev, 
        isSyncing: false, 
        syncResult: result,
        lastSyncTime: syncService.getLastSyncTime(),
        conflicts: syncService.getConflicts()
      }));

      console.log('[useBackgroundSync] Sync completed:', result);
    } catch (error) {
      console.error('[useBackgroundSync] Sync failed:', error);
      
      setState(prev => ({ 
        ...prev, 
        isSyncing: false,
        syncResult: {
          success: false,
          conflicts: [],
          syncedOrders: [],
          errors: [(error as Error).message],
          timestamp: Date.now()
        }
      }));
    }
  }, [state.isSyncing, state.isOnline]);

  // Resolve conflict
  const resolveConflict = useCallback(async (conflictId: string, resolution: 'local' | 'server') => {
    try {
      await syncService.resolveConflict(conflictId, resolution);
      
      setState(prev => ({
        ...prev,
        conflicts: syncService.getConflicts()
      }));

      console.log('[useBackgroundSync] Conflict resolved:', conflictId, resolution);
    } catch (error) {
      console.error('[useBackgroundSync] Failed to resolve conflict:', error);
    }
  }, []);

  // Clear sync result
  const clearSyncResult = useCallback(() => {
    setState(prev => ({ ...prev, syncResult: null }));
  }, []);

  // Auto-sync controls
  // Removed auto-sync enable/disable - no automatic sync anymore
  const enableAutoSync = useCallback(() => {
    console.log('[useBackgroundSync] Auto-sync is disabled in new workflow');
  }, []);

  const disableAutoSync = useCallback(() => {
    console.log('[useBackgroundSync] Auto-sync is disabled in new workflow');
  }, []);

  // Setup event listeners and periodic sync check
  useEffect(() => {
    // Listen for network status changes (without auto-sync)
    const unsubscribeNetwork = networkService.addNetworkListener((status) => {
      setState(prev => ({
        ...prev,
        isOnline: status.online,
        queueStatus: networkService.getQueueStatus()
      }));
    });

    // ENTFERNT: Automatisches Polling - nur noch manuelle Synchronisation

    // Listen for service worker sync events
    const handleSyncComplete = (event: CustomEvent) => {
      console.log('[useBackgroundSync] Service worker sync completed:', event.detail);
      updateState();
    };

    window.addEventListener('sw-sync-complete', handleSyncComplete as EventListener);

    // Periodic state updates
    const interval = setInterval(updateState, 5000);

    // Remove the old auto-sync interval - now handled by periodic sync check above

    return () => {
      unsubscribeNetwork();
      window.removeEventListener('sw-sync-complete', handleSyncComplete as EventListener);
      clearInterval(interval);
    };
  }, [updateState]);

  // Register background sync when service worker is available
  useEffect(() => {
    const registerBackgroundSync = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;

          // Background sync would be registered here
          console.log('[useBackgroundSync] Service worker ready:', registration);

          console.log('[useBackgroundSync] Background sync would be registered');
        } catch (error) {
          console.error('[useBackgroundSync] Failed to register background sync:', error);
        }
      }
    };

    registerBackgroundSync();
  }, []);

  // ENTFERNT: Automatische Sync bei Visibility-Change - nur noch manuelle Synchronisation

  return {
    ...state,
    triggerSync,
    resolveConflict,
    clearSyncResult,
    enableAutoSync,
    disableAutoSync
  };
}

// Hook for order-specific sync
export function useOrderSync(orderId: number) {
  const backgroundSync = useBackgroundSync();

  const triggerOrderSync = useCallback(() => {
    return backgroundSync.triggerSync(orderId);
  }, [backgroundSync.triggerSync, orderId]);

  const orderConflicts = backgroundSync.conflicts.filter(
    conflict => conflict.orderId === orderId
  );

  return {
    ...backgroundSync,
    triggerOrderSync,
    orderConflicts,
    hasOrderConflicts: orderConflicts.length > 0
  };
}

// Hook for sync status display
export function useSyncStatus() {
  const { isSyncing, lastSyncTime, conflicts, isOnline, queueStatus } = useBackgroundSync();

  const getSyncStatusText = useCallback(() => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Synchronisiere...';
    if (conflicts.length > 0) return `${conflicts.length} Konflikte`;
    if (queueStatus.total > 0) return `${queueStatus.total} ausstehend`;
    return 'Synchronisiert';
  }, [isOnline, isSyncing, conflicts.length, queueStatus.total]);

  const getSyncStatusColor = useCallback(() => {
    if (!isOnline) return '#ff4757'; // Red
    if (isSyncing) return '#3742fa'; // Blue
    if (conflicts.length > 0) return '#ff6b6b'; // Light red
    if (queueStatus.total > 0) return '#ffa502'; // Orange
    return '#2ed573'; // Green
  }, [isOnline, isSyncing, conflicts.length, queueStatus.total]);

  const getLastSyncText = useCallback(() => {
    if (!lastSyncTime) return 'Nie synchronisiert';
    
    const now = Date.now();
    const diffMs = now - lastSyncTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 1) return 'Gerade synchronisiert';
    if (diffMinutes < 60) return `Vor ${diffMinutes} Min.`;
    if (diffHours < 24) return `Vor ${diffHours} Std.`;
    
    const lastSync = new Date(lastSyncTime);
    return lastSync.toLocaleDateString('de-DE');
  }, [lastSyncTime]);

  return {
    isSyncing,
    isOnline,
    hasConflicts: conflicts.length > 0,
    hasPendingOperations: queueStatus.total > 0,
    statusText: getSyncStatusText(),
    statusColor: getSyncStatusColor(),
    lastSyncText: getLastSyncText(),
    conflictCount: conflicts.length,
    pendingCount: queueStatus.total
  };
}
