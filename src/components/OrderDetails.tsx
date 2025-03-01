import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpenERP } from '../context/OpenERPContext';
import { OrderLine as ClientOrderLine } from '@danielfrey63/openerp-ts-client';

interface OrderLine extends ClientOrderLine {
  id: number;
  product_id: [number, string];
  product_uom_qty: number;
}

const OrderDetails: React.FC = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [orderLines, setOrderLines] = React.useState<OrderLine[]>([]);
  const [selectedLine, setSelectedLine] = React.useState<number | null>(null);
  const [scanning, setScanning] = React.useState(false);
  const [error, setError] = React.useState('');
  const { client, isAuthenticated } = useOpenERP();

  React.useEffect(() => {
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

  const startScanning = async () => {
    if (selectedLine === null) return;
    setScanning(true);
    // TODO: Implement scanning logic
  };

  return (
    <div className="order-details">
      <div className="header-container">
        <h2>Order Details</h2>
        <div className="action-buttons">
          <button 
            onClick={() => navigate('/orders')} 
            className="default icon-button" 
            title="Back to Orders"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <line x1="12" y1="19" x2="5" y2="12" />
              <line x1="12" y1="5" x2="5" y2="12" />
            </svg>
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      <div className="order-lines">
        {orderLines
          .filter(line => line.product_id[1].includes('Champagne'))
          .map((line, index) => {
            // Extrahiere den Produktcode aus den eckigen Klammern (ohne die Klammern selbst)
            const productCodeMatch = line.product_id[1].match(/\[(.*?)\]/);
            const productCode = productCodeMatch ? productCodeMatch[1] : '';
            
            return (
              <div
                key={line.id}
                className={`line-item ${selectedLine === index ? 'selected' : ''}`}
                onClick={() => setSelectedLine(index)}
              >
                {line.product_uom_qty}x {productCode}
              </div>
            );
          })}
      </div>
      {selectedLine !== null && (
        <div className="scanner-section">
          {scanning ? (
            <div className="scanner-container">
              <video id="scanner" />
            </div>
          ) : (
            <button onClick={startScanning}>Scan Product Code</button>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderDetails;