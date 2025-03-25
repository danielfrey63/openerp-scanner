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
const mockClient = {
  listDatabases: mockListDatabases,
  login: mockLogin
};

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
  (OpenERPClient as vi.Mock).mockImplementation(() => mockClient);
  
  // Default mock implementations
  mockListDatabases.mockResolvedValue(['db1', 'db2', 'db3']);
  mockLogin.mockResolvedValue(undefined);

  // Mock environment variables
  vi.stubEnv('VITE_OPENERP_BASE_URL', 'http://test-server.com');
  
  // Mock console methods to prevent test output pollution
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Login Component - Login Functionality', () => {
  it('should handle successful login', async () => {
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
    });
    
    // Fill in login form
    fireEvent.change(screen.getByPlaceholderText('Benutzername *'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Passwort *'), { target: { value: 'testpass' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'db1' } });
    
    // Submit form
    fireEvent.click(screen.getByAltText('Login'));
    
    // Wait for login to complete
    await waitFor(() => {
      // Check that login was called with correct parameters
      expect(mockLogin).toHaveBeenCalledWith({
        db: 'db1',
        username: 'testuser',
        password: 'testpass'
      });
      
      // Check that client was set in context
      expect(mockSetClient).toHaveBeenCalledWith(mockClient);
      
      // Check that navigation occurred
      expect(mockNavigate).toHaveBeenCalledWith('/orders');
    });
  });
  
  it('should show error when login fails', async () => {
    // Setup login to fail
    mockLogin.mockRejectedValue({ fault: { message: 'Invalid credentials' } });
    
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
    });
    
    // Fill in login form
    fireEvent.change(screen.getByPlaceholderText('Benutzername *'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Passwort *'), { target: { value: 'wrongpass' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'db1' } });
    
    // Submit form
    fireEvent.click(screen.getByAltText('Login'));
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Login failed: Invalid credentials/)).toBeInTheDocument();
    });
    
    // Check that navigation did not occur
    expect(mockNavigate).not.toHaveBeenCalled();
  });
  
  it('should validate required fields before login', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Submit form without filling any fields
    fireEvent.click(screen.getByAltText('Login'));
    
    // Check that login was not called
    expect(mockLogin).not.toHaveBeenCalled();
    
    // Check that the button has the correct title attribute
    expect(screen.getByTitle('Bitte zuerst eine Datenbank auswählen')).toBeInTheDocument();
    
    // Select database but leave other fields empty
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'db1' } });
    
    // Check that the button title is updated
    await waitFor(() => {
      expect(screen.getByTitle('Bitte Benutzernamen eingeben')).toBeInTheDocument();
    });
    
    // Fill username but leave password empty
    fireEvent.change(screen.getByPlaceholderText('Benutzername *'), { target: { value: 'testuser' } });
    
    // Check that the button title is updated
    await waitFor(() => {
      expect(screen.getByTitle('Bitte Passwort eingeben')).toBeInTheDocument();
    });
  });
  
  it('should handle database fetch error', async () => {
    // Setup database fetch to fail
    mockListDatabases.mockRejectedValue(new Error('Failed to connect to server'));
    
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Failed to connect to server/)).toBeInTheDocument();
    });
    
    // Check that only the default option is in the dropdown
    expect(screen.getByText('Datenbank auswählen *')).toBeInTheDocument();
    expect(screen.queryByText('db1')).not.toBeInTheDocument();
  });
  
  it('should handle missing base URL', async () => {
    // Remove base URL from environment
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_OPENERP_BASE_URL', '');
    
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/OpenERP base URL is not configured/)).toBeInTheDocument();
    });
  });
});
