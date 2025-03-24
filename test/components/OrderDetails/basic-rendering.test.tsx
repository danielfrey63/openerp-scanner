// @ts-nocheck
import * as React from 'react';
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

describe('OrderDetails Component - Basic Rendering', () => {
  it('should render the component with order details title', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/orders/123']}>
          <Routes>
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Routes>
        </MemoryRouter>
      );
    });
    
    // Check that the title is rendered
    expect(screen.getByText('Order Details')).toBeInTheDocument();
  });
  
  it('should render the logo', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/orders/123']}>
          <Routes>
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Routes>
        </MemoryRouter>
      );
    });
    
    // Check that the logo is rendered
    expect(screen.getByAltText('Logo')).toBeInTheDocument();
  });
  
  it('should render action buttons', async () => {
    await act(async () => {
      render(
        <MemoryRouter initialEntries={['/orders/123']}>
          <Routes>
            <Route path="/orders/:orderId" element={<OrderDetails />} />
          </Routes>
        </MemoryRouter>
      );
    });
    
    // Check that action buttons are rendered
    expect(screen.getByTitle('Back to Orders')).toBeInTheDocument();
    expect(screen.getByAltText('Upload')).toBeInTheDocument();
    expect(screen.getByAltText('Camera')).toBeInTheDocument();
  });
});
