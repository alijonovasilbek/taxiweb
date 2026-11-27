import { Redirect } from 'expo-router';

import { useAuth } from '../store/auth';

export default function Index() {
  const status = useAuth((s) => s.status);
  if (status !== 'signedIn') return <Redirect href="/login" />;
  return <Redirect href="/(tabs)" />;
}
