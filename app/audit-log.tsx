import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { canAccessAuditLogByEmail, fetchAuditLogs, type AuditLogEntry } from '@/lib/audit-log';
import { useAuth } from '@/lib/auth';
import { EmptyStateCard, ErrorStateCard, LoadingStateCard } from '@/lib/fancy-feedback';

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'Unknown time';
  return date.toLocaleString();
}

function statusColor(status: string) {
  const key = String(status || '').toLowerCase();
  if (key === 'success') return '#6fde8f';
  if (key === 'error') return '#ff8f9a';
  return '#c8d3dc';
}

export default function AuditLogScreen() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canView = useMemo(() => canAccessAuditLogByEmail(user?.email), [user?.email]);

  const load = useCallback(async (refresh: boolean) => {
    if (!canView) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      setErrorMessage(null);
      const next = await fetchAuditLogs({ user, limit: 200 });
      setLogs(next.logs);
      setTotal(next.total);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load audit logs.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [canView, user]);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (!canView) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <ErrorStateCard message="This page is only available to approved audit admins." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} />}>
        <Text style={styles.summaryText}>{`Showing ${logs.length} of ${total} entries`}</Text>
        {isLoading ? <LoadingStateCard title="Loading Audit Log" subtitle="Pulling recent user actions..." /> : null}
        {errorMessage ? <ErrorStateCard message={errorMessage} onRetry={() => void load(true)} /> : null}
        {!isLoading && !errorMessage && logs.length === 0 ? (
          <EmptyStateCard title="No audit entries yet" subtitle="Non-navigation actions will appear here." />
        ) : null}

        {!isLoading && !errorMessage
          ? logs.map((entry, index) => (
              <View key={`${entry.serverTimestamp}-${index}`} style={styles.card}>
                <View style={styles.rowTop}>
                  <Text style={styles.eventType}>{entry.eventType || 'unknown_event'}</Text>
                  <Text style={[styles.status, { color: statusColor(entry.status) }]}>{entry.status || 'info'}</Text>
                </View>
                <Text style={styles.metaText}>{formatWhen(String(entry.serverTimestamp || entry.clientTimestamp || ''))}</Text>
                <Text style={styles.metaText}>{entry.userEmail || 'unknown user'}</Text>
                {entry.message ? <Text style={styles.messageText}>{entry.message}</Text> : null}
                <Text style={styles.metaText}>
                  {`Game: ${entry.team || '-'} | ${entry.dateLabel || '-'} | ${entry.theme || '-'}`}
                </Text>
                {entry.slot ? <Text style={styles.metaText}>{`Slot: ${entry.slot}`}</Text> : null}
                {entry.claimName ? <Text style={styles.metaText}>{`Claim: ${entry.claimName}`}</Text> : null}
                {entry.details ? <Text style={styles.detailsText}>{entry.details}</Text> : null}
              </View>
            ))
          : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111417',
  },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 26,
  },
  summaryText: {
    color: '#d2dae0',
    fontSize: 13,
  },
  card: {
    borderWidth: 1,
    borderColor: '#3b444d',
    borderRadius: 12,
    backgroundColor: '#1a2026',
    padding: 10,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  eventType: {
    color: '#f3f7fb',
    fontWeight: '800',
    flexShrink: 1,
  },
  status: {
    fontWeight: '800',
    textTransform: 'uppercase',
    fontSize: 12,
  },
  metaText: {
    color: '#c4d0da',
    fontSize: 12,
    lineHeight: 18,
  },
  messageText: {
    color: '#e9f0f6',
    lineHeight: 19,
  },
  detailsText: {
    color: '#9fb1c0',
    fontSize: 11,
    lineHeight: 16,
  },
});
