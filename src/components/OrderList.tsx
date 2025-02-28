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
        
        try {
          const orders = await client.getOpenSaleOrders();
          setOrders(orders);
        } catch (apiError) {
          console.error('API Error:', apiError);
          // Sicherere Fehlerbehandlung
          let errorMessage = 'Failed to fetch orders';
          if (apiError && typeof apiError === 'object') {
            errorMessage += ': ' + ((apiError as any).message || JSON.stringify(apiError));
          } else {
            errorMessage += ': ' + String(apiError);
          }
          setError(errorMessage);
        }
      } catch (err) {
        console.error('Authentication Error:', err);
        setError('Authentication error: ' + (err instanceof Error ? err.message : String(err)));
        
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
      <div className="header-container">
        <h2>Open Sale Orders</h2>
        <div className="action-buttons">
          <button 
            onClick={() => {
              setOrders([]);
              setError('');
              const fetchOrders = async () => {
                try {
                  if (!client || !isAuthenticated) {
                    throw new Error('Not authenticated');
                  }
                  
                  try {
                    const orders = await client.getOpenSaleOrders();
                    setOrders(orders);
                  } catch (apiError) {
                    console.error('API Error:', apiError);
                    // Sicherere Fehlerbehandlung
                    let errorMessage = 'Failed to fetch orders';
                    if (apiError && typeof apiError === 'object') {
                      errorMessage += ': ' + ((apiError as any).message || JSON.stringify(apiError));
                    } else {
                      errorMessage += ': ' + String(apiError);
                    }
                    setError(errorMessage);
                  }
                } catch (err) {
                  console.error('Authentication Error:', err);
                  setError('Authentication error: ' + (err instanceof Error ? err.message : String(err)));
                  
                  // If not authenticated, redirect to login
                  if (err instanceof Error && err.message === 'Not authenticated') {
                    navigate('/');
                  }
                }
              };
              fetchOrders();
            }} 
            className="default icon-button" 
            title="Refresh Orders"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
          </button>
        </div>
      </div>
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