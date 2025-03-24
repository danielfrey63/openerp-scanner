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
import Camera from '@/components/Camera.js';

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
vi.mock('@/components/Camera.js', () => {
  return {
    default: vi.fn().mockImplementation(({ onScanComplete, onClose }) => (
      <div data-testid="camera-mock">
        <button data-testid="scan-button" onClick={() => onScanComplete('test-data')}>Scan</button>
        <button data-testid="close-button" onClick={onClose}>Close</button>
      </div>
    ))
  };
});

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

// Helper to mock no camera available
const mockNoCameraAvailable = () => {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      enumerateDevices: vi.fn().mockResolvedValue([]), // No video input devices
      getUserMedia: vi.fn().mockResolvedValue({})
    },
    writable: true
  });
};

// Helper to mock camera detection error - using a controlled approach
const mockCameraDetectionError = () => {
  // Instead of rejecting with an error, we'll use a custom implementation
  // that calls the error callback in the component
  const mockEnumerateDevices = vi.fn().mockImplementation(() => {
    // This simulates the behavior without throwing an actual error
    // The component's catch block will still be executed
    return Promise.resolve().then(() => {
      // Trigger the console.error in the component's catch block
      // by making the next then/catch in the component execute the catch
      return Promise.reject({ message: 'Camera detection failed' });
    });
  });
  
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      enumerateDevices: mockEnumerateDevices,
      getUserMedia: vi.fn().mockResolvedValue({})
    },
    writable: true
  });
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
  
  // Mock console.error to suppress warnings during tests
  vi.spyOn(console, 'error').mockImplementation(() => {});
  
  // Mock console.log to suppress output during tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  
  // Ensure Camera mock is properly setup
  (Camera as vi.Mock).mockImplementation(({ onScanComplete, onClose }) => (
    <div data-testid="camera-mock">
      <button data-testid="scan-button" onClick={() => onScanComplete('test-data')}>Scan</button>
      <button data-testid="close-button" onClick={onClose}>Close</button>
    </div>
  ));
});

// Cleanup after tests
afterEach(() => {
  vi.restoreAllMocks();
});

describe('OrderDetails Component - Camera Functionality', () => {
  it('should open camera when camera button is clicked', async () => {
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
      expect(screen.getByText('2x TEST123')).toBeInTheDocument();
    });
    
    // Select a product first
    const productElement = screen.getByText('2x TEST123');
    fireEvent.click(productElement);
    
    // Click the camera button
    const cameraButton = screen.getByAltText('Camera');
    fireEvent.click(cameraButton);
    
    // Check that camera component is displayed
    expect(screen.getByTestId('camera-mock')).toBeInTheDocument();
  });
  
  it('should process scanned data from camera', async () => {
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
      expect(screen.getByText('2x TEST123')).toBeInTheDocument();
    });
    
    // Select a product first
    const productElement = screen.getByText('2x TEST123');
    fireEvent.click(productElement);
    
    // Click the camera button to open camera
    const cameraButton = screen.getByAltText('Camera');
    fireEvent.click(cameraButton);
    
    // Verify camera is displayed
    await waitFor(() => {
      expect(screen.getByTestId('camera-mock')).toBeInTheDocument();
    });
    
    // Click the scan button in the camera mock
    const scanButton = screen.getByTestId('scan-button');
    fireEvent.click(scanButton);
    
    // Check that alert was called with the scanned data
    expect(alertSpy).toHaveBeenCalledWith('QR-Code erkannt: test-data');
    
    // Check that camera is closed after scanning
    expect(screen.queryByTestId('camera-mock')).not.toBeInTheDocument();
  });
  
  it('should not show camera button when no camera is available', async () => {
    // Mock no camera available
    mockNoCameraAvailable();
    
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
      expect(screen.getByText('2x TEST123')).toBeInTheDocument();
    });
    
    // Check that camera button is not displayed
    expect(screen.queryByAltText('Camera')).not.toBeInTheDocument();
  });
  
  it('should handle camera detection error', async () => {
    // Mock camera detection error
    mockCameraDetectionError();
    
    // Create a specific spy for this test to verify the error is logged
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
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
      expect(screen.getByText('2x TEST123')).toBeInTheDocument();
    });
    
    // Verify that console.error was called with the camera detection error
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    // Check that camera button is not displayed
    expect(screen.queryByAltText('Camera')).not.toBeInTheDocument();
  });
});
