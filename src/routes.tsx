import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Login from './components/Login';
import OrderList from './components/OrderList';
import OrderDetails from './components/OrderDetails';

export const router = createBrowserRouter([
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
        element: <OrderList />
      },
      {
        path: '/orders/:orderId',
        element: <OrderDetails />
      }
    ]
  }
]);