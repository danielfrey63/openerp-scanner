import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenERP } from '../context/OpenERPContext';

interface Order {
  id: number;
  name: string;
  partner_id: [number, string];
}

const OrderList: React.FC = () => {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [error, setError] = React.useState('');
  const navigate = useNavigate();
  const { client, isAuthenticated } = useOpenERP();

  React.useEffect(() => {
    const fetchOrders = async () => {
      try {
        if (!client || !isAuthenticated) {
          throw new Error('Not authenticated');
        }
        
        const orders = await client.getOpenSaleOrders();
        setOrders(orders);
      } catch (err) {
        setError('Failed to fetch orders: ' + (err instanceof Error ? err.message : String(err)));
        
        // If not authenticated, redirect to login
        if (err instanceof Error && err.message === 'Not authenticated') {
          navigate('/');
        }
      }
    };

    fetchOrders();
  }, [client, isAuthenticated, navigate]);

  const handleOrderClick = (orderId: number) => {
    navigate(`/orders/${orderId}`);
  };

  return (
    <div className="orders-list">
      <h2>Open Sale Orders</h2>
      {error && <div className="error">{error}</div>}
      {orders.length === 0 && !error && <div>Loading orders...</div>}
      {orders.map(order => (
        <div
          key={order.id}
          className="order-item"
          onClick={() => handleOrderClick(order.id)}
        >
          {order.name} - {order.partner_id[1]}
        </div>
      ))}
    </div>
  );
};

export default OrderList;