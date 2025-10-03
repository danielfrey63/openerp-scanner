import { createBrowserRouter } from 'react-router-dom';
import App from '@/App.js';
import Login from '@/components/Login.js';
import OrderList from '@/components/OrderList.js';
import OrderDetails from '@/components/OrderDetails.js';
import ProtectedRoute from '@/components/ProtectedRoute.js';
import CacheInitializer from '@/components/CacheInitializer.js';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        path: '',
        element: <Login />
      },
      {
        path: 'cache-initializer',
        element: <ProtectedRoute><CacheInitializer
          onComplete={() => window.location.href = '/orders'}
          onError={(error) => {
            console.error('Cache initialization failed:', error);
            window.location.href = '/orders';
          }}
        /></ProtectedRoute>
      },
      {
        path: 'orders',
        element: <ProtectedRoute><OrderList /></ProtectedRoute>
      },
      {
        path: 'orders/:orderId',
        element: <ProtectedRoute><OrderDetails /></ProtectedRoute>
      }
    ]
  }
]);