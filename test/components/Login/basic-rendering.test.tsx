// @ts-nocheck
import * as React from 'react';
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act } from 'react';
import Login from '@/components/Login.js';
import { useOpenERP } from '@/context/OpenERPContext.js';
import '@testing-library/jest-dom/vitest';
import { OpenERPClient } from '@danielfrey63/openerp-ts-client';

// Mock the OpenERP context
vi.mock('@/context/OpenERPContext.js', () => ({
  useOpenERP: vi.fn()
}));

// Mock the react-router-dom's useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn()
  };
});

// Mock the OpenERP client
vi.mock('@danielfrey63/openerp-ts-client', () => ({
  OpenERPClient: vi.fn()
}));

// Create mocks
const mockNavigate = vi.fn();
const mockSetClient = vi.fn();
const mockListDatabases = vi.fn();
const mockLogin = vi.fn();

// Setup before each test
beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();
  
  // Setup navigate mock
  (useNavigate as vi.Mock).mockReturnValue(mockNavigate);
  
  // Setup OpenERP context mock
  (useOpenERP as vi.Mock).mockReturnValue({
    setClient: mockSetClient
  });
  
  // Setup OpenERP client mock
  (OpenERPClient as vi.Mock).mockImplementation(() => ({
    listDatabases: mockListDatabases,
    login: mockLogin
  }));
  
  // Default mock implementations
  mockListDatabases.mockResolvedValue(['db1', 'db2', 'db3']);
  mockLogin.mockResolvedValue(undefined);

  // Mock environment variables
  vi.stubEnv('VITE_OPENERP_BASE_URL', 'http://test-server.com');
});

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Login Component - Basic Rendering', () => {
  it('should render the component with login title', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Check that the title is rendered
    expect(screen.getByText('OpenERP Login')).toBeInTheDocument();
  });
  
  it('should render the logo', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Check that the logo is rendered
    expect(screen.getByAltText('Logo')).toBeInTheDocument();
  });
  
  it('should render the login form fields', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Check that form elements are rendered
    expect(screen.getByText('Datenbank auswählen *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Benutzername *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Passwort *')).toBeInTheDocument();
    expect(screen.getByAltText('Login')).toBeInTheDocument();
  });
  
  it('should render database options after fetching', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Wait for database options to be rendered
    await waitFor(() => {
      expect(screen.getByText('db1')).toBeInTheDocument();
      expect(screen.getByText('db2')).toBeInTheDocument();
      expect(screen.getByText('db3')).toBeInTheDocument();
    });
  });
});
