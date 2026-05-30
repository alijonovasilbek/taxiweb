import { useEffect } from 'react';
import { getSocket } from '../services/socket';
import { useOrderStore } from '../store/orderStore';
import { useNavigate } from 'react-router-dom';

export function useOrderSocket(orderId) {
  const navigate = useNavigate();
  const { setDriverLocation, setDriver, setActiveOrder } = useOrderStore();

  useEffect(() => {
    if (!orderId) return;
    const socket = getSocket();
    socket.emit('passenger:track_order', { orderId });

    const handlers = {
      order_accepted: ({ driver }) => { setDriver(driver); },
      driver_location: ({ lat, lng, heading }) => setDriverLocation({ lat, lng, heading }),
      driver_arrived: () => setActiveOrder((o) => ({ ...o, status: 'driver_arrived' })),
      ride_started: () => setActiveOrder((o) => ({ ...o, status: 'in_progress' })),
      ride_completed: ({ finalPrice }) => {
        setActiveOrder((o) => ({ ...o, status: 'completed', finalPrice }));
        navigate(`/payment/${orderId}`);
      },
      order_cancelled: () => {
        setActiveOrder(null);
        navigate('/');
      },
      no_drivers_found: () => {
        setActiveOrder(null);
        navigate('/');
      },
      payment_confirmed: () => navigate(`/rating/${orderId}`),
    };

    Object.entries(handlers).forEach(([evt, fn]) => socket.on(evt, fn));
    return () => Object.entries(handlers).forEach(([evt, fn]) => socket.off(evt, fn));
  }, [orderId]);
}
