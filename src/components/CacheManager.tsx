import React, { useState, useEffect } from 'react';
import { orderRepo } from '@/data/orderRepo.js';
import { syncService } from '@/services/syncService.js';
import { networkService } from '@/services/networkService.js';

interface CacheInfo {
  totalOrders: number;
  syncedOrders: number;
  pendingChanges: number;
  cacheSize: string;
  lastSyncTime: string | null;
}

const CacheManager: React.FC = () => {
  const [cacheInfo, setCacheInfo] = useState<CacheInfo>({
    totalOrders: 0,
    syncedOrders: 0,
    pendingChanges: 0,
    cacheSize: '0 MB',
    lastSyncTime: null
  });
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const updateCacheInfo = () => {
      const allOrders = orderRepo.getAllOrderRecords();
      const syncedCount = Object.values(allOrders).filter(
        order => order.meta.syncStatus === 'synced'
      ).length;
      
      let pendingCount = 0;
      let latestSyncTime: string | null = null;
      
      Object.values(allOrders).forEach(order => {
        pendingCount += orderRepo.getPendingChangesCount(parseInt(Object.keys(allOrders).find(key => allOrders[key] === order) || '0'));
        
        if (order.meta.lastSyncedAt) {
          if (!latestSyncTime || new Date(order.meta.lastSyncedAt) > new Date(latestSyncTime)) {
            latestSyncTime = order.meta.lastSyncedAt;
          }
        }
      });
      
      // Cache-Größe schätzen
      const cacheKeys = Object.keys(localStorage).filter(key => key.startsWith('erp_cache_order_'));
      let totalSize = 0;
      
      for (const key of cacheKeys) {
        const value = localStorage.getItem(key);
        if (value) {
          totalSize += new Blob([value]).size;
        }
      }
      
      setCacheInfo({
        totalOrders: Object.keys(allOrders).length,
        syncedOrders: syncedCount,
        pendingChanges: pendingCount,
        cacheSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
        lastSyncTime: latestSyncTime
      });
    };
    
    updateCacheInfo();
    const interval = setInterval(updateCacheInfo, 5000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleClearCache = async () => {
    if (!confirm('Sind Sie sicher, dass Sie den gesamten Cache löschen möchten? Alle lokalen Daten gehen verloren.')) {
      return;
    }
    
    setIsClearing(true);
    
    try {
      // Nur Order-Cache löschen, nicht die Session-Daten
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('erp_cache_order_')) {
          localStorage.removeItem(key);
        }
      });
      
      // Nutzungstracking löschen
      localStorage.removeItem('orderUsage');
      
      // Cache-Info aktualisieren
      setCacheInfo({
        totalOrders: 0,
        syncedOrders: 0,
        pendingChanges: 0,
        cacheSize: '0 MB',
        lastSyncTime: null
      });
      
      alert('Cache erfolgreich gelöscht. Die App wird neu geladen.');
      window.location.reload();
    } catch (error) {
      console.error('Fehler beim Löschen des Cache:', error);
      alert('Fehler beim Löschen des Cache: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    } finally {
      setIsClearing(false);
    }
  };
  
  const handleRefreshCache = async () => {
    if (!networkService.isOnline()) {
      alert('Keine Netzwerkverbindung verfügbar. Bitte stellen Sie eine Verbindung her.');
      return;
    }
    
    setIsRefreshing(true);
    
    try {
      await syncService.syncAllPendingChanges();
      
      // Cache-Info aktualisieren
      const allOrders = orderRepo.getAllOrderRecords();
      const syncedCount = Object.values(allOrders).filter(
        order => order.meta.syncStatus === 'synced'
      ).length;
      
      setCacheInfo(prev => ({
        ...prev,
        syncedOrders: syncedCount,
        pendingChanges: 0,
        lastSyncTime: new Date().toISOString()
      }));
      
      alert('Cache erfolgreich aktualisiert.');
    } catch (error) {
      console.error('Fehler beim Aktualisieren des Cache:', error);
      alert('Fehler beim Aktualisieren des Cache: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler'));
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const formatLastSyncTime = (time: string | null): string => {
    if (!time) return 'Nie';
    
    const syncTime = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - syncTime.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMinutes < 1) return 'Gerade eben';
    if (diffMinutes < 60) return `Vor ${diffMinutes} Minuten`;
    if (diffHours < 24) return `Vor ${diffHours} Stunden`;
    return `Vor ${diffDays} Tagen`;
  };
  
  return (
    <div className="cache-manager">
      <h3>Cache-Status</h3>
      
      <div className="cache-info">
        <div className="info-row">
          <span className="label">Gespeicherte Orders:</span>
          <span className="value">{cacheInfo.totalOrders}</span>
        </div>
        
        <div className="info-row">
          <span className="label">Synchronisierte Orders:</span>
          <span className="value">{cacheInfo.syncedOrders}</span>
        </div>
        
        <div className="info-row">
          <span className="label">Ausstehende Änderungen:</span>
          <span className={`value ${cacheInfo.pendingChanges > 0 ? 'pending' : ''}`}>
            {cacheInfo.pendingChanges}
          </span>
        </div>
        
        <div className="info-row">
          <span className="label">Cache-Größe:</span>
          <span className="value">{cacheInfo.cacheSize}</span>
        </div>
        
        <div className="info-row">
          <span className="label">Letzte Synchronisation:</span>
          <span className="value">{formatLastSyncTime(cacheInfo.lastSyncTime)}</span>
        </div>
      </div>
      
      <div className="action-buttons">
        <button 
          onClick={handleRefreshCache}
          disabled={isRefreshing || !networkService.isOnline()}
          className="refresh-btn"
        >
          {isRefreshing ? 'Aktualisiere...' : 'Cache aktualisieren'}
        </button>
        
        <button 
          onClick={handleClearCache}
          disabled={isClearing}
          className="clear-btn"
        >
          {isClearing ? 'Lösche...' : 'Cache löschen'}
        </button>
      </div>
      
      <style>{`
        .cache-manager {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 20px;
          margin: 20px;
          color: white;
        }
        
        .cache-manager h3 {
          margin: 0 0 15px 0;
          font-size: 18px;
          font-weight: 600;
        }
        
        .cache-info {
          margin-bottom: 20px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .info-row:last-child {
          border-bottom: none;
        }
        
        .label {
          font-size: 14px;
          opacity: 0.8;
        }
        
        .value {
          font-size: 14px;
          font-weight: 500;
        }
        
        .value.pending {
          color: #ffeb3b;
        }
        
        .action-buttons {
          display: flex;
          gap: 10px;
          flex-direction: column;
        }
        
        .action-buttons button {
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 10px 16px; /* Nur für CacheManager Buttons */
          margin: 0; /* Kein margin für CacheManager Buttons */
        }
        
        /* Verhindere, dass CacheManager Button-Stile andere Buttons beeinflussen */
        .cache-manager .action-buttons button {
          padding: 10px 16px !important;
          margin: 0 !important;
        }
        
        .refresh-btn {
          background: rgba(76, 175, 80, 0.8);
          color: white;
        }
        
        .refresh-btn:hover:not(:disabled) {
          background: rgba(76, 175, 80, 1);
        }
        
        .clear-btn {
          background: rgba(244, 67, 54, 0.8);
          color: white;
        }
        
        .clear-btn:hover:not(:disabled) {
          background: rgba(244, 67, 54, 1);
        }
        
        .action-buttons button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        @media (max-width: 480px) {
          .cache-manager {
            margin: 10px;
            padding: 15px;
          }
          
          .action-buttons {
            flex-direction: row;
          }
          
          .action-buttons button {
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default CacheManager;