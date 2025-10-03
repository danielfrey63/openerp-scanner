import React, { useState, useEffect } from 'react';

interface PWAInstallPromptProps {
  className?: string;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ className = '' }) => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is already installed (running in standalone mode)
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches ||
                              (window.navigator as any).standalone ||
                              document.referrer.includes('android-app://');
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();

    // Listen for PWA installable event
    const handleInstallable = () => {
      setIsInstallable(true);
      // Show prompt after a delay to not be too intrusive
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('pwa-installable', handleInstallable);

    // Listen for app installed event
    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setShowPrompt(false);
      console.log('PWA was installed');
    });

    return () => {
      window.removeEventListener('pwa-installable', handleInstallable);
    };
  }, []);

  const handleInstall = async () => {
    if (!isInstallable || isInstalling) return;

    setIsInstalling(true);
    
    try {
      const installFunction = (window as any).installPWA;
      if (installFunction) {
        const result = await installFunction();
        if (result) {
          setShowPrompt(false);
          setIsInstallable(false);
        }
      }
    } catch (error) {
      console.error('Failed to install PWA:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed or dismissed
  if (isStandalone || !isInstallable || !showPrompt) {
    return null;
  }

  // Check if dismissed in this session
  if (sessionStorage.getItem('pwa-install-dismissed')) {
    return null;
  }

  return (
    <div 
      className={`pwa-install-prompt ${className}`}
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '20px',
        right: '20px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        zIndex: 1000,
        animation: 'slideUp 0.3s ease-out'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '32px' }}>📱</div>
        
        <div style={{ flex: 1 }}>
          <h3 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '18px', 
            fontWeight: '600',
            color: '#333'
          }}>
            App installieren
          </h3>
          <p style={{ 
            margin: 0, 
            fontSize: '14px', 
            color: '#666',
            lineHeight: '1.4'
          }}>
            Installieren Sie die OpenERP Scanner App für schnelleren Zugriff und Offline-Funktionalität.
          </p>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginTop: '16px',
        justifyContent: 'flex-end'
      }}>
        <button
          onClick={handleDismiss}
          style={{
            padding: '8px 16px',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: 'transparent',
            color: '#666',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          Später
        </button>
        
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          style={{
            padding: '8px 16px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: '#667eea',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isInstalling ? 'not-allowed' : 'pointer',
            opacity: isInstalling ? 0.7 : 1,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => {
            if (!isInstalling) {
              e.currentTarget.style.backgroundColor = '#5a6fd8';
            }
          }}
          onMouseOut={(e) => {
            if (!isInstalling) {
              e.currentTarget.style.backgroundColor = '#667eea';
            }
          }}
        >
          {isInstalling ? (
            <>
              <div style={{
                width: '16px',
                height: '16px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              Installiere...
            </>
          ) : (
            'Installieren'
          )}
        </button>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 480px) {
          .pwa-install-prompt {
            left: 10px !important;
            right: 10px !important;
            bottom: 10px !important;
          }
        }
      `}</style>
    </div>
  );
};

export default PWAInstallPrompt;
