import React, { useState, useEffect, useRef } from 'react';
import { orderRepo } from '@/data/orderRepo.js';
import { syncService } from '@/services/syncService.js';
import { networkService } from '@/services/networkService.js';
import RefreshIcon from '@/icons/refresh-icon.svg';
import DeleteCacheIcon from '@/icons/delete-cache.svg';

interface CacheInfo {
  totalOrders: number;
  syncedOrders: number;
  pendingChanges: number;
  cacheSize: string;
  lastSyncTime: string | null;
}

const CacheDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo>({
    totalOrders: 0,
    syncedOrders: 0,
    pendingChanges: 0,
    cacheSize: '0 MB',
    lastSyncTime: null
  });
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleClearCache = async () => {
    if (!confirm('Sind Sie sicher, dass Sie den gesamten Cache löschen möchten? Alle lokalen Daten gehen verloren.')) {
      return;
    }
    
    setIsClearing(true);
    setIsOpen(false);
    
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
    setIsOpen(false);
    
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

  const handleButtonClick = () => {
    if (isOpen) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  };
  
  return (
    <div className="cache-dropdown" ref={dropdownRef}>
      <button 
        onClick={handleButtonClick}
        className="icon-button default"
        title="Cache Status"
        style={{ position: 'relative' }}
      >
        <img src={RefreshIcon} alt="Cache Status" />
        {cacheInfo.pendingChanges > 0 && (
          <span 
            style={{
              position: 'absolute',
              top: '-2px',
              right: '-2px',
              background: '#ff9800',
              color: 'white',
              borderRadius: '50%',
              width: '12px',
              height: '12px',
              fontSize: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold'
            }}
          >
            {cacheInfo.pendingChanges > 99 ? '99+' : cacheInfo.pendingChanges}
          </span>
        )}
      </button>
      
      {isOpen && (
        <div className="cache-dropdown-menu">
          <div className="cache-dropdown-header">
            <div className="header-with-actions">
              <h4>Cache Status</h4>
              <div className="header-actions">
                <button
                  onClick={handleRefreshCache}
                  disabled={isRefreshing || !networkService.isOnline()}
                  className="icon-button secondary"
                  title="Cache aktualisieren"
                >
                  <img src={RefreshIcon} alt="Cache aktualisieren" />
                </button>
                
                <button
                  onClick={handleClearCache}
                  disabled={isClearing}
                  className="icon-button secondary"
                  title="Cache löschen"
                >
                  <img src={DeleteCacheIcon} alt="Cache löschen" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="cache-info">
            <div className="info-row">
              <span className="label">Gespeicherte Orders:</span>
              <span className="value">{cacheInfo.totalOrders}</span>
            </div>
            
            <div className="info-row">
              <span className="label">Synchronisierte:</span>
              <span className="value">{cacheInfo.syncedOrders}</span>
            </div>
            
            <div className="info-row">
              <span className="label">Ausstehend:</span>
              <span className={`value ${cacheInfo.pendingChanges > 0 ? 'pending' : ''}`}>
                {cacheInfo.pendingChanges}
              </span>
            </div>
            
            <div className="info-row">
              <span className="label">Cache-Größe:</span>
              <span className="value">{cacheInfo.cacheSize}</span>
            </div>
            
            <div className="info-row">
              <span className="label">Letzte Sync:</span>
              <span className="value">{formatLastSyncTime(cacheInfo.lastSyncTime)}</span>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .cache-dropdown {
          position: relative;
          display: inline-block;
        }
        
        .cache-dropdown-menu {
          position: absolute;
          top: 100%;
          right: 0;
          background: #2c2c2c;
          border: 1px solid #444;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          z-index: 1000;
          min-width: 250px;
          margin-top: 5px;
        }
        
        .cache-dropdown-header {
          padding: 12px 16px 8px 16px;
          border-bottom: 1px solid #444;
        }
        
        .header-with-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .cache-dropdown-header h4 {
          margin: 0;
          color: #e0e0e0;
          font-size: 14px;
          font-weight: 600;
        }
        
        .header-actions {
          display: flex;
          gap: 8px;
        }
        
        .header-actions .icon-button {
          width: 32px;
          height: 32px;
          padding: 4px;
        }
        
        .header-actions .icon-button img {
          width: 24px;
          height: 24px;
        }
        
        .cache-info {
          padding: 8px 16px;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0;
          font-size: 12px;
        }
        
        .label {
          color: #999;
        }
        
        .value {
          color: #e0e0e0;
          font-weight: 500;
        }
        
        .value.pending {
          color: #ff9800;
        }
        
      `}</style>
    </div>
  );
};

export default CacheDropdown;