import React from 'react';
import { getAllSessions } from '@/utils/sessionStore.js';
import { orderRepo } from '@/data/orderRepo.js';

const DebugSession: React.FC = () => {
  const [json, setJson] = React.useState<string>('{}');

  React.useEffect(() => {
    try {
      const sessions = getAllSessions();
      const repoCache = orderRepo.getAllOrderRecords();
      const payload = JSON.stringify({ sessions, repoCache }, null, 2);
      setJson(payload);
      // Try to render as application/json using a data URL
      const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(payload);
      // Use replace so back button doesn't retain the intermediate route
      window.location.replace(url);
    } catch (e) {
      setJson('{ "error": "Failed to load session data" }');
    }
  }, []);

  return (
    <pre style={{
      background: 'transparent',
      color: '#e0e0e0',
      padding: 0,
      margin: 0,
      borderRadius: 0,
      overflowX: 'auto',
      maxWidth: '100%'
    }}>{json}</pre>
  );
};

export default DebugSession;
