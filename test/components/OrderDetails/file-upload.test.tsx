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
const mockFileInput = {
  click: vi.fn(),
  type: 'file',
  accept: 'image/*',
  onchange: null,
  files: [new File(['dummy content'], 'test.png', { type: 'image/png' })]
};

// Store the original createElement function
const originalCreateElement = document.createElement.bind(document);

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
  document.createElement = vi.fn().mockImplementation((tag) => {
    if (tag === 'input') {
      return mockFileInput;
    }
    // For other elements, use the original implementation
    return originalCreateElement(tag);
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
  
  // Mock console.error
  vi.spyOn(console, 'error').mockImplementation(() => {});
  
  // Mock console.log to suppress output during tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

// Restore original createElement after tests
afterEach(() => {
  document.createElement = originalCreateElement;
  vi.restoreAllMocks();
});

describe('OrderDetails Component - File Upload', () => {
  it('should open file input when upload button is clicked', async () => {
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
    
    // Select a product first
    const productElement = screen.getByText(/2x TEST123/);
    fireEvent.click(productElement);
    
    // Click the upload button
    const uploadButton = screen.getByAltText('Upload');
    fireEvent.click(uploadButton);
    
    // Check that file input click was triggered
    expect(mockFileInput.click).toHaveBeenCalled();
  });
  
  it('should process uploaded file', async () => {
    // Spy on window.alert
    const alertSpy = vi.spyOn(window, 'alert');
    
    // Mock qrCodeScanner.scanFromFile to return a successful result
    qrCodeScanner.scanFromFile.mockResolvedValue('test-qr-data');
    
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
    
    // Select a product first
    const productElement = screen.getByText(/2x TEST123/);
    fireEvent.click(productElement);
    
    // Create a test file
    const file = new File(['test file content'], 'test.jpg', { type: 'image/jpeg' });
    
    // Click the upload button
    const uploadButton = screen.getByAltText('Upload');
    
    // Simulate the file selection
    await act(async () => {
      fireEvent.click(uploadButton);
      
      // Trigger change event with the file
      mockFileInput.files = [file];
      mockFileInput.onchange && mockFileInput.onchange({ target: mockFileInput });
    });
    
    // Wait for the QR code scanning to complete
    await waitFor(() => {
      expect(qrCodeScanner.scanFromFile).toHaveBeenCalledWith(file);
      expect(alertSpy).toHaveBeenCalledWith('QR-Code erkannt: test-qr-data');
    });
  });
  
  it('should handle file upload error', async () => {
    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
    // Mock qrCodeScanner.scanFromFile to throw an error
    qrCodeScanner.scanFromFile.mockRejectedValue(new Error('QR code scanning failed'));
    
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
    
    // Select a product first
    const productElement = screen.getByText(/2x TEST123/);
    fireEvent.click(productElement);
    
    // Create a test file
    const file = new File(['test file content'], 'test.jpg', { type: 'image/jpeg' });
    
    // Click the upload button
    const uploadButton = screen.getByAltText('Upload');
    
    // Simulate the file selection
    await act(async () => {
      fireEvent.click(uploadButton);
      
      // Trigger change event with the file
      mockFileInput.files = [file];
      mockFileInput.onchange && mockFileInput.onchange({ target: mockFileInput });
    });
    
    // Wait for the error to be logged to console
    await waitFor(() => {
      expect(qrCodeScanner.scanFromFile).toHaveBeenCalledWith(file);
      expect(consoleErrorSpy).toHaveBeenCalledWith('QR-Code Scan Fehler:', expect.any(Error));
    });
  });
  
  it('should not process upload if no file is selected', async () => {
    // Spy on window.alert
    const alertSpy = vi.spyOn(window, 'alert');
    
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
    
    // Select a product first
    const productElement = screen.getByText(/2x TEST123/);
    fireEvent.click(productElement);
    
    // Click the upload button
    const uploadButton = screen.getByAltText('Upload');
    
    // Simulate the file selection with no files
    await act(async () => {
      fireEvent.click(uploadButton);
      
      // Trigger change event with no files
      mockFileInput.files = [];
      mockFileInput.onchange && mockFileInput.onchange({ target: mockFileInput });
    });
    
    // Check that no alert was shown
    expect(alertSpy).not.toHaveBeenCalled();
    expect(qrCodeScanner.scanFromFile).not.toHaveBeenCalled();
  });
});
