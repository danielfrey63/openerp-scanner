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

describe('OrderDetails Component - Filtering', () => {
  it('should only display champagne products', async () => {
    // Mock order lines with mixed products
    mockOpenERPClient.getSaleOrderLines.mockResolvedValue([
      {
        id: 1,
        product_id: [1, 'Champagne [TEST123]'],
        product_uom_qty: 2
      },
      {
        id: 2,
        product_id: [2, 'Wine [WINE456]'],
        product_uom_qty: 1
      },
      {
        id: 3,
        product_id: [3, 'Champagne [TEST789]'],
        product_uom_qty: 3
      }
    ]);
    
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
      expect(screen.getByText(/3x TEST789/)).toBeInTheDocument();
    });
    
    // Check that non-champagne product is not displayed
    expect(screen.queryByText(/1x WINE456/)).not.toBeInTheDocument();
  });

  // The remaining tests need to be updated since there is no search input in the component
  // We'll modify them to test other aspects of the component instead

  it('should select a product when clicked', async () => {
    // Mock order lines with multiple champagne products
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
    
    // Click on the first product
    const firstProduct = screen.getByText(/2x TEST123/);
    fireEvent.click(firstProduct);
    
    // Check that the product is selected (has 'selected' class)
    const productItem = firstProduct.closest('.item');
    expect(productItem).toHaveClass('selected');
  });
  
  it('should enable action buttons when a product is selected', async () => {
    // Mock order lines with champagne products
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
    
    // Find the disabled upload button
    const uploadButton = screen.getByAltText('Upload');
    const cameraButton = screen.getByAltText('Camera');
    
    // Verify buttons are initially disabled
    expect(uploadButton.closest('button')).toHaveClass('disabled');
    expect(cameraButton.closest('button')).toHaveClass('disabled');
    
    // Click on the first product to select it
    const firstProduct = screen.getByText(/2x TEST123/);
    fireEvent.click(firstProduct);
    
    // Check that the buttons are now enabled
    expect(uploadButton.closest('button')).not.toHaveClass('disabled');
    expect(cameraButton.closest('button')).not.toHaveClass('disabled');
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
});
