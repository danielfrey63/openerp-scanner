import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OpenERPClient, OpenERPConfig } from '@danielfrey63/openerp-ts-client';
import { useOpenERP } from "@/context/OpenERPContext.js";
import LoginIcon from "@/icons/login-icon.svg";
import Logo from "@/icons/logo.svg";
import { setGrace } from "@/utils/sessionGrace.js";

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

    // Validate all required fields
    if (!selectedDb) {
      setError('Bitte wählen Sie eine Datenbank aus');
      return;
    }

    if (!username) {
      setError('Bitte geben Sie einen Benutzernamen ein');
      return;
    }

    if (!password) {
      setError('Bitte geben Sie ein Passwort ein');
      return;
    }

    const baseUrl = import.meta.env.VITE_OPENERP_BASE_URL;
    if (!baseUrl) {
      setError('OpenERP base URL is not configured');
      return;
    }

    setError('');

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

        // Set short-lived grace so user stays logged in after reloads
        const appVersion = (import.meta as any).env?.VITE_APP_VERSION || 'dev';
        setGrace(appVersion, 5 * 60 * 1000);

        // Zur Cache-Initialisierung navigieren
        navigate('/cache-initializer');
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
          <img src={Logo} alt="Logo" className="header-logo" />
          <h2>OpenERP Login</h2>
        </div>
        <div className="action-buttons">
          <button
            type="submit"
            className={`icon-button ${selectedDb && username && password ? 'default' : 'disabled'}`}
            onClick={handleLogin}
            disabled={!selectedDb || !username || !password}
            title={!selectedDb ? "Bitte zuerst eine Datenbank auswählen" :
                  !username ? "Bitte Benutzernamen eingeben" :
                  !password ? "Bitte Passwort eingeben" : "Login"}
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
            className={!selectedDb ? 'required-field' : ''}
          >
            <option value="" disabled>Datenbank auswählen *</option>
            {databases.map(db => (
              <option key={db} value={db}>{db}</option>
            ))}
          </select>
        </div>
        <div className="item">
          <input
            type="text"
            placeholder="Benutzername *"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={!username ? 'required-field' : ''}
            autoCapitalize="off"
            autoComplete="username"
          />
        </div>
        <div className="item">
          <input
            type="password"
            placeholder="Passwort *"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={!password ? 'required-field' : ''}
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