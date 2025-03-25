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

describe('OrderList Component - Functionality', () => {
  it('should navigate to order details when clicking an order', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Wait for orders to be rendered
    await waitFor(() => {
      expect(screen.getByText('SO001 - Customer 1')).toBeInTheDocument();
    });
    
    // Click on an order
    fireEvent.click(screen.getByText('SO001 - Customer 1'));
    
    // Check that navigation occurred with correct order ID
    expect(mockNavigate).toHaveBeenCalledWith('/orders/1');
  });
  
  it('should navigate back to login when clicking back button', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Click on back button
    fireEvent.click(screen.getByTitle('Back to Login'));
    
    // Check that navigation occurred to login page
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
  
  it('should refresh orders when clicking refresh button', async () => {
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
    
    // Update mock data for refresh
    mockOpenERPClient.getOpenSaleOrders.mockResolvedValue([
      { id: 3, name: 'SO003', partner_id: [3, 'Customer 3'] }
    ]);
    
    // Click on refresh button
    fireEvent.click(screen.getByTitle('Refresh Orders'));
    
    // Wait for refreshed orders to be rendered
    await waitFor(() => {
      expect(screen.getByText('SO003 - Customer 3')).toBeInTheDocument();
      expect(screen.queryByText('SO001 - Customer 1')).not.toBeInTheDocument();
    });
    
    // Check that getOpenSaleOrders was called twice (initial + refresh)
    expect(mockOpenERPClient.getOpenSaleOrders).toHaveBeenCalledTimes(2);
  });
  
  it('should redirect to login if not authenticated', async () => {
    // Setup unauthenticated state
    (useOpenERP as vi.Mock).mockReturnValue({
      client: null,
      isAuthenticated: false
    });
    
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Check that navigation occurred to login page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});

describe('OrderList Component - Error Handling', () => {
  it('should display error when API call fails', async () => {
    // Setup API call to fail
    mockOpenERPClient.getOpenSaleOrders.mockRejectedValue(new Error('Failed to fetch orders'));
    
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch orders/)).toBeInTheDocument();
    });
  });
  
  it('should handle non-Error objects thrown during fetch', async () => {
    // Setup API call to fail with a non-Error object
    mockOpenERPClient.getOpenSaleOrders.mockRejectedValue({ message: 'API error' });
    
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Wait for error to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch orders: API error/)).toBeInTheDocument();
    });
  });
});
