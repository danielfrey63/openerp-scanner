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
      
      await client.login({ db: selectedDb, username, password });
      
      // Store the authenticated client in context
      setClient(client);
      
      navigate('/orders');
    } catch (err) {
      console.error('Login error:', err);
      setError(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    }
  };

  if (loading) {
    return <div className="login-form">Loading databases...</div>;
  }

  return (
    <div className="login-form">
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
        <button type="submit">Login</button>
      </form>
    </div>
  );
};

export default Login;