import { Redirect } from 'expo-router';

import { useAuth } from '../store/auth';

/** Kirish → ruxsatlar ustasi (bir marta) → asosiy ilova */
export default function Index() {
  const { status, permissionsDone } = useAuth();
  if (status !== 'signedIn') return <Redirect href="/login" />;
  if (!permissionsDone) return <Redirect href="/permissions" />;
  return <Redirect href="/(tabs)" />;
}
