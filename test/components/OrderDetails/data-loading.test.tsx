// @ts-nocheck
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { act } from 'react';
import OrderDetails from '@/components/OrderDetails.js';
import { useOpenERP } from '@/context/OpenERPContext.js';
import '@testing-library/jest-dom/vitest';
import { qrCodeScanner } from '@/components/QRCodeScanner.js';

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

// Mock the Camera component
vi.mock('@/components/Camera.js', () => ({
  default: vi.fn().mockImplementation(({ onScanComplete, onClose }) => (
    <div data-testid="camera-mock">
      <button data-testid="scan-button" onClick={() => onScanComplete('test-data')}>Scan</button>
      <button data-testid="close-button" onClick={onClose}>Close</button>
    </div>
  ))
}));

// Mock the QRCodeScanner
vi.mock('@/components/QRCodeScanner.js', () => ({
  qrCodeScanner: {
    scanFromFile: vi.fn()
  }
}));

// Create mocks
const mockNavigate = vi.fn();
const mockOpenERPClient = {
  getSaleOrderLines: vi.fn()
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
  
  // Setup QRCodeScanner mock
  qrCodeScanner.scanFromFile = vi.fn();
  
  // Mock order lines data
  mockOpenERPClient.getSaleOrderLines.mockResolvedValue([
    {
      id: 1,
      product_id: [1, 'Champagne [TEST123]'],
      product_uom_qty: 2
    },
    {
      id: 2,
      product_id: [2, 'Champagne [TEST456]'],
      product_uom_qty: 1
    }
  ]);

  // Mock navigator.mediaDevices for camera detection
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      enumerateDevices: vi.fn().mockResolvedValue([{ kind: 'videoinput' }]),
      getUserMedia: vi.fn().mockResolvedValue({})
    },
    writable: true
  });

  // Mock window.alert
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrderDetails Component - Data Loading', () => {
  it('should display order lines when data is loaded', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/orders/123']}>
          <Routes>
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Routes>
        </MemoryRouter>
      );
    });
    
    // Wait for order lines to be displayed
    await waitFor(() => {
      expect(screen.getByText(/2x TEST123/)).toBeInTheDocument();
      expect(screen.getByText(/1x TEST456/)).toBeInTheDocument();
    });
    
    // Check that the client method was called with the correct order ID
    expect(mockOpenERPClient.getSaleOrderLines).toHaveBeenCalledWith(123);
  });
  
  it('should display error message when data loading fails', async () => {
    // Mock error response
    mockOpenERPClient.getSaleOrderLines.mockRejectedValue(new Error('Failed to load order lines'));
    
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/orders/123']}>
          <Routes>
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Routes>
        </MemoryRouter>
      );
    });
    
    // Wait for error message to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Failed to load order lines/)).toBeInTheDocument();
    });
  });
  
  it('should navigate back when back button is clicked', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/orders/123']}>
          <Routes>
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Routes>
        </MemoryRouter>
      );
    });
    
    // Wait for order lines to be displayed
    await waitFor(() => {
      expect(screen.getByText(/2x TEST123/)).toBeInTheDocument();
    });
    
    // Click back button
    fireEvent.click(screen.getByTitle('Back to Orders'));
    
    // Check that navigate was called
    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });
  
  it('should navigate back when Enter key is pressed on back button', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/orders/123']}>
          <Routes>
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Routes>
        </MemoryRouter>
      );
    });
    
    // Wait for order lines to be displayed
    await waitFor(() => {
      expect(screen.getByText(/2x TEST123/)).toBeInTheDocument();
    });
    
    // Find the back button and press Enter key
    const backButton = screen.getByTitle('Back to Orders');
    fireEvent.keyDown(backButton, { key: 'Enter' });
    
    // Check that navigate was called with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });
});
