import { Outlet } from 'react-router-dom';
import PWAInstallPrompt from '@/components/PWAInstallPrompt.js';
import { SyncStatusProvider } from '@/context/SyncStatusContext.js';
import { OfflineAwareProvider } from '@/context/OfflineAwareContext.js';
import OfflineStatus from '@/components/OfflineStatus.js';
import './App.css';

function App() {
  return (
    <SyncStatusProvider>
      <OfflineAwareProvider>
        <div className="app">
          {/* Network Status removed - assuming online by default */}

          <Outlet />

          {/* PWA Install Prompt */}
          <PWAInstallPrompt />
          
          {/* Offline Status Indicator */}
          <OfflineStatus />
        </div>
      </OfflineAwareProvider>
    </SyncStatusProvider>
  );
}

export default App;