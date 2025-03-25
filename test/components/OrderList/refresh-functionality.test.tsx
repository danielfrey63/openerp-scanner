// @ts-nocheck
import * as React from 'react';
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { act } from 'react';
import OrderList from '@/components/OrderList.js';
import { useOpenERP } from '@/context/OpenERPContext.js';
import '@testing-library/jest-dom/vitest';

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

// Create mocks
const mockNavigate = vi.fn();
const mockOpenERPClient = {
  getOpenSaleOrders: vi.fn()
};

// Setup before each test
beforeEach(() => {
  // Reset mocks
  vi.clearAllMocks();
  
  // Setup navigate mock
  (useNavigate as vi.Mock).mockReturnValue(mockNavigate);
  
  // Setup OpenERP context mock
  (useOpenERP as vi.Mock).mockReturnValue({
    client: mockOpenERPClient,
    isAuthenticated: true
  });
  
  // Setup mock data
  mockOpenERPClient.getOpenSaleOrders.mockResolvedValue([
    { id: 1, name: 'SO001', partner_id: [1, 'Customer 1'] },
    { id: 2, name: 'SO002', partner_id: [2, 'Customer 2'] }
  ]);
  
  // Mock console methods to prevent test output pollution
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrderList Component - Refresh Functionality', () => {
  it('should clear orders and errors when refreshing', async () => {
    // Setup initial API call to fail
    mockOpenERPClient.getOpenSaleOrders.mockRejectedValueOnce(new Error('Initial error'));
    
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch orders: Initial error/)).toBeInTheDocument();
    });
    
    // Setup second API call to succeed
    mockOpenERPClient.getOpenSaleOrders.mockResolvedValueOnce([
      { id: 3, name: 'SO003', partner_id: [3, 'Customer 3'] }
    ]);
    
    // Click refresh button
    fireEvent.click(screen.getByTitle('Refresh Orders'));
    
    // Check that error is cleared during refresh
    expect(screen.queryByText(/Failed to fetch orders: Initial error/)).not.toBeInTheDocument();
    
    // Wait for new data to be displayed
    await waitFor(() => {
      expect(screen.getByText('SO003 - Customer 3')).toBeInTheDocument();
    });
  });
  
  it('should handle all error types in refresh function', async () => {
    // Render component
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Wait for initial orders to be rendered
    await waitFor(() => {
      expect(screen.getByText('SO001 - Customer 1')).toBeInTheDocument();
    });
    
    // Test with object error
    mockOpenERPClient.getOpenSaleOrders.mockRejectedValueOnce({ message: 'Object error' });
    fireEvent.click(screen.getByTitle('Refresh Orders'));
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch orders: Object error/)).toBeInTheDocument();
    });
    
    // Test with string error
    mockOpenERPClient.getOpenSaleOrders.mockRejectedValueOnce('String error');
    fireEvent.click(screen.getByTitle('Refresh Orders'));
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch orders: String error/)).toBeInTheDocument();
    });
    
    // Test with authentication error
    (useOpenERP as vi.Mock).mockReturnValueOnce({
      client: null,
      isAuthenticated: false
    });
    fireEvent.click(screen.getByTitle('Refresh Orders'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
  
  it('should handle complex object errors in refresh function', async () => {
    // Render component
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Wait for initial orders to be rendered
    await waitFor(() => {
      expect(screen.getByText('SO001 - Customer 1')).toBeInTheDocument();
    });
    
    // Test with complex object error without message property
    const complexError = {
      status: 500,
      data: {
        error: 'Server error',
        code: 'ERR_SERVER'
      }
    };
    mockOpenERPClient.getOpenSaleOrders.mockRejectedValueOnce(complexError);
    fireEvent.click(screen.getByTitle('Refresh Orders'));
    
    // Wait for error with JSON string to be displayed
    await waitFor(() => {
      const errorText = screen.getByText(/Failed to fetch orders:/);
      expect(errorText.textContent).toContain('Server error');
      expect(errorText.textContent).toContain('ERR_SERVER');
    });
  });
});
