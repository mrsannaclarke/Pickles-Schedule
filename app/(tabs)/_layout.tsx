import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';

export default function TabLayout() {
  const auth = useAuth();

  if (auth.status !== 'signed_in') {
    return (
      <View style={styles.authContainer}>
        <Text style={styles.authTitle}>Pickles Schedule</Text>
        <Text style={styles.authText}>Sign in with Google to use the staff schedule views.</Text>
        {auth.errorMessage ? <Text style={styles.authError}>{auth.errorMessage}</Text> : null}

        {auth.status === 'signing_in' ? (
          <ActivityIndicator color="#ffd33d" />
        ) : (
          <Pressable style={styles.googleButton} onPress={() => void auth.signIn()} disabled={!auth.canSignIn}>
            <Text style={styles.googleButtonText}>
              {auth.canSignIn ? 'Sign In With Google' : 'Google Sign-In Not Configured'}
            </Text>
          </Pressable>
        )}

        <Text style={styles.guestLabel}>Counter Guest Access</Text>
        <View style={styles.guestRow}>
          <Pressable style={styles.guestButton} onPress={() => auth.signInAsGuest('Jacob')}>
            <Text style={styles.guestButtonText}>Jacob</Text>
          </Pressable>
          <Pressable style={styles.guestButton} onPress={() => auth.signInAsGuest('Jason')}>
            <Text style={styles.guestButtonText}>Jason</Text>
          </Pressable>
          <Pressable style={styles.guestButton} onPress={() => auth.signInAsGuest('Kevin')}>
            <Text style={styles.guestButtonText}>Kevin</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffd33d',
        headerStyle: {
          backgroundColor: '#25292e',
        },
        headerShadowVisible: false,
        headerTintColor: '#fff',
        headerRight: () => (
          <Pressable style={styles.switchUserButton} onPress={auth.signOut}>
            <Text style={styles.switchUserButtonText}>Switch User</Text>
          </Pressable>
        ),
        tabBarStyle: {
          backgroundColor: '#25292e',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Next Up',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'flash' : 'flash-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-games"
        options={{
          title: 'My Games',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="claim-spot"
        options={{
          title: 'Sign Up',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} color={color} size={24} />
          ),
        }}
      />
      {auth.user?.canViewInfo ? (
        <Tabs.Screen
          name="about"
          options={{
            title: 'Info',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'information-circle' : 'information-circle-outline'} color={color} size={24} />
            ),
          }}
        />
      ) : null}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  authContainer: {
    flex: 1,
    backgroundColor: '#111417',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  authTitle: {
    color: '#f3f5f7',
    fontSize: 30,
    fontWeight: '700',
  },
  authText: {
    color: '#d2dae0',
    lineHeight: 22,
  },
  authError: {
    color: '#ff9db1',
    lineHeight: 22,
  },
  googleButton: {
    backgroundColor: '#ffd33d',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  googleButtonText: {
    color: '#25292e',
    fontWeight: '700',
  },
  guestLabel: {
    color: '#a4b0b7',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  guestRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  guestButton: {
    backgroundColor: '#2b333a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  guestButtonText: {
    color: '#e0e8ee',
    fontWeight: '700',
  },
  switchUserButton: {
    backgroundColor: '#2b333a',
    borderRadius: 8,
    marginRight: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  switchUserButtonText: {
    color: '#e0e8ee',
    fontSize: 12,
    fontWeight: '700',
  },
});
