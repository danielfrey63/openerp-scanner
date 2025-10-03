import React from 'react';
import { useOfflineAware } from '@/context/OfflineAwareContext.js';

const OfflineStatus: React.FC = () => {
  const { isOfflineMode, offlineQueueSize, forceOnlineMode } = useOfflineAware();
  
  if (!isOfflineMode) return null;
  
  return (
    <div className="offline-status">
      <div className="offline-indicator">
        <span className="offline-icon">📱</span>
        <span>Offline-Modus</span>
        {offlineQueueSize > 0 && (
          <span className="queue-size">{offlineQueueSize} ausstehend</span>
        )}
      </div>
      <button 
        onClick={forceOnlineMode}
        className="force-online-btn"
        title="Online-Modus erzwingen"
      >
        Online versuchen
      </button>
      
      <style>{`
        .offline-status {
          position: fixed;
          top: 10px;
          right: 10px;
          background: rgba(255, 152, 0, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(10px);
        }
        
        .offline-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .offline-icon {
          font-size: 14px;
        }
        
        .queue-size {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
        }
        
        .force-online-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .force-online-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        @media (max-width: 480px) {
          .offline-status {
            top: 5px;
            right: 5px;
            left: 5px;
            font-size: 11px;
          }
          
          .force-online-btn {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default OfflineStatus;