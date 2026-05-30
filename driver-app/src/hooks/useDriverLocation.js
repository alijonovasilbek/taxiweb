import { useEffect, useRef } from 'react';
import { getSocket } from '../services/socket';
import { useDriverStore } from '../store/driverStore';
import { useRideStore } from '../store/rideStore';

const INTERVAL_MS = 4000;

export function useDriverLocation() {
  const { driver } = useDriverStore();
  const { isOnline } = useRideStore();
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!isOnline || !driver?.id) {
      clearInterval(intervalRef.current);
      return;
    }

    const socket = getSocket();

    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          socket.emit('driver:location_update', {
            driverId: driver.id,
            lat: coords.latitude,
            lng: coords.longitude,
            heading: coords.heading,
            speed: coords.speed,
          });
        },
        null,
        { enableHighAccuracy: true, timeout: 3000, maximumAge: 0 }
      );
    }, INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [isOnline, driver?.id]);
}
