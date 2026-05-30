export function formatPrice(amount) {
  return new Intl.NumberFormat('uz-UZ').format(amount) + ' so\'m';
}

export function formatDistance(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

export function formatDuration(min) {
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} soat ${min % 60} min`;
}
