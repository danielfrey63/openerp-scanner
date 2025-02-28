import React, { createContext, useContext, useState, ReactNode } from 'react';
import { OpenERPClient, OpenERPConfig, Session } from '@danielfrey63/openerp-ts-client';

interface OpenERPContextType {
  client: OpenERPClient | null;
  session: Session | null;
  setClient: (client: OpenERPClient) => void;
  isAuthenticated: boolean;
}

const OpenERPContext = createContext<OpenERPContextType>({
  client: null,
  session: null,
  setClient: () => {},
  isAuthenticated: false,
});

export const useOpenERP = () => useContext(OpenERPContext);

interface OpenERPProviderProps {
  children: ReactNode;
}

export const OpenERPProvider: React.FC<OpenERPProviderProps> = ({ children }) => {
  const [client, setClientState] = useState<OpenERPClient | null>(null);

  // Initialize the client if it doesn't exist
  const setClient = (newClient: OpenERPClient) => {
    setClientState(newClient);
  };

  const value = {
    client,
    session: client?.session || null,
    setClient,
    isAuthenticated: !!client?.session,
  };

  return (
    <OpenERPContext.Provider value={value}>
      {children}
    </OpenERPContext.Provider>
  );
};
