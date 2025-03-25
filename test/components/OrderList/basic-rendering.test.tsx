// @ts-nocheck
import * as React from 'react';
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('OrderList Component - Basic Rendering', () => {
  it('should render the component with title', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Check that the title is rendered
    expect(screen.getByText('Open Sale Orders')).toBeInTheDocument();
  });
  
  it('should render the logo', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Check that the logo is rendered
    expect(screen.getByAltText('Logo')).toBeInTheDocument();
  });
  
  it('should render action buttons', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <OrderList />
        </MemoryRouter>
      );
    });
    
    // Check that action buttons are rendered
    expect(screen.getByTitle('Back to Login')).toBeInTheDocument();
    expect(screen.getByTitle('Refresh Orders')).toBeInTheDocument();
    expect(screen.getByAltText('Back')).toBeInTheDocument();
    expect(screen.getByAltText('Refresh')).toBeInTheDocument();
  });
  
  it('should render order items', async () => {
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
      expect(screen.getByText('SO002 - Customer 2')).toBeInTheDocument();
    });
  });
});
