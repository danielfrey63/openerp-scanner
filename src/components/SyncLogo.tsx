import React from 'react';
import { useSyncStatus } from '@/context/SyncStatusContext.js';
import Logo from '@/icons/logo.svg';

interface SyncLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

const SyncLogo: React.FC<SyncLogoProps> = ({ className = '', style = {} }) => {
  const { isAllSynced, triggerFullSync, isSyncing } = useSyncStatus();

  const handleLogoClick = async () => {
    if (!isSyncing) {
      await triggerFullSync();
    }
  };

  return (
    <div 
      onClick={handleLogoClick}
      className={`sync-logo ${className}`}
      style={{
        cursor: isSyncing ? 'wait' : 'pointer',
        transition: 'all 0.3s ease',
        position: 'relative',
        display: 'inline-block',
        ...style
      }}
      title={
        isSyncing 
          ? 'Synchronisiere alle Bestellungen...' 
          : isAllSynced 
            ? 'Alle Bestellungen synchronisiert ✓' 
            : 'Klicken um alle Bestellungen zu synchronisieren'
      }
    >
      <img
        src={Logo}
        alt="Logo"
        className={className}
        style={{
          filter: isAllSynced
            ? 'hue-rotate(120deg) saturate(1.5) brightness(1.1)' // Grün-Filter
            : isSyncing
              ? 'brightness(0.7)'
              : 'none',
          transition: 'filter 0.3s ease',
          transform: isSyncing ? 'scale(0.95)' : 'scale(1)',
          ...style
        }}
      />
      
      {isSyncing && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '20px',
            height: '20px',
            border: '2px solid rgba(102, 126, 234, 0.3)',
            borderTop: '2px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        .sync-logo:hover img {
          transform: scale(1.05);
        }
        
        .sync-logo:active img {
          transform: scale(0.95);
        }
      `}</style>
    </div>
  );
};

export default SyncLogo;
