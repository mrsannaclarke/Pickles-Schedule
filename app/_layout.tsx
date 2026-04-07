import { Stack } from 'expo-router';

import { AuthProvider } from '@/lib/auth';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="game/[eventId]" options={{ title: 'Game' }} />
      </Stack>
    </AuthProvider>
  );
}
