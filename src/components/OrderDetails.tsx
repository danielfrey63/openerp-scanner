import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpenERP } from '@/context/OpenERPContext.js';
import { OrderLine as ClientOrderLine } from '@danielfrey63/openerp-ts-client';
import BackIcon from '@/icons/back-icon.svg';
import Logo from '@/icons/logo.svg';
import UploadIcon from '@/icons/upload-icon.svg';
import CameraIcon from '@/icons/camera-icon.svg';
import Camera from '@/components/Camera.js';
import { qrCodeScanner } from '@/components/QRCodeScanner.js';

interface OrderLine extends ClientOrderLine {
  id: number;
  product_id: [number, string];
  product_uom_qty: number;
}

const OrderDetails: React.FC = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const { client, isAuthenticated } = useOpenERP();

  // Überprüfen, ob das Gerät eine Kamera hat
  useEffect(() => {
    const detectCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasCamera(devices.some(device => device.kind === 'videoinput'));
      } catch (error) {
        console.error('Camera detection failed:', error);
        setHasCamera(false);
      }
    };
    
    detectCamera();
  }, []);

  useEffect(() => {
    const fetchOrderLines = async () => {
      try {
        if (!client || !isAuthenticated) {
          throw new Error('Not authenticated');
        }

        if (!orderId) {
          throw new Error('Order ID is required');
        }

        const lines = await client.getSaleOrderLines(parseInt(orderId));
        // Convert the returned lines to match our OrderLine interface
        const typedLines = lines.map(line => ({
          ...line,
          id: (line as any).id || Math.random() // Use existing id or generate a random one
        })) as OrderLine[];
        setOrderLines(typedLines);
      } catch (err) {
        setError('Failed to fetch order lines: ' + (err instanceof Error ? err.message : String(err)));
        
        // If not authenticated, redirect to login
        if (err instanceof Error && err.message === 'Not authenticated') {
          navigate('/');
        }
      }
    };

    if (orderId) {
      fetchOrderLines();
    }
  }, [client, isAuthenticated, orderId, navigate]);

  const handleScanComplete = (data: string) => {
    console.log('QR Code gescannt:', data);
    
    // Zeige ein einfaches Alert mit den gescannten Daten
    alert(`QR-Code erkannt: ${data}`);
    
    // Schließe die Kamera
    setShowCamera(false);
  };

  return (
    <div className="list">
      <div className="header-container">
        <div className="title-with-logo">
          <img src={Logo} alt="Logo" className="header-logo" />
          <h2>Order Details</h2>
        </div>
        <div className="action-buttons">
          <button 
            onClick={() => navigate('/orders')} 
            className={`icon-button ${selectedLine === null ? 'default' : 'secondary'}`}
            title="Back to Orders"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate('/orders');
              }
            }}
            tabIndex={0}
          >
            <img src={BackIcon} alt="Back" />
          </button>
          <button 
            onClick={() => {
              if (selectedLine !== null) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  
                  try {
                    const result = await qrCodeScanner.scanFromFile(file);
                    
                    if (result) {
                      handleScanComplete(result);
                    } else {
                      console.error('Kein QR-Code im Bild gefunden');
                    }
                  } catch (err) {
                    console.error('QR-Code Scan Fehler:', err);
                  }
                };
                input.click();
              }
            }} 
            className={`icon-button ${selectedLine === null ? 'disabled' : ''}`}
            disabled={selectedLine === null}
            title={selectedLine === null ? "Bitte zuerst ein Produkt auswählen" : "Upload Image"}
            tabIndex={selectedLine === null ? -1 : 0}
          >
            <img src={UploadIcon} alt="Upload" />
          </button>
          {hasCamera && (
            <button 
              onClick={() => {
                if (selectedLine !== null) {
                  setShowCamera(true);
                }
              }} 
              className={`icon-button ${selectedLine === null ? 'disabled' : 'default'}`}
              disabled={selectedLine === null}
              title={selectedLine === null ? "Bitte zuerst ein Produkt auswählen" : "Take Photo"}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && selectedLine !== null) {
                  setShowCamera(true);
                }
              }}
              tabIndex={selectedLine === null ? -1 : 0}
            >
              <img src={CameraIcon} alt="Camera" />
            </button>
          )}
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      
      {showCamera ? (
        <div className="scanner-section">
          <Camera 
            onScanComplete={handleScanComplete} 
            onClose={() => setShowCamera(false)}
          />
        </div>
      ) : (
        <div className="order-lines">
          {orderLines
            .filter(line => line.product_id[1].includes('Champagne'))
            .map((line, index) => {
              const productCodeMatch = line.product_id[1].match(/\[(.*?)\]/);
              const productCode = productCodeMatch ? productCodeMatch[1] : '';
              
              return (
                <div
                  key={line.id}
                  className={`item ${selectedLine === index ? 'selected' : ''}`}
                  onClick={() => {setSelectedLine(selectedLine === index ? null : index);}}
                >
                  {line.product_uom_qty}x {productCode}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default OrderDetails;