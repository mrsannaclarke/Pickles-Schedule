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

  const openPicklesSite = () => {
    void Linking.openURL('https://www.portlandpicklesbaseball.com');
  };

  const openCherryBombsSite = () => {
    void Linking.openURL('https://www.cherrybombsfc.com');
  };

  const openBangersSite = () => {
    void Linking.openURL('https://www.portlandbangers.com');
  };

  return (
    <View style={styles.container}>
      <View style={styles.linksRow}>
        <Pressable style={[styles.teamLinkButton, styles.picklesLinkButton]} onPress={openPicklesSite}>
          <Text style={styles.teamLinkText}>Pickles</Text>
        </Pressable>
        <Pressable style={[styles.teamLinkButton, styles.cherryLinkButton]} onPress={openCherryBombsSite}>
          <Text style={styles.teamLinkText}>Cherry Bombs</Text>
        </Pressable>
        <Pressable style={[styles.teamLinkButton, styles.bangersLinkButton]} onPress={openBangersSite}>
          <Text style={styles.teamLinkText}>Bangers</Text>
        </Pressable>
      </View>

      <Text style={styles.text}>Signed in: {auth.user?.email ?? 'Unknown'}</Text>

      <View style={styles.infoBlock}>
        <Text style={styles.text}>Sign up forms + sign up entry sheets are generated 5 days in advance.</Text>
        <Text style={styles.text}>
          Working people can upload one sheet of flash each, and it should appear on the sign up form.
        </Text>
        <Text style={styles.text}>The Sign Up page shows a yellow star on games with a solo artist signed up.</Text>
        <Text style={styles.text}>If anything looks wrong, report it so we can patch it fast.</Text>
      </View>

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
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
    gap: 12,
  },
  text: {
    color: '#d2dae0',
    lineHeight: 22,
    textAlign: 'center',
  },
  infoBlock: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#3b444d',
    borderRadius: 12,
    backgroundColor: '#1a2026',
    padding: 12,
    gap: 8,
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
  linksRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 2,
  },
  teamLinkButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  picklesLinkButton: {
    backgroundColor: '#20462c',
    borderColor: '#3e8f58',
  },
  cherryLinkButton: {
    backgroundColor: '#4e2023',
    borderColor: '#a63f47',
  },
  bangersLinkButton: {
    backgroundColor: '#4b341f',
    borderColor: '#9a7448',
  },
  teamLinkText: {
    color: '#f4f7fb',
    fontWeight: '700',
  },
});
