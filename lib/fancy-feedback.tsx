import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type LoadingStateCardProps = {
  title?: string;
  subtitle?: string;
};

type ErrorStateCardProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

type EmptyStateCardProps = {
  title: string;
  subtitle?: string;
};

export function LoadingStateCard({
  title = 'Loading the board',
  subtitle = 'Pulling fresh games, staffing, and art...',
}: LoadingStateCardProps) {
  return (
    <View style={[styles.card, styles.loadingCard]}>
      <ActivityIndicator size="small" color="#84d8ff" />
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function ErrorStateCard({
  title = 'Schedule hiccup',
  message,
  onRetry,
}: ErrorStateCardProps) {
  return (
    <View style={[styles.card, styles.errorCard]}>
      <Text style={[styles.title, styles.errorTitle]}>{title}</Text>
      <Text style={[styles.subtitle, styles.errorSubtitle]}>{message}</Text>
      {onRetry ? (
        <Pressable style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyStateCard({ title, subtitle }: EmptyStateCardProps) {
  return (
    <View style={[styles.card, styles.emptyCard]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  loadingCard: {
    borderColor: '#3f5563',
    backgroundColor: '#1b2127',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorCard: {
    borderColor: '#8e3b3b',
    backgroundColor: '#2c1a1a',
  },
  emptyCard: {
    borderColor: '#3f5563',
    backgroundColor: '#1a2026',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: '#eaf3fa',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#c7d4de',
    lineHeight: 19,
  },
  errorTitle: {
    color: '#ffb3b8',
  },
  errorSubtitle: {
    color: '#ffd6da',
  },
  retryButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#c86a6a',
    backgroundColor: '#3b2222',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retryButtonText: {
    color: '#ffe5e7',
    fontWeight: '700',
  },
});
