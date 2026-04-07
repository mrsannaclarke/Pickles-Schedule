import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';

import { pickAndUploadEventArt } from '@/lib/art-upload';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/notify';
import {
  filterEventsByAnyTattooer,
  filterEventsByStaff,
  formatEventDate,
  hasMinimumPublishedStaff,
  TEAM_META,
  type ScheduleEvent,
  uniqueStaffNames,
} from '@/lib/schedule';
import { ColoredStaffNamesText, staffNameColor } from '@/lib/staff-colors';
import { useScheduleData } from '@/lib/useScheduleData';

const WEB_THUMB_IMAGE_STYLE = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const VIEW_MINE = '__mine__';
const COUNTER_VIEWERS = ['Kevin', 'Jacob', 'Jason'];
const TOMMA_DEFAULT_LOGIN_EMAIL = 'anatomytattoo@gmail.com';
const TOMMA_DEFAULT_VIEWER = 'Tomma';

const WEB_SELECT_STYLE = {
  width: '100%',
  backgroundColor: '#1b2127',
  color: '#e6edf3',
  border: '1px solid #3a4046',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

type DateGroup = {
  label: string;
  events: ScheduleEvent[];
};

function normalizeViewerName(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/, '').replace(/[’']s$/i, '').trim();
}

function groupByDate(events: ScheduleEvent[]): DateGroup[] {
  const out: DateGroup[] = [];

  for (const event of events) {
    const label = event.dateTime
      ? event.dateTime.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        })
      : 'No Date';

    const last = out[out.length - 1];
    if (last && last.label === label) {
      last.events.push(event);
    } else {
      out.push({ label, events: [event] });
    }
  }

  return out;
}

export default function MyGamesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, isLoading, isRefreshing, errorMessage, loadSchedule } = useScheduleData();
  const [uploadingEventId, setUploadingEventId] = useState<string | null>(null);
  const [selectedViewer, setSelectedViewer] = useState<string>(VIEW_MINE);

  const staffNames = useMemo(() => {
    const combined = [...uniqueStaffNames(data.all).map(normalizeViewerName), ...COUNTER_VIEWERS]
      .map(name => name.trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const deduped: string[] = [];

    for (const name of combined) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(name);
    }

    deduped.sort((a, b) => a.localeCompare(b));
    return deduped;
  }, [data.all]);

  useEffect(() => {
    if (selectedViewer === VIEW_MINE) return;
    if (!staffNames.includes(selectedViewer)) {
      setSelectedViewer(VIEW_MINE);
    }
  }, [selectedViewer, staffNames]);

  useEffect(() => {
    if (!user || selectedViewer !== VIEW_MINE) return;
    if (user.email.trim().toLowerCase() !== TOMMA_DEFAULT_LOGIN_EMAIL) return;
    if (!staffNames.includes(TOMMA_DEFAULT_VIEWER)) return;

    setSelectedViewer(TOMMA_DEFAULT_VIEWER);
  }, [selectedViewer, staffNames, user]);

  const filteredGames = useMemo(() => {
    const source =
      selectedViewer === VIEW_MINE
        ? filterEventsByAnyTattooer(data.all, user?.matchNames ?? [])
        : filterEventsByStaff(data.all, selectedViewer);

    return source.filter(event => hasMinimumPublishedStaff(event));
  }, [data.all, selectedViewer, user?.matchNames]);

  const groups = useMemo(() => groupByDate(filteredGames), [filteredGames]);

  const openGameDetails = (event: ScheduleEvent) => {
    router.push({
      pathname: '/game/[eventId]',
      params: {
        eventId: event.id,
        team: event.team,
        theme: event.theme ?? '',
        dateLabel: event.dateLabel ?? '',
      },
    });
  };

  const openUrl = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        notify('Link unavailable', 'This link could not be opened.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      notify('Link unavailable', 'There was an error opening the link.');
    }
  };

  const uploadArt = async (event: ScheduleEvent) => {
    if (!user) {
      notify('Sign-in required', 'Please sign in to upload art.');
      return;
    }

    setUploadingEventId(event.id);
    try {
      const result = await pickAndUploadEventArt({ event, user });
      if (result.status === 'cancelled') return;
      if (result.status === 'error') {
        notify('Upload failed', result.message);
        return;
      }
      await loadSchedule(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      notify('Upload failed', message);
    } finally {
      setUploadingEventId(current => (current === event.id ? null : current));
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadSchedule(true)} />}>
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>View games for</Text>
          {Platform.OS === 'web' ? (
            <View style={styles.filterSelectWrap}>
              <select
                value={selectedViewer}
                onChange={(event: any) => setSelectedViewer(String(event.target.value))}
                style={WEB_SELECT_STYLE as any}>
                <option value={VIEW_MINE}>My Games</option>
                {staffNames.map(name => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
              <Pressable
                style={[styles.filterChip, selectedViewer === VIEW_MINE ? styles.filterChipActive : null]}
                onPress={() => setSelectedViewer(VIEW_MINE)}>
                <Text style={[styles.filterChipText, selectedViewer === VIEW_MINE ? styles.filterChipTextActive : null]}>My Games</Text>
              </Pressable>
              {staffNames.map(name => (
                <Pressable
                  key={name}
                  style={[styles.filterChip, selectedViewer === name ? styles.filterChipActive : null]}
                  onPress={() => setSelectedViewer(name)}>
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: staffNameColor(name) ?? '#dce5ec' },
                      selectedViewer === name ? styles.filterChipTextActive : null,
                    ]}>
                    {name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {isLoading ? <Text style={styles.infoText}>Loading schedule...</Text> : null}
        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
        {!isLoading && !errorMessage && filteredGames.length === 0 ? (
          <Text style={styles.infoText}>No assigned upcoming games found for this selection.</Text>
        ) : null}

        {!isLoading && !errorMessage
          ? groups.map(group => (
              <View key={group.label} style={styles.section}>
                <Text style={styles.sectionTitle}>{group.label}</Text>
                {group.events.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isUploading={uploadingEventId === event.id}
                    onOpenUrl={openUrl}
                    onUploadArt={uploadArt}
                    onOpenDetails={openGameDetails}
                  />
                ))}
              </View>
            ))
          : null}
      </ScrollView>
    </View>
  );
}

function EventCard({
  event,
  isUploading,
  onOpenUrl,
  onUploadArt,
  onOpenDetails,
}: {
  event: ScheduleEvent;
  isUploading: boolean;
  onOpenUrl: (url: string) => void;
  onUploadArt: (event: ScheduleEvent) => void;
  onOpenDetails: (event: ScheduleEvent) => void;
}) {
  const teamMeta = TEAM_META[event.team];
  const responsesUrl = event.responsesUrl;
  const primaryArtUrl = event.artUrls[0] ?? event.artUrl ?? null;
  const photoUrls = event.artUrls.length > 0 ? event.artUrls : primaryArtUrl ? [primaryArtUrl] : [];
  const photoOpenUrls = event.artOpenUrls.length === photoUrls.length ? event.artOpenUrls : photoUrls;

  return (
    <Pressable
      style={[styles.card, { borderColor: teamMeta.tint, backgroundColor: teamMeta.cardBackground }]}
      onPress={() => {
        onOpenDetails(event);
      }}>
      {photoUrls.length > 0 ? (
        <View style={styles.photoStrip}>
          {photoUrls.map((url, index) => {
            const slotNumber = index + 1;
            return (
              <View key={url + String(index)} style={styles.photoThumbWrap}>
                <Pressable
                  style={styles.photoOpenButton}
                  accessibilityRole="button"
                  accessibilityLabel={`Open photo ${slotNumber}`}
                  onPress={() => {
                    void onOpenUrl(photoOpenUrls[index] ?? url);
                  }}>
                  <View style={styles.photoThumbFrame}>
                    {Platform.OS === 'web' ? (
                      <img
                        src={url}
                        alt={`Photo ${slotNumber}`}
                        crossOrigin="anonymous"
                        referrerPolicy="no-referrer"
                        style={WEB_THUMB_IMAGE_STYLE as any}
                      />
                    ) : (
                      <Image source={{ uri: url }} style={styles.photoThumb} resizeMode="cover" />
                    )}
                  </View>
                  <Text style={styles.photoThumbLabel}>{`Photo ${slotNumber}`}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.themeRow}>
        <TeamThemeIcon event={event} color={teamMeta.themeColor} />
        <Text style={[styles.themeText, { color: teamMeta.themeColor }]}>{event.theme ?? 'Untitled Theme'}</Text>
      </View>
      <Text style={styles.detailText}>{formatEventDate(event)}</Text>
      {event.tattooers.length > 0 ? (
        <ColoredStaffNamesText prefix="Tattooers" names={event.tattooers} style={styles.tattooersText} />
      ) : null}
      {event.opponent ? <Text style={styles.detailText}>VS - {event.opponent}</Text> : null}

      <View style={styles.iconRow}>
        <Pressable
          disabled={isUploading}
          style={[styles.iconButton, styles.editButton, isUploading ? styles.disabledButton : null]}
          accessibilityRole="button"
          accessibilityLabel="Upload art"
          onPress={() => {
            onUploadArt(event);
          }}>
          <MaterialIcons name={isUploading ? 'hourglass-empty' : 'cloud-upload'} size={20} color={isUploading ? '#ffd33d' : '#f5fff8'} />
        </Pressable>
        <Pressable
          disabled={!responsesUrl}
          style={[styles.iconButton, styles.responsesButton, !responsesUrl ? styles.disabledButton : null]}
          accessibilityRole="button"
          accessibilityLabel="Open form responses"
          onPress={() => {
            if (responsesUrl) void onOpenUrl(responsesUrl);
          }}>
          <MaterialIcons name="list-alt" size={20} color={responsesUrl ? '#f5fff8' : '#9ca7af'} />
        </Pressable>
        <Pressable
          disabled={!event.signUpUrl}
          style={[styles.iconButton, styles.signUpButton, !event.signUpUrl ? styles.disabledButton : null]}
          accessibilityRole="button"
          accessibilityLabel="Open sign up form"
          onPress={() => {
            if (event.signUpUrl) void onOpenUrl(event.signUpUrl);
          }}>
          <MaterialIcons name="assignment" size={20} color={event.signUpUrl ? '#f5fff8' : '#9ca7af'} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function TeamThemeIcon({ event, color }: { event: ScheduleEvent; color: string }) {
  if (event.team === 'cherry_bombs') {
    return <MaterialCommunityIcons name="bomb" size={19} color={color} />;
  }
  if (event.team === 'pickles') {
    return <MaterialIcons name="sports-baseball" size={19} color={color} />;
  }
  return <MaterialCommunityIcons name="food-hot-dog" size={19} color={color} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111417',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  filterRow: {
    marginBottom: 8,
    gap: 6,
  },
  filterLabel: {
    color: '#d2dae0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  filterSelectWrap: {
    maxWidth: 280,
  },
  filterChipRow: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3a4046',
    backgroundColor: '#1b2127',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: '#4f8cff',
    backgroundColor: '#2f3f60',
  },
  filterChipText: {
    color: '#d2dae0',
    fontWeight: '600',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#f5f9ff',
  },
  infoText: {
    color: '#d2dae0',
  },
  errorText: {
    color: '#ff9db1',
  },
  section: {
    marginTop: 6,
    gap: 8,
  },
  sectionTitle: {
    color: '#f3f5f7',
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeText: {
    fontWeight: '700',
    fontSize: 16,
  },
  detailText: {
    color: '#d2dae0',
    lineHeight: 20,
  },
  tattooersText: {
    color: '#e9f0f5',
    lineHeight: 22,
    fontSize: 16,
    fontWeight: '700',
  },
  photoStrip: {
    marginTop: 4,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  photoThumbWrap: {
    width: '33.3333%',
    paddingHorizontal: 4,
    marginBottom: 8,
    alignItems: 'stretch',
    gap: 4,
  },
  photoOpenButton: {
    alignItems: 'stretch',
    gap: 4,
    width: '100%',
  },
  photoThumbFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3f5563',
    backgroundColor: '#0f1316',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoThumbLabel: {
    color: '#d7e6f1',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  iconRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    alignItems: 'center',
  },
  iconButton: {
    borderRadius: 8,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#2f6fed',
  },
  signUpButton: {
    backgroundColor: '#5b636b',
  },
  responsesButton: {
    backgroundColor: '#1f7a3f',
  },
  disabledButton: {
    backgroundColor: '#3a4046',
  },
});
