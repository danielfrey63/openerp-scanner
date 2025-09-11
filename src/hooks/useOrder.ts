import React from 'react';
import { orderRepo } from '@/data/orderRepo.js';

export function useOrder(orderId: number) {
  const [state, setState] = React.useState(() => orderRepo.getOrder(orderId));

  React.useEffect(() => {
    setState(orderRepo.getOrder(orderId));
    const unsub = orderRepo.subscribeOrder(orderId, () => {
      setState(orderRepo.getOrder(orderId));
    });
    return () => unsub();
  }, [orderId]);

  return state;
}
