import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import PWAInstallPrompt from '@/components/PWAInstallPrompt.js';
import { SyncStatusProvider } from '@/context/SyncStatusContext.js';
import { OfflineAwareProvider } from '@/context/OfflineAwareContext.js';
import { syncService } from '@/services/syncService.js';
import './App.css';

function App() {
  useEffect(() => {
    // Hintergrund-Sync bei App-Start starten
    const initializeBackgroundSync = async () => {
      try {
        // Startup-Sync durchführen
        await syncService.performStartupSync();
        
        // Periodischen Hintergrund-Sync starten
        syncService.startBackgroundSync();
      } catch (error) {
        console.error('Failed to initialize background sync:', error);
      }
    };

    // Verzögert starten, um andere Initialisierungen nicht zu blockieren
    setTimeout(initializeBackgroundSync, 2000);

    // Tab-Fokus Sync einrichten
    const handleFocus = () => {
      syncService.performFocusSync();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncService.performFocusSync();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <SyncStatusProvider>
      <OfflineAwareProvider>
        <div className="app">
          <Outlet />

          {/* PWA Install Prompt */}
          <PWAInstallPrompt />
        </div>
      </OfflineAwareProvider>
    </SyncStatusProvider>
  );
}

export default App;