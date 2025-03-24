// @ts-nocheck
import * as React from 'react';
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest';
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
const mockFileInput = {
  click: vi.fn(),
  type: 'file',
  accept: 'image/*',
  onchange: null,
  files: [new File(['dummy content'], 'test.png', { type: 'image/png' })]
};

// Original createElement function
const originalCreateElement = document.createElement;

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
  
  // Mock document.createElement for file input
  document.createElement = vi.fn((tag) => {
    if (tag === 'input') {
      return mockFileInput;
    }
    // For other elements, create a real DOM element
    return originalCreateElement.call(document, tag);
  });
  
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

// Restore original createElement after tests
afterEach(() => {
  document.createElement = originalCreateElement;
  vi.restoreAllMocks();
});

describe('OrderDetails Component - Product Selection', () => {
  it('should select a product when clicked', async () => {
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
    
    // Click on the first product
    const firstProduct = screen.getByText(/2x TEST123/);
    fireEvent.click(firstProduct);
    
    // Check that the product is selected (has 'selected' class)
    const productItem = firstProduct.closest('.item');
    expect(productItem).toHaveClass('selected');
  });

  it('should deselect a product when clicked again', async () => {
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
    
    // Click on the first product to select it
    const firstProduct = screen.getByText(/2x TEST123/);
    fireEvent.click(firstProduct);
    
    // Click on it again to deselect
    fireEvent.click(firstProduct);
    
    // Check that the product is not selected
    const productItem = firstProduct.closest('.item');
    expect(productItem).not.toHaveClass('selected');
  });

  it('should enable action buttons when a product is selected', async () => {
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
    
    // Find the disabled upload button by its title
    const uploadButton = screen.getByAltText('Upload');
    const cameraButton = screen.getByAltText('Camera');
    
    expect(uploadButton.closest('button')).toHaveClass('disabled');
    expect(cameraButton.closest('button')).toHaveClass('disabled');
    
    // Click on the first product
    const firstProduct = screen.getByText(/2x TEST123/);
    fireEvent.click(firstProduct);
    
    // Check that the buttons are now enabled
    expect(uploadButton.closest('button')).not.toHaveClass('disabled');
    expect(cameraButton.closest('button')).not.toHaveClass('disabled');
  });
});
