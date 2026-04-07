import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';

import { claimEventSpot } from '@/lib/claim-spot';
import { validateClaimRule } from '@/lib/claim-rules';
import { useAuth } from '@/lib/auth';
import { EmptyStateCard, ErrorStateCard, LoadingStateCard } from '@/lib/fancy-feedback';
import { canManageGameOptOut, confirmGameOptOut, optOutGameForEveryone } from '@/lib/game-opt-out';
import { notify } from '@/lib/notify';
import {
  eventBlockedSlotCount,
  eventClaimableOpenSlots,
  eventStaffing,
  formatEventDate,
  TEAM_META,
  toThumbnailUrl,
  type ScheduleEvent,
  uniqueStaffNames,
} from '@/lib/schedule';
import { ColoredStaffNamesText } from '@/lib/staff-colors';
import { useScheduleData } from '@/lib/useScheduleData';

const WEB_THUMB_IMAGE_STYLE = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const WEB_SELECT_STYLE = {
  width: '100%',
  backgroundColor: '#1b2127',
  color: '#e6edf3',
  border: '1px solid #3a4046',
  borderRadius: 8,
  padding: '8px 10px',
  fontSize: 14,
};

const TOMMA_DEFAULT_LOGIN_EMAIL = 'anatomytattoo@gmail.com';
const TOMMA_DEFAULT_SIGNUP_NAME = 'Tomma';

function normalizeName(value: string) {
  return value.replace(/\s*\([^)]*\)\s*$/, '').replace(/[’']s$/i, '').trim().toLowerCase();
}

function deriveClaimName(user: NonNullable<ReturnType<typeof useAuth>['user']>, adminClaimName: string): string {
  if (user.canViewInfo) return adminClaimName.trim();
  return (
    user.matchNames.find(name => name && name.trim().length > 0)?.trim() ||
    user.displayName ||
    user.email.split('@')[0] ||
    ''
  );
}

export default function ClaimSpotScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, isLoading, isRefreshing, errorMessage, loadSchedule } = useScheduleData();
  const [claimingEventId, setClaimingEventId] = useState<string | null>(null);
  const [optingOutEventId, setOptingOutEventId] = useState<string | null>(null);
  const [adminClaimName, setAdminClaimName] = useState('');
  const canOptOutGames = canManageGameOptOut(user);

  const adminClaimOptions = useMemo(() => uniqueStaffNames(data.all), [data.all]);

  useEffect(() => {
    if (!user?.canViewInfo) {
      setAdminClaimName('');
      return;
    }

    if (adminClaimOptions.length === 0) {
      setAdminClaimName('');
      return;
    }

    setAdminClaimName(current => {
      const hasCurrent = current
        ? adminClaimOptions.some(name => normalizeName(name) === normalizeName(current))
        : false;
      if (hasCurrent) return current;

      if (user.email.trim().toLowerCase() === TOMMA_DEFAULT_LOGIN_EMAIL) {
        const tomma = adminClaimOptions.find(name => normalizeName(name) === normalizeName(TOMMA_DEFAULT_SIGNUP_NAME));
        if (tomma) return tomma;
      }

      const userKeys = [user.displayName, ...user.matchNames].map(name => normalizeName(name));
      const fromUser = adminClaimOptions.find(name => userKeys.includes(normalizeName(name)));
      if (fromUser) return fromUser;

      return adminClaimOptions[0];
    });
  }, [adminClaimOptions, user]);

  const userKeys = useMemo(() => {
    if (!user) return [] as string[];
    const raw = [...user.matchNames, user.displayName, user.email.split('@')[0] || ''];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of raw) {
      const key = normalizeName(name || '');
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    return out;
  }, [user]);

  const claimableGames = useMemo(() => {
    return data.all.filter(event => {
      const blockedSlots = eventBlockedSlotCount(event);
      const openSlots = eventClaimableOpenSlots(event);
      const hasTheme = Boolean(event.theme && event.theme.trim().length > 0);

      if (!hasTheme) return false;
      if (blockedSlots >= 2) return false;
      return openSlots > 0;
    });
  }, [data.all]);

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

  const claimSpot = async (event: ScheduleEvent) => {
    if (!user) {
      notify('Sign-in required', 'Please sign in to claim a spot.');
      return;
    }

    const claimName = deriveClaimName(user, adminClaimName);
    if (!claimName) {
      notify('Choose an artist', 'Select who to sign up as first.');
      return;
    }

    const claimRule = validateClaimRule(event, claimName);
    if (!claimRule.ok) {
      notify('Sign Up Blocked', claimRule.message || 'This signer cannot claim this game.');
      return;
    }

    setClaimingEventId(event.id);
    try {
      const result = await claimEventSpot({
        event,
        user,
        claimName,
        requestedSlot: claimRule.requestedSlot,
      });
      if (result.status === 'error') {
        notify('Claim failed', result.message);
        return;
      }
      notify('Spot Claimed', result.message);
      await loadSchedule(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Claim failed.';
      notify('Claim failed', message);
    } finally {
      setClaimingEventId(current => (current === event.id ? null : current));
    }
  };

  const optOutGame = async (event: ScheduleEvent) => {
    if (!user || !canOptOutGames) {
      notify('Not allowed', 'Only Shy, Tomma, or Anna can opt out a game.');
      return;
    }

    const confirmed = await confirmGameOptOut(event.theme ?? 'this game');
    if (!confirmed) return;

    setOptingOutEventId(event.id);
    try {
      const result = await optOutGameForEveryone({ event, user });
      if (result.status === 'error') {
        notify('Opt out failed', result.message);
        return;
      }
      notify('Game Opted Out', result.message);
      await loadSchedule(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Opt out failed.';
      notify('Opt out failed', message);
    } finally {
      setOptingOutEventId(current => (current === event.id ? null : current));
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadSchedule(true)} />}>
        {user?.canViewInfo ? (
          <View style={styles.adminPickerWrap}>
            <Text style={styles.adminPickerLabel}>Sign up as</Text>
            {Platform.OS === 'web' ? (
              <View style={styles.adminSelectWrap}>
                <select
                  value={adminClaimName}
                  onChange={(event: any) => setAdminClaimName(String(event.target.value))}
                  style={WEB_SELECT_STYLE as any}>
                  <option value="">Choose artist...</option>
                  {adminClaimOptions.map(name => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminChipRow}>
                {adminClaimOptions.map(name => (
                  <Pressable
                    key={name}
                    style={[styles.adminChip, normalizeName(adminClaimName) === normalizeName(name) ? styles.adminChipActive : null]}
                    onPress={() => setAdminClaimName(name)}>
                    <Text style={[styles.adminChipText, normalizeName(adminClaimName) === normalizeName(name) ? styles.adminChipTextActive : null]}>
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        {isLoading ? <LoadingStateCard title="Loading Sign Up" subtitle="Finding games with open slots..." /> : null}
        {errorMessage ? <ErrorStateCard message={errorMessage} onRetry={() => void loadSchedule(true)} /> : null}

        {!isLoading && !errorMessage && claimableGames.length === 0 ? (
          <EmptyStateCard title="No open spots right now" subtitle="When a game has claimable slots, it’ll show up here." />
        ) : null}

        {!isLoading && !errorMessage
          ? claimableGames.map(event => {
              const staff = eventStaffing(event);
              const open = eventClaimableOpenSlots(event);
              const alreadyClaimed = staff.some(name => userKeys.includes(normalizeName(name)));

              return (
                <EventCard
                  key={event.id}
                  event={event}
                  staff={staff}
                  openSlots={open}
                  isClaiming={claimingEventId === event.id}
                  alreadyClaimed={alreadyClaimed}
                  onClaim={claimSpot}
                  canOptOut={canOptOutGames}
                  isOptingOut={optingOutEventId === event.id}
                  onOptOut={optOutGame}
                  onOpenDetails={openGameDetails}
                />
              );
            })
          : null}
      </ScrollView>
    </View>
  );
}

function EventCard({
  event,
  staff,
  openSlots,
  isClaiming,
  alreadyClaimed,
  onClaim,
  canOptOut,
  isOptingOut,
  onOptOut,
  onOpenDetails,
}: {
  event: ScheduleEvent;
  staff: string[];
  openSlots: number;
  isClaiming: boolean;
  alreadyClaimed: boolean;
  onClaim: (event: ScheduleEvent) => void;
  canOptOut: boolean;
  isOptingOut: boolean;
  onOptOut: (event: ScheduleEvent) => void;
  onOpenDetails: (event: ScheduleEvent) => void;
}) {
  const teamMeta = TEAM_META[event.team];
  const primaryArtUrl = event.artUrls[0] ?? event.artUrl ?? null;
  const photoUrls = event.artUrls.length > 0 ? event.artUrls : primaryArtUrl ? [primaryArtUrl] : [];

  return (
    <Pressable
      style={[styles.card, { borderColor: teamMeta.tint, backgroundColor: teamMeta.cardBackground }]}
      onPress={() => {
        onOpenDetails(event);
      }}>
      {photoUrls.length > 0 ? (
        <View style={styles.photoStrip}>
          {photoUrls.map((url, index) => {
            const thumbUrl = toThumbnailUrl(url, 420);
            return (
              <View key={url + String(index)} style={styles.photoThumbWrap}>
                <View style={styles.photoThumbFrame}>
                  {Platform.OS === 'web' ? (
                    <img
                      src={thumbUrl}
                      alt={`Photo ${index + 1}`}
                      loading="lazy"
                      decoding="async"
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      style={WEB_THUMB_IMAGE_STYLE as any}
                    />
                  ) : (
                    <Image source={{ uri: thumbUrl }} style={styles.photoThumb} resizeMode="cover" />
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {event.tattooers.length === 1 ? (
        <View style={styles.starLine}>
          <Ionicons name="star" size={28} color="#ffd33d" />
        </View>
      ) : null}

      <View style={styles.themeRow}>
        <TeamThemeIcon event={event} color={teamMeta.themeColor} />
        <Text style={[styles.themeText, { color: teamMeta.themeColor }]}>{event.theme ?? 'Untitled Theme'}</Text>
      </View>
      <Text style={styles.detailText}>{formatEventDate(event)}</Text>
      {staff.length > 0 ? (
        <ColoredStaffNamesText prefix="Staffing" names={staff} style={styles.tattooersText} />
      ) : (
        <Text style={styles.tattooersText}>Staffing: Open</Text>
      )}
      {event.opponent ? <Text style={styles.detailText}>VS - {event.opponent}</Text> : null}
      <Text style={styles.openText}>{openSlots} open {openSlots === 1 ? 'spot' : 'spots'}</Text>

      <View style={styles.actionRow}>
        <Pressable
          disabled={openSlots < 1 || alreadyClaimed || isClaiming}
          style={[styles.claimButton, styles.actionButton, openSlots < 1 || alreadyClaimed || isClaiming ? styles.claimButtonDisabled : null]}
          onPress={() => {
            onClaim(event);
          }}>
          <Ionicons name="add-circle" size={18} color="#f5fff8" />
          <Text style={styles.claimButtonText}>
            {isClaiming ? 'Signing Up...' : alreadyClaimed ? 'Already Signed Up' : openSlots < 1 ? 'Full' : 'Sign Up'}
          </Text>
        </Pressable>

        {canOptOut ? (
          <Pressable
            disabled={isOptingOut}
            style={[styles.optOutButton, styles.actionButton, isOptingOut ? styles.claimButtonDisabled : null]}
            onPress={() => {
              onOptOut(event);
            }}>
            <Ionicons name="remove-circle" size={18} color="#f5fff8" />
            <Text style={styles.optOutButtonText}>{isOptingOut ? 'Opting Out...' : 'Opt Out Game'}</Text>
          </Pressable>
        ) : null}
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
  adminPickerWrap: {
    gap: 6,
  },
  adminPickerLabel: {
    color: '#a8b6c2',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  adminSelectWrap: {
    maxWidth: 280,
  },
  adminChipRow: {
    gap: 8,
    paddingRight: 8,
  },
  adminChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3a4046',
    backgroundColor: '#1b2127',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  adminChipActive: {
    borderColor: '#4f8cff',
    backgroundColor: '#2f3f60',
  },
  adminChipText: {
    color: '#d2dae0',
    fontWeight: '600',
    fontSize: 13,
  },
  adminChipTextActive: {
    color: '#f5f9ff',
  },
  infoText: {
    color: '#d2dae0',
  },
  errorText: {
    color: '#ff9db1',
  },
  card: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    gap: 4,
  },
  starLine: {
    alignItems: "flex-start",
    marginBottom: 4,
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
  openText: {
    color: '#ffd88a',
    fontWeight: '700',
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  claimButton: {
    borderRadius: 8,
    backgroundColor: '#2f6fed',
    paddingVertical: 10,
    alignItems: 'center',
  },
  claimButtonDisabled: {
    backgroundColor: '#3a4046',
  },
  claimButtonText: {
    color: '#f5fff8',
    fontWeight: '700',
  },
  optOutButton: {
    borderRadius: 8,
    backgroundColor: '#8b1f1f',
    paddingVertical: 10,
    alignItems: 'center',
  },
  optOutButtonText: {
    color: '#f5fff8',
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
});
