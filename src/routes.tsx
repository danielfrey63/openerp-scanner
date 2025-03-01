import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Login from './components/Login';
import OrderList from './components/OrderList';
import OrderDetails from './components/OrderDetails';
import ProtectedRoute from './components/ProtectedRoute';

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <App />,
      children: [
        {
          path: '/',
          element: <Login />
        },
        {
          path: '/orders',
          element: <ProtectedRoute><OrderList /></ProtectedRoute>
        },
        {
          path: '/orders/:orderId',
          element: <ProtectedRoute><OrderDetails /></ProtectedRoute>
        }
      ]
    }
  ],
  {
    basename: undefined,
    future: {
      v7_normalizeFormMethod: true,
      v7_relativeSplatPath: true,
      v7_startTransition: true
    }
  }
);