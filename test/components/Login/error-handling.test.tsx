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

describe('Login Component - Error Handling', () => {
  it('should handle non-array response from listDatabases', async () => {
    // Setup database fetch to return a non-array
    mockListDatabases.mockResolvedValue('not an array');
    
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Invalid response from server/)).toBeInTheDocument();
    });
  });
  
  it('should handle login error with fault object', async () => {
    // Setup login to fail with a fault object
    mockLogin.mockRejectedValue({
      fault: {
        string: 'Authentication failed',
        message: null
      }
    });
    
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Fill in login form
    await waitFor(() => {
      expect(screen.getByText('db1')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText('Benutzername *'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Passwort *'), { target: { value: 'testpass' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'db1' } });
    
    // Submit form
    fireEvent.click(screen.getByAltText('Login'));
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Login failed: Authentication failed/)).toBeInTheDocument();
    });
  });
  
  it('should handle login error with string fault', async () => {
    // Setup login to fail with a string fault
    mockLogin.mockRejectedValue('Authentication error');
    
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Fill in login form
    await waitFor(() => {
      expect(screen.getByText('db1')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText('Benutzername *'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Passwort *'), { target: { value: 'testpass' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'db1' } });
    
    // Submit form
    fireEvent.click(screen.getByAltText('Login'));
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Login failed: Authentication error/)).toBeInTheDocument();
    });
  });
  
  it('should handle login with form submission', async () => {
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
    
    // Submit form using form submission instead of button click
    const form = screen.getByPlaceholderText('Benutzername *').closest('form');
    fireEvent.submit(form);
    
    // Wait for login to complete
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        db: 'db1',
        username: 'testuser',
        password: 'testpass'
      });
    });
  });
  
  it('should handle login error with complex fault object', async () => {
    // Setup login to fail with a complex fault object
    mockLogin.mockRejectedValue({
      fault: {
        faultCode: 'AccessDenied',
        faultString: 'Access denied for user',
        detail: {
          type: 'auth_error'
        }
      }
    });
    
    await act(async () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>
      );
    });
    
    // Fill in login form
    await waitFor(() => {
      expect(screen.getByText('db1')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText('Benutzername *'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Passwort *'), { target: { value: 'testpass' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'db1' } });
    
    // Submit form
    fireEvent.click(screen.getByAltText('Login'));
    
    // Wait for error to be displayed
    await waitFor(() => {
      const errorText = screen.getByText(/Login failed:/);
      expect(errorText.textContent).toContain('fault');
      expect(errorText.textContent).toContain('AccessDenied');
    });
  });
  
  it('should handle missing database selection', async () => {
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
    
    // Fill in login form but don't select a database
    fireEvent.change(screen.getByPlaceholderText('Benutzername *'), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByPlaceholderText('Passwort *'), { target: { value: 'testpass' } });
    
    // Clear the database selection
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    
    // Submit form
    fireEvent.click(screen.getByAltText('Login'));
    
    // Check that the button is disabled with the correct title
    await waitFor(() => {
      const loginButton = screen.getByAltText('Login').closest('button');
      expect(loginButton).toHaveAttribute('title', 'Bitte zuerst eine Datenbank auswählen');
      expect(loginButton).toBeDisabled();
    });
  });
});
