import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncService } from '@/services/syncService.js';
import { networkService } from '@/services/networkService.js';
import Logo from '@/icons/logo.svg';

interface CacheInitializerProps {
  onComplete: () => void;
  onError: (error: string) => void;
}

const CacheInitializer: React.FC<CacheInitializerProps> = ({ onComplete, onError }) => {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('Initialisiere...');
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const navigate = useNavigate();

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 3000; // 3 Sekunden

  const initializeCache = async () => {
    try {
      // Netzwerkstatus prüfen
      if (!networkService.isOnline()) {
        throw new Error('Keine Netzwerkverbindung verfügbar. Bitte stellen Sie eine Verbindung her und versuchen Sie es erneut.');
      }

      // 1. Alle offenen Orders laden
      setCurrentStep('Lade Bestellungen...');
      setProgress(10);
      
      const orders = await syncService.loadAllOrders();
      if (orders.length === 0) {
        setCurrentStep('Keine offenen Bestellungen gefunden');
        setProgress(100);
        setTimeout(() => onComplete(), 1000);
        return;
      }
      
      setProgress(30);
      
      // 2. Order-Details für alle Orders laden
      setCurrentStep(`Lade Details für ${orders.length} Bestellungen...`);
      await syncService.loadAllOrderDetails(orders);
      setProgress(80);
      
      // 3. Zusätzliche relevante Daten laden
      setCurrentStep('Lade zusätzliche Daten...');
      await syncService.loadAdditionalData();
      setProgress(100);
      
      // Kurze Verzögerung für bessere UX
      setTimeout(() => {
        setCurrentStep('Cache erfolgreich initialisiert');
        onComplete();
      }, 500);
      
    } catch (error) {
      console.error('[CacheInitializer] Initialization failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      
      if (retryCount < MAX_RETRIES) {
        setCurrentStep(`Fehler: ${errorMessage}. Wiederhole Versuch ${retryCount + 1}/${MAX_RETRIES}...`);
        setIsRetrying(true);
        
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          setIsRetrying(false);
          setProgress(0);
          initializeCache();
        }, RETRY_DELAY);
      } else {
        onError(`Cache-Initialisierung fehlgeschlagen: ${errorMessage}`);
      }
    }
  };

  useEffect(() => {
    initializeCache();
  }, [onComplete, onError, retryCount]);

  const handleRetry = () => {
    setRetryCount(0);
    setProgress(0);
    setIsRetrying(false);
    initializeCache();
  };

  const handleSkip = () => {
    if (confirm('Wollen Sie die Cache-Initialisierung überspringen? Die App funktioniert möglicherweise nicht vollständig offline.')) {
      onComplete();
    }
  };

  return (
    <div className="cache-initializer">
      <div className="cache-initializer-content">
        <div className="logo-container">
          <img src={Logo} alt="OpenERP Scanner" className="logo" />
        </div>
        
        <h2>Initialisiere Offline-Cache</h2>
        <p className="description">
          Die App lädt alle notwendigen Daten für die Offline-Nutzung.
          Dies kann einen Moment dauern...
        </p>
        
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${progress}%`,
                transition: isRetrying ? 'none' : 'width 0.3s ease'
              }} 
            />
          </div>
          <div className="progress-text">
            {progress}% - {currentStep}
          </div>
        </div>
        
        {isRetrying && (
          <div className="retry-indicator">
            <span className="spinner"></span>
            Wiederhole Versuch...
          </div>
        )}
        
        <div className="action-buttons">
          {retryCount >= MAX_RETRIES && (
            <>
              <button 
                onClick={handleRetry}
                className="default"
                disabled={isRetrying}
              >
                Erneut versuchen
              </button>
              <button 
                onClick={handleSkip}
                className="secondary"
                disabled={isRetrying}
              >
                Überspringen
              </button>
            </>
          )}
          
          <button 
            onClick={() => navigate('/')}
            className="secondary"
            disabled={isRetrying}
          >
            Zurück zum Login
          </button>
        </div>
      </div>
      
      <style>{`
        .cache-initializer {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
        }
        
        .cache-initializer-content {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        
        .logo-container {
          margin-bottom: 30px;
        }
        
        .logo {
          width: 80px;
          height: 80px;
          filter: brightness(0) invert(1);
        }
        
        h2 {
          margin: 0 0 10px 0;
          font-size: 24px;
          font-weight: 600;
        }
        
        .description {
          margin: 0 0 30px 0;
          opacity: 0.9;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .progress-container {
          margin: 30px 0;
        }
        
        .progress-bar {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          height: 8px;
          overflow: hidden;
          margin-bottom: 15px;
        }
        
        .progress-fill {
          background: linear-gradient(90deg, #4CAF50, #8BC34A);
          height: 100%;
          border-radius: 10px;
          transition: width 0.3s ease;
        }
        
        .progress-text {
          font-size: 14px;
          opacity: 0.9;
        }
        
        .retry-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin: 20px 0;
          font-size: 14px;
          color: #ffeb3b;
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        .action-buttons {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 30px;
        }
        
        .action-buttons button {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        
        .action-buttons button.default {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .action-buttons button.secondary {
          background: transparent;
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .action-buttons button:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-1px);
        }
        
        .action-buttons button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        @media (max-width: 480px) {
          .cache-initializer-content {
            padding: 30px 20px;
          }
          
          h2 {
            font-size: 20px;
          }
          
          .description {
            font-size: 13px;
          }
        }
      `}</style>
    </div>
  );
};

export default CacheInitializer;