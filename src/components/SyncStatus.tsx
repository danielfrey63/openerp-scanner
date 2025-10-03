import React, { useState, useEffect } from 'react';
import { orderRepo } from '@/data/orderRepo.js';

interface SyncStatusProps {
  className?: string;
  orderId?: number;
  compact?: boolean;
}

interface SyncState {
  hasPendingUpdates: boolean;
  pendingCount: number;
  lastSyncTime: string | null;
  isOnline: boolean;
  isSyncing: boolean;
}

const SyncStatus: React.FC<SyncStatusProps> = ({ 
  className = '', 
  orderId,
  compact = false 
}) => {
  const [syncState, setSyncState] = useState<SyncState>({
    hasPendingUpdates: false,
    pendingCount: 0,
    lastSyncTime: null,
    isOnline: navigator.onLine,
    isSyncing: false
  });

  useEffect(() => {
    const updateSyncState = () => {
      let hasPendingUpdates = false;
      let pendingCount = 0;
      let lastSyncTime: string | null = null;

      if (orderId) {
        // Check specific order
        const pendingUpdates = orderRepo.getPendingProductUpdates(orderId);
        const orderData = orderRepo.getOrder(orderId);
        
        hasPendingUpdates = pendingUpdates.length > 0;
        pendingCount = pendingUpdates.length;
        lastSyncTime = orderData?.meta.lastSyncedAt || null;
      } else {
        // Check all orders
        const allOrders = orderRepo.getAllOrderRecords();
        
        Object.values(allOrders).forEach(order => {
          if (order.pending?.productUpdates?.length) {
            hasPendingUpdates = true;
            pendingCount += order.pending.productUpdates.length;
          }
          
          if (order.meta.lastSyncedAt && (!lastSyncTime || order.meta.lastSyncedAt > lastSyncTime)) {
            lastSyncTime = order.meta.lastSyncedAt;
          }
        });
      }

      setSyncState(prev => ({
        ...prev,
        hasPendingUpdates,
        pendingCount,
        lastSyncTime,
        isOnline: navigator.onLine
      }));
    };

    // Initial update
    updateSyncState();

    // Listen for order changes
    const unsubscribe = orderId
      ? orderRepo.subscribeOrder(orderId, updateSyncState)
      : null;

    // Listen for network changes
    const handleOnline = () => setSyncState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setSyncState(prev => ({ ...prev, isOnline: false }));
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen for service worker sync events
    const handleSyncComplete = () => {
      setSyncState(prev => ({ ...prev, isSyncing: false }));
      updateSyncState();
    };

    window.addEventListener('sw-sync-complete', handleSyncComplete as EventListener);

    // Periodic update
    const interval = setInterval(updateSyncState, 5000);

    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sw-sync-complete', handleSyncComplete as EventListener);
      clearInterval(interval);
    };
  }, [orderId]);

  const getStatusColor = () => {
    if (!syncState.isOnline) return '#ff4757'; // Red for offline
    if (syncState.isSyncing) return '#3742fa'; // Blue for syncing
    if (syncState.hasPendingUpdates) return '#ffa502'; // Orange for pending
    return '#2ed573'; // Green for synced
  };

  const getStatusIcon = () => {
    if (!syncState.isOnline) return '📡';
    if (syncState.isSyncing) return '🔄';
    if (syncState.hasPendingUpdates) return '⏳';
    return '✅';
  };

  const getStatusText = () => {
    if (!syncState.isOnline) return 'Offline';
    if (syncState.isSyncing) return 'Synchronisiere...';
    if (syncState.hasPendingUpdates) {
      return compact 
        ? `${syncState.pendingCount} ausstehend`
        : `${syncState.pendingCount} Änderung${syncState.pendingCount !== 1 ? 'en' : ''} ausstehend`;
    }
    return 'Synchronisiert';
  };

  const getLastSyncText = () => {
    if (!syncState.lastSyncTime) return 'Nie synchronisiert';
    
    const lastSync = new Date(syncState.lastSyncTime);
    const now = new Date();
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Gerade synchronisiert';
    if (diffMinutes < 60) return `Vor ${diffMinutes} Min.`;
    if (diffHours < 24) return `Vor ${diffHours} Std.`;
    if (diffDays < 7) return `Vor ${diffDays} Tag${diffDays !== 1 ? 'en' : ''}`;
    
    return lastSync.toLocaleDateString('de-DE');
  };

  const handleManualSync = async () => {
    if (!syncState.isOnline || syncState.isSyncing) return;

    setSyncState(prev => ({ ...prev, isSyncing: true }));

    try {
      // Trigger background sync via service worker
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        // Background sync would be implemented here
        console.log('Background sync would be triggered for registration:', registration);
      }
      
      // Fallback: manual sync logic here
      console.log('Manual sync triggered');
      
      // Simulate sync delay
      setTimeout(() => {
        setSyncState(prev => ({ ...prev, isSyncing: false }));
      }, 2000);
    } catch (error) {
      console.error('Manual sync failed:', error);
      setSyncState(prev => ({ ...prev, isSyncing: false }));
    }
  };

  if (compact) {
    return (
      <div 
        className={`sync-status-compact ${className}`}
        onClick={handleManualSync}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          borderRadius: '12px',
          backgroundColor: getStatusColor(),
          color: 'white',
          fontSize: '12px',
          fontWeight: '500',
          cursor: syncState.isOnline && !syncState.isSyncing ? 'pointer' : 'default',
          transition: 'all 0.3s ease'
        }}
      >
        <span style={{ fontSize: '14px' }}>{getStatusIcon()}</span>
        <span>{getStatusText()}</span>
        {syncState.isSyncing && (
          <div style={{
            width: '10px',
            height: '10px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderTop: '1px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        )}
      </div>
    );
  }

  return (
    <div 
      className={`sync-status ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px',
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        border: `2px solid ${getStatusColor()}`,
        color: 'white'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>{getStatusIcon()}</span>
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px' }}>
            {getStatusText()}
          </div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>
            {getLastSyncText()}
          </div>
        </div>
        
        {syncState.isOnline && !syncState.isSyncing && (
          <button
            onClick={handleManualSync}
            style={{
              marginLeft: 'auto',
              padding: '6px 12px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            Sync
          </button>
        )}
      </div>

      {syncState.hasPendingUpdates && (
        <div style={{ 
          fontSize: '12px', 
          opacity: 0.9,
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {syncState.pendingCount} Änderung{syncState.pendingCount !== 1 ? 'en' : ''} warten auf Synchronisation
        </div>
      )}

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SyncStatus;
