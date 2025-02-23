import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

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

  React.useEffect(() => {
    // TODO: Implement fetching order lines from OpenERP
    const fetchOrderLines = async () => {
      try {
        // Placeholder data
        const mockOrderLines: OrderLine[] = [
          { id: 1, product_id: [1, 'Product A'], product_uom_qty: 2 },
          { id: 2, product_id: [2, 'Product B'], product_uom_qty: 1 },
        ];
        setOrderLines(mockOrderLines);
      } catch (err) {
        setError('Failed to fetch order lines');
      }
    };

    if (orderId) {
      fetchOrderLines();
    }
  }, [orderId]);

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