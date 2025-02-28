import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OpenERPClient, OpenERPConfig } from '@danielfrey63/openerp-ts-client';
import { useOpenERP } from '../context/OpenERPContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { setClient } = useOpenERP();

  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const baseUrl = import.meta.env.VITE_OPENERP_BASE_URL;
        if (!baseUrl) {
          throw new Error('OpenERP base URL is not configured');
        }

        const config: OpenERPConfig = { 
          baseUrl
        };
        const client = new OpenERPClient(config);

        console.log('Fetching databases from:', baseUrl);
        const dbs = await client.listDatabases();
        console.log('Available databases:', dbs);

        if (!Array.isArray(dbs)) {
          throw new Error('Invalid response from server');
        }

        setDatabases(dbs);
        if (dbs.length > 0) {
          setSelectedDb(dbs[0]);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error fetching databases:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch databases. Please check server connection.');
        setLoading(false);
      }
    };

    fetchDatabases();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDb) {
      setError('Please select a database');
      return;
    }

    const baseUrl = import.meta.env.VITE_OPENERP_BASE_URL;
    if (!baseUrl) {
      setError('OpenERP base URL is not configured');
      return;
    }

    try {
      const config: OpenERPConfig = { 
        baseUrl
      };
      const client = new OpenERPClient(config);
      
      console.log('Attempting login to:', baseUrl);
      console.log('Database:', selectedDb);
      console.log('Username:', username);
      
      try {
        await client.login({ db: selectedDb, username, password });
        
        // Store the authenticated client in context
        setClient(client);
        
        navigate('/orders');
      } catch (loginError) {
        console.error('Login API error:', loginError);
        let errorMessage = 'Login failed';
        
        if (loginError && typeof loginError === 'object') {
          if ('fault' in loginError) {
            const fault = (loginError as any).fault;
            errorMessage += ': ' + (fault?.message || fault?.string || JSON.stringify(fault));
          } else {
            errorMessage += ': ' + (loginError.message || JSON.stringify(loginError));
          }
        } else {
          errorMessage += ': ' + String(loginError);
        }
        
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Login setup error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    }
  };

  if (loading) {
    return <div className="login-form">Loading databases...</div>;
  }

  return (
    <div className="login-form">
      <div className="header-container">
        <h2>OpenERP Login</h2>
      </div>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleLogin}>
        <select
          value={selectedDb}
          onChange={(e) => setSelectedDb(e.target.value)}
          required
        >
          <option value="">Select Database</option>
          {databases.map(db => (
            <option key={db} value={db}>{db}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="default icon-button">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
          </svg>
        </button>
      </form>
    </div>
  );
};

export default Login;