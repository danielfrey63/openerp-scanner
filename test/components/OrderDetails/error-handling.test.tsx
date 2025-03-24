// @ts-nocheck
import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { act } from 'react';
import OrderDetails from '@/components/OrderDetails.js';
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
    useNavigate: vi.fn(),
    useParams: vi.fn()
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
  (useParams as vi.Mock).mockReturnValue({ orderId: '123' });
  
  // Mock window.alert
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrderDetails Component - Error Handling', () => {
  it('should redirect to login when not authenticated', async () => {
    // Mock unauthenticated state
    (useOpenERP as vi.Mock).mockReturnValue({
      client: mockOpenERPClient,
      isAuthenticated: false
    });
    
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
      expect(screen.getByText(/Failed to fetch order lines: Not authenticated/)).toBeInTheDocument();
    });
    
    // Check that navigate was called with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
  
  it('should display error when order ID is missing', async () => {
    // Mock authenticated state
    (useOpenERP as vi.Mock).mockReturnValue({
      client: mockOpenERPClient,
      isAuthenticated: true
    });
    
    // Override the default mock to return an empty orderId
    (useParams as vi.Mock).mockReturnValueOnce({ orderId: '' });
    
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/orders/']}>
          <Routes>
            <Route path="/orders/" element={<OrderDetails />} />
          </Routes>
        </MemoryRouter>
      );
    });
    
    // Wait for error message to be displayed
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch order lines: Cannot read properties of undefined \(reading 'map'\)/)).toBeInTheDocument();
    });
  });
  
  it('should display error when API call fails', async () => {
    // Mock authenticated state
    (useOpenERP as vi.Mock).mockReturnValue({
      client: mockOpenERPClient,
      isAuthenticated: true
    });
    
    // Mock API error
    mockOpenERPClient.getSaleOrderLines.mockRejectedValue(new Error('API connection error'));
    
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
      expect(screen.getByText(/Failed to fetch order lines: API connection error/)).toBeInTheDocument();
    });
  });
  
  it('should handle non-Error objects thrown during fetch', async () => {
    // Mock authenticated state
    (useOpenERP as vi.Mock).mockReturnValue({
      client: mockOpenERPClient,
      isAuthenticated: true
    });
    
    // Mock API throwing a string instead of an Error object
    mockOpenERPClient.getSaleOrderLines.mockRejectedValue('Server unavailable');
    
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
      expect(screen.getByText(/Failed to fetch order lines: Server unavailable/)).toBeInTheDocument();
    });
  });
  
  it('should handle camera detection errors', async () => {
    // Mock authenticated state
    (useOpenERP as vi.Mock).mockReturnValue({
      client: mockOpenERPClient,
      isAuthenticated: true
    });
    
    // Mock successful API call
    mockOpenERPClient.getSaleOrderLines.mockResolvedValue([
      {
        id: 1,
        product_id: [1, 'Champagne [TEST123]'],
        product_uom_qty: 2
      }
    ]);
    
    // Mock camera detection error
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {
        enumerateDevices: vi.fn().mockRejectedValue(new Error('Camera access denied')),
        getUserMedia: vi.fn().mockRejectedValue(new Error('Camera access denied'))
      },
      writable: true
    });
    
    // Spy on console.error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/orders/123']}>
          <Routes>
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Routes>
        </MemoryRouter>
      );
    });
    
    // Wait for order lines to be displayed (camera error shouldn't prevent this)
    await waitFor(() => {
      expect(screen.getByText(/2x TEST123/)).toBeInTheDocument();
    });
    
    // Check that console.error was called with camera detection error
    expect(consoleSpy).toHaveBeenCalledWith('Camera detection failed:', expect.any(Error));
    
    // Verify camera button is not present when camera detection fails
    expect(screen.queryByTitle('Take Photo')).not.toBeInTheDocument();
  });
});
