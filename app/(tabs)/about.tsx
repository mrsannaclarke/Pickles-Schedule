import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SHARED_SUBMISSIONS_URL } from '@/lib/app-links';
import { useAuth } from '@/lib/auth';

export default function AboutScreen() {
  const auth = useAuth();

  if (!auth.user?.canViewInfo) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>This page is only available to admin logins.</Text>
      </View>
    );
  }

  const openSubmissions = () => {
    void Linking.openURL(SHARED_SUBMISSIONS_URL);
  };

  const openAnnaMail = () => {
    void Linking.openURL('mailto:admin@anatomytattoo.com?subject=pickles%20app');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Signed in: {auth.user?.email ?? 'Unknown'}</Text>

      <Pressable style={styles.submissionsButton} onPress={openSubmissions}>
        <Text style={styles.submissionsButtonText}>Open Shared Submissions</Text>
      </Pressable>

      <Text style={styles.text}>
        Made by{' '}
        <Text style={styles.creditLink} onPress={openAnnaMail}>
          Anna Clarke
        </Text>{' '}
        - Hell Yeah
      </Text>

      <Pressable style={styles.signOutButton} onPress={auth.signOut}>
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111417',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: 20,
    gap: 12,
  },
  text: {
    color: '#d2dae0',
    lineHeight: 22,
  },
  creditLink: {
    color: '#8cc7ff',
    textDecorationLine: 'underline',
    fontWeight: '700',
  },
  submissionsButton: {
    marginTop: 4,
    backgroundColor: '#1f7a3f',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  submissionsButtonText: {
    color: '#f5fff8',
    fontWeight: '700',
  },
  signOutButton: {
    marginTop: 4,
    backgroundColor: '#3a2327',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  signOutButtonText: {
    color: '#ffd7de',
    fontWeight: '700',
  },
});
