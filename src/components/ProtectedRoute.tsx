import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useOpenERP } from '@/context/OpenERPContext.js';
import { isGraceValid } from '@/utils/sessionGrace.js';
import { OpenERPClient } from '@danielfrey63/openerp-ts-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, setClient } = useOpenERP();
  const location = useLocation();
  const [allowed, setAllowed] = React.useState<boolean>(isAuthenticated);

  // On mount, if not authenticated but grace window is valid, try to recreate client
  React.useEffect(() => {
    if (isAuthenticated) {
      setAllowed(true);
      return;
    }
    const version = (import.meta as any).env?.VITE_APP_VERSION || 'dev';
    if (isGraceValid(version)) {
      // Allow route access during grace window
      setAllowed(true);
      const baseUrl = (import.meta as any).env?.VITE_OPENERP_BASE_URL;
      if (baseUrl) {
        try {
          const client = new OpenERPClient({ baseUrl });
          setClient(client);
        } catch {
          // ignore
        }
      }
    } else {
      setAllowed(false);
    }
  }, [isAuthenticated, setClient]);

  if (!isAuthenticated && !allowed) {
    // Redirect to the login page if not authenticated
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
