import React, { useState, useEffect } from 'react';
import { networkService, NetworkStatus as NetworkStatusType } from '@/services/networkService.js';

interface NetworkStatusProps {
  className?: string;
  showDetails?: boolean;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({
  className = ''
}) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatusType>(
    networkService.getNetworkStatus()
  );
  const [queueStatus, setQueueStatus] = useState(networkService.getQueueStatus());
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    // Subscribe to network status changes
    const unsubscribe = networkService.addNetworkListener(setNetworkStatus);
    
    // Update queue status periodically
    const queueInterval = setInterval(() => {
      setQueueStatus(networkService.getQueueStatus());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(queueInterval);
    };
  }, []);

  const getStatusColor = () => {
    if (!networkStatus.online) return '#ff4757'; // Red for offline
    if (queueStatus.total > 0) return '#ffa502'; // Orange for pending sync
    return '#2ed573'; // Green for online and synced
  };

  const getStatusText = () => {
    if (!networkStatus.online) return 'Offline';
    if (queueStatus.total > 0) return `${queueStatus.total} ausstehend`;
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!networkStatus.online) return '📱';
    if (queueStatus.total > 0) return '🔄';
    return '✅';
  };

  const getConnectionQuality = () => {
    if (!networkStatus.online) return 'Keine Verbindung';

    const { effectiveType, rtt } = networkStatus;

    if (effectiveType === 'slow-2g') return 'Sehr langsam';
    if (effectiveType === '2g') return 'Langsam';
    if (effectiveType === '3g') return 'Mittel';
    if (effectiveType === '4g') return 'Schnell';

    if (rtt > 1000) return 'Langsam';
    if (rtt > 500) return 'Mittel';
    return 'Schnell';
  };

  return (
    <div 
      className={`network-status ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        border: `2px solid ${getStatusColor()}`,
        color: 'white',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.3s ease'
      }}
    >
      <span style={{ fontSize: '16px' }}>{getStatusIcon()}</span>
      <span>{getStatusText()}</span>
      
      {queueStatus.processing && (
        <div 
          style={{
            width: '12px',
            height: '12px',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            borderTop: '2px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
      )}

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginTop: '8px',
            padding: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            borderRadius: '8px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div><strong>Status:</strong> {networkStatus.online ? 'Online' : 'Offline'}</div>
          <div><strong>Qualität:</strong> {getConnectionQuality()}</div>
          {networkStatus.online && (
            <>
              <div><strong>Typ:</strong> {networkStatus.effectiveType}</div>
              <div><strong>RTT:</strong> {networkStatus.rtt}ms</div>
              {networkStatus.downlink > 0 && (
                <div><strong>Download:</strong> {networkStatus.downlink} Mbps</div>
              )}
            </>
          )}
          {queueStatus.total > 0 && (
            <>
              <hr style={{ margin: '8px 0', border: '1px solid rgba(255, 255, 255, 0.2)' }} />
              <div><strong>Warteschlange:</strong></div>
              <div>Hoch: {queueStatus.byPriority.high}</div>
              <div>Normal: {queueStatus.byPriority.normal}</div>
              <div>Niedrig: {queueStatus.byPriority.low}</div>
            </>
          )}
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

export default NetworkStatus;
