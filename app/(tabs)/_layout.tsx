import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/lib/auth';

export default function TabLayout() {
  const auth = useAuth();
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestPassword, setGuestPassword] = useState('');

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
        <Text style={styles.guestHint}>First name: Jacob or Kevin</Text>
        <View style={styles.guestForm}>
          <TextInput
            style={styles.guestInput}
            value={guestFirstName}
            onChangeText={setGuestFirstName}
            placeholder="First name"
            placeholderTextColor="#8d99a3"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.guestInput}
            value={guestPassword}
            onChangeText={setGuestPassword}
            placeholder="Password"
            placeholderTextColor="#8d99a3"
            secureTextEntry
          />
          <Pressable
            style={styles.guestButton}
            onPress={() => auth.signInAsGuest(guestFirstName, guestPassword)}>
            <Text style={styles.guestButtonText}>Guest Login</Text>
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
  guestHint: {
    color: '#9aa7b0',
    fontSize: 12,
    marginTop: -4,
  },
  guestForm: {
    width: '100%',
    maxWidth: 320,
    gap: 8,
  },
  guestInput: {
    backgroundColor: '#1b2127',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a4046',
    color: '#e0e8ee',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  guestButton: {
    backgroundColor: '#2b333a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
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
