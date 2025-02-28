import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpenERP } from '../context/OpenERPContext';

interface OrderLine {
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
        setOrderLines(lines);
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
      <h2>Order Details</h2>
      {error && <div className="error">{error}</div>}
      <div className="order-lines">
        {orderLines.map((line, index) => (
          <div
            key={line.id}
            className={`line-item ${selectedLine === index ? 'selected' : ''}`}
            onClick={() => setSelectedLine(index)}
          >
            {line.product_uom_qty}x {line.product_id[1]}
          </div>
        ))}
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
      <button onClick={() => navigate('/orders')}>Back to Orders</button>
    </div>
  );
};

export default OrderDetails;