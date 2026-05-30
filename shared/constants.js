const ORDER_STATUS = {
  SEARCHING: 'searching',
  ACCEPTED: 'accepted',
  DRIVER_ARRIVED: 'driver_arrived',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  NO_DRIVERS: 'no_drivers',
};

const DRIVER_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  BLOCKED: 'blocked',
  REJECTED: 'rejected',
};

const PAYMENT_METHOD = {
  CASH: 'cash',
  PAYME: 'payme',
  CLICK: 'click',
  TELEGRAM: 'telegram',
};

const SOCKET_EVENTS = {
  DRIVER_GO_ONLINE: 'driver:go_online',
  DRIVER_GO_OFFLINE: 'driver:go_offline',
  DRIVER_LOCATION_UPDATE: 'driver:location_update',
  DRIVER_ACCEPT_ORDER: 'driver:accept_order',
  DRIVER_REJECT_ORDER: 'driver:reject_order',
  DRIVER_ARRIVED: 'driver:arrived',
  DRIVER_START_RIDE: 'driver:start_ride',
  DRIVER_COMPLETE_RIDE: 'driver:complete_ride',

  NEW_ORDER: 'new_order',
  ORDER_ACCEPTED: 'order_accepted',
  ORDER_REJECTED: 'order_rejected',
  DRIVER_LOCATION: 'driver_location',
  RIDE_STARTED: 'ride_started',
  RIDE_COMPLETED: 'ride_completed',
  ORDER_CANCELLED: 'order_cancelled',
  NO_DRIVERS_FOUND: 'no_drivers_found',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  NEW_ORDER_TIMEOUT: 'new_order_timeout',
};

module.exports = { ORDER_STATUS, DRIVER_STATUS, PAYMENT_METHOD, SOCKET_EVENTS };
