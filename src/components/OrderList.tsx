import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OpenERPClient } from '@danielfrey63/openerp-ts-client';

interface Order {
  id: number;
  name: string;
  partner_id: [number, string];
}

const OrderList: React.FC = () => {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [error, setError] = React.useState('');
  const navigate = useNavigate();

  React.useEffect(() => {
    const fetchOrders = async () => {
      try {
        const baseUrl = import.meta.env.VITE_OPENERP_BASE_URL;
        if (!baseUrl) {
          throw new Error('OpenERP base URL is not configured');
        }
        
        const client = new OpenERPClient({ baseUrl: import.meta.env.VITE_OPENERP_BASE_URL });
        const orders = await client.getOpenSaleOrders();
        setOrders(orders);
      } catch (err) {
        setError('Failed to fetch orders: ' + (err instanceof Error ? err.message : String(err)));
      }
    };

    fetchOrders();
  }, []);

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