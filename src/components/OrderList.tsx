import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenERP } from '@/context/OpenERPContext';
import BackIcon from '@/icons/back-icon.svg';
import RefreshIcon from '@/icons/refresh-icon.svg';
import Logo from '@/icons/logo.svg';

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
    <div className="list">
      <div className="header-container">
        <div className="title-with-logo">
          <img src={Logo} alt="Logo" className="header-logo" />
          <h2>Open Sale Orders</h2>
        </div>
        <div className="action-buttons">
          <button 
            onClick={() => navigate('/')} 
            className="icon-button secondary" 
            title="Back to Login"
          >
            <img src={BackIcon} alt="Back" />
          </button>
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
            <img src={RefreshIcon} alt="Refresh" />
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {orders.map(order => (
        <div
          key={order.id}
          className="item"
          onClick={() => handleOrderClick(order.id)}
        >
          {order.name} - {order.partner_id[1]}
        </div>
      ))}
    </div>
  );
};

export default OrderList;