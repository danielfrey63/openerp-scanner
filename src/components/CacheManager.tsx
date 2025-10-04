import React, { useState, useEffect } from 'react';
import { orderRepo } from '@/data/orderRepo.js';

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
      
      <div className="cache-note">
        <p>Die Synchronisation erfolgt automatisch im Hintergrund.</p>
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
        
        .cache-note {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .cache-note p {
          margin: 0;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          text-align: center;
          font-style: italic;
        }
        
        @media (max-width: 480px) {
          .cache-manager {
            margin: 10px;
            padding: 15px;
          }
        }
      `}</style>
    </div>
  );
};

export default CacheManager;