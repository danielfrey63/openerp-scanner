import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OpenERPClient, OpenERPConfig } from '@danielfrey63/openerp-ts-client';
import { useOpenERP } from '../context/OpenERPContext';
import LoginIcon from '../icons/login-icon.svg';
import logo from '../icons/logo.svg';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDb, setSelectedDb] = useState('');
  const [error, setError] = useState('');
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
      } catch (err) {
        console.error('Error fetching databases:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch databases. Please check server connection.');
      }
    };

    fetchDatabases();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
            errorMessage += ': ' + ((loginError as any).message || JSON.stringify(loginError));
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

  return (
    <div className="list">
      <div className="header-container">
        <div className="title-with-logo">
          <img src={logo} alt="Logo" className="header-logo" />
          <h2>OpenERP Login</h2>
        </div>
        <div className="action-buttons">
          <button 
            type="submit" 
            className="default icon-button"
            onClick={handleLogin}
            title="Login"
          >
            <img src={LoginIcon} alt="Login" />
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <form onSubmit={handleLogin}>
        <div className="item">
          <select
            value={selectedDb}
            onChange={(e) => setSelectedDb(e.target.value)}
            required
          >
            <option value="" disabled>Select Database</option>
            {databases.map(db => (
              <option key={db} value={db}>{db}</option>
            ))}
          </select>
        </div>
        <div className="item">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div className="item">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="action-buttons" style={{ display: 'none' }}>
          <button type="submit">Login</button>
        </div>
      </form>
    </div>
  );
};

export default Login;