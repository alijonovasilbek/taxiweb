import { useEffect } from 'react';
import { getSocket } from '../services/socket';
import { useRideStore } from '../store/rideStore';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from './useTelegram';

export function useDriverSocket() {
  const navigate = useNavigate();
  const { tg } = useTelegram();
  const { setPendingOrder, clearPending, setActiveRide, clearRide } = useRideStore();

  useEffect(() => {
    const socket = getSocket();

    socket.on('new_order', (order) => {
      tg.HapticFeedback?.notificationOccurred('warning');
      setPendingOrder(order);
      navigate('/new-order');
    });

    socket.on('new_order_timeout', ({ orderId }) => {
      clearPending();
      navigate('/dashboard');
    });

    socket.on('order_cancelled', ({ orderId }) => {
      clearPending();
      clearRide();
      navigate('/dashboard');
    });

    socket.on('payment_confirmed', () => {
      clearRide();
    });

    return () => {
      socket.off('new_order');
      socket.off('new_order_timeout');
      socket.off('order_cancelled');
      socket.off('payment_confirmed');
    };
  }, []);
}
