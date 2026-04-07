import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteEventArt, pickAndUploadEventArt } from '@/lib/art-upload';
import { useAuth } from '@/lib/auth';
import { claimEventSpot } from '@/lib/claim-spot';
import { validateClaimRule } from '@/lib/claim-rules';
import { EmptyStateCard, ErrorStateCard, LoadingStateCard } from '@/lib/fancy-feedback';
import { canManageGameOptOut, confirmGameOptOut, optOutGameForEveryone } from '@/lib/game-opt-out';
import { confirmAction, notify } from '@/lib/notify';
import { eventStaffing, formatEventDate, TEAM_META, toThumbnailUrl, type ScheduleEvent, uniqueStaffNames } from '@/lib/schedule';
import { cancelMySpotForEvent, setStaffSlotForEvent } from '@/lib/staff-actions';
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
const SLOT_3_ONLY_NAMES = new Set(['kevin', 'jacob', 'jason']);

function normalizeName(value: string): string {
  return value.replace(/\s*\([^)]*\)\s*$/, '').replace(/[’']s$/i, '').trim().toLowerCase();
}

function isCounterOnlyName(value: string): boolean {
  return SLOT_3_ONLY_NAMES.has(normalizeName(value));
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

function toGoogleCalendarDateUtc(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  const hour = String(value.getUTCHours()).padStart(2, '0');
  const minute = String(value.getUTCMinutes()).padStart(2, '0');
  const second = String(value.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

function buildGoogleCalendarUrl(event: ScheduleEvent, staffNames: string[]): string | null {
  if (!event.dateTime) return null;

  const start = new Date(event.dateTime);
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);

  const title = `${TEAM_META[event.team].title}${event.theme ? ` - ${event.theme}` : ''}`;
  const details: string[] = [];
  if (staffNames.length > 0) {
    details.push(`Staffing: ${staffNames.join(', ')}`);
  }
  if (event.opponent) {
    details.push(`VS - ${event.opponent}`);
  }
  if (event.signUpUrl) {
    details.push(`Sign Up: ${event.signUpUrl}`);
  }

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', `${toGoogleCalendarDateUtc(start)}/${toGoogleCalendarDateUtc(end)}`);
  if (details.length > 0) {
    url.searchParams.set('details', details.join('\n'));
  }
  return url.toString();
}

export default function GameDetailsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isRefreshing, errorMessage, loadSchedule } = useScheduleData();
  const params = useLocalSearchParams<{ eventId?: string; team?: string; theme?: string; dateLabel?: string }>();

  const [uploading, setUploading] = useState(false);
  const [deletingImageKey, setDeletingImageKey] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [optingOut, setOptingOut] = useState(false);
  const [cancellingMine, setCancellingMine] = useState(false);
  const [settingSlot, setSettingSlot] = useState<number | null>(null);
  const [adminClaimName, setAdminClaimName] = useState('');
  const [staffNameDraft, setStaffNameDraft] = useState('');

  const event = useMemo(() => {
    const eventId = String(params.eventId || '');
    if (eventId) {
      const byId = data.all.find(item => item.id === eventId);
      if (byId) return byId;
    }

    const team = String(params.team || '').trim().toLowerCase();
    const theme = String(params.theme || '').trim().toLowerCase();
    const dateLabel = String(params.dateLabel || '').trim().toLowerCase();

    return (
      data.all.find(item => {
        const teamMatch = team ? item.team.toLowerCase() === team : true;
        const themeMatch = theme ? (item.theme || '').trim().toLowerCase() === theme : true;
        const dateMatch = dateLabel ? (item.dateLabel || '').trim().toLowerCase() === dateLabel : true;
        return teamMatch && themeMatch && dateMatch;
      }) || null
    );
  }, [data.all, params.dateLabel, params.eventId, params.team, params.theme]);

  const staffNames = useMemo(() => (event ? eventStaffing(event) : []), [event]);
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
    const raw = [...user.matchNames, user.displayName, user.email.split('@')[0] || '', user.email];
    const out: string[] = [];
    const seen = new Set<string>();

    raw.forEach(name => {
      const key = normalizeName(name || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(key);
    });

    return out;
  }, [user]);

  const isAssigned = staffNames.some(name => userKeys.includes(normalizeName(name)));
  const canUploadArt = Boolean(user && (user.canViewInfo || isAssigned));
  const canCancelMySpot = Boolean(user && isAssigned);
  const canOptOut = canManageGameOptOut(user);
  const calendarUrl = useMemo(() => (event ? buildGoogleCalendarUrl(event, staffNames) : null), [event, staffNames]);

  const photoUrls = event?.artUrls?.length ? event.artUrls : event?.artUrl ? [event.artUrl] : [];
  const photoOpenUrls = event && event.artOpenUrls.length === photoUrls.length ? event.artOpenUrls : photoUrls;

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

  const uploadArt = async () => {
    if (!event || !user) {
      notify('Sign-in required', 'Please sign in first.');
      return;
    }

    setUploading(true);
    try {
      const result = await pickAndUploadEventArt({ event, user });
      if (result.status === 'error') {
        notify('Upload failed', result.message);
        return;
      }
      await loadSchedule(true);
    } finally {
      setUploading(false);
    }
  };

  const deleteArt = async (slot: number, imageKey: string) => {
    if (!event || !user) {
      notify('Sign-in required', 'Please sign in first.');
      return;
    }

    setDeletingImageKey(imageKey);
    try {
      const result = await deleteEventArt({ event, user, slot });
      if (result.status === 'error') {
        notify('Delete failed', result.message);
        return;
      }
      await loadSchedule(true);
    } finally {
      setDeletingImageKey(current => (current === imageKey ? null : current));
    }
  };

  const signUp = async () => {
    if (!event || !user) {
      notify('Sign-in required', 'Please sign in first.');
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

    setClaiming(true);
    try {
      const result = await claimEventSpot({
        event,
        user,
        claimName,
        requestedSlot: claimRule.requestedSlot,
      });
      if (result.status === 'error') {
        notify('Sign up failed', result.message);
        return;
      }
      notify('Signed Up', result.message);
      await loadSchedule(true);
    } finally {
      setClaiming(false);
    }
  };

  const optOut = async () => {
    if (!event || !user || !canOptOut) {
      notify('Not allowed', 'Only admin users can opt out this game.');
      return;
    }

    const confirmed = await confirmGameOptOut(event.theme || 'this game');
    if (!confirmed) return;

    setOptingOut(true);
    try {
      const result = await optOutGameForEveryone({ event, user });
      if (result.status === 'error') {
        notify('Opt out failed', result.message);
        return;
      }
      notify('Game Opted Out', result.message);
      await loadSchedule(true);
    } finally {
      setOptingOut(false);
    }
  };

  const cancelMySpot = async () => {
    if (!event || !user) return;

    setCancellingMine(true);
    try {
      const result = await cancelMySpotForEvent({ event, user });
      if (result.status === 'error') {
        notify('Cancel failed', result.message);
        return;
      }
      notify('Reservation Cancelled', result.message);
      await loadSchedule(true);
    } finally {
      setCancellingMine(false);
    }
  };

  const setSlot = async (slot: number) => {
    if (!event || !user) return;
    const selectedName = staffNameDraft.trim();

    if (selectedName && isCounterOnlyName(selectedName) && slot !== 3) {
      notify('Counter Slot Rule', 'Kevin, Jacob, and Jason can only be assigned to slot 3.');
      return;
    }

    setSettingSlot(slot);
    try {
      const result = await setStaffSlotForEvent({
        event,
        user,
        slot,
        staffName: selectedName,
      });
      if (result.status === 'error') {
        notify('Update failed', result.message);
        return;
      }
      notify('Staff Updated', result.message);
      await loadSchedule(true);
    } finally {
      setSettingSlot(current => (current === slot ? null : current));
    }
  };

  if (!isLoading && !event) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <EmptyStateCard title="Game not found" subtitle="This card may have moved or no longer matches the current schedule." />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadSchedule(true)} />}>
        {isLoading ? <LoadingStateCard title="Loading Game Details" subtitle="Pulling latest staffing and photos..." /> : null}
        {errorMessage ? <ErrorStateCard message={errorMessage} onRetry={() => void loadSchedule(true)} /> : null}

        {event ? (
          <View style={[styles.card, { borderColor: TEAM_META[event.team].tint, backgroundColor: TEAM_META[event.team].cardBackground }]}>
            <Text style={[styles.teamText, { color: TEAM_META[event.team].themeColor }]}>{TEAM_META[event.team].title}</Text>
            <Text style={[styles.themeText, { color: TEAM_META[event.team].themeColor }]}>{event.theme || 'Untitled Theme'}</Text>
            <Text style={styles.detailText}>{formatEventDate(event)}</Text>
            {staffNames.length > 0 ? (
              <ColoredStaffNamesText prefix="Staffing" names={staffNames} style={styles.staffingText} />
            ) : (
              <Text style={styles.staffingText}>Staffing: Open</Text>
            )}
            {event.opponent ? <Text style={styles.detailText}>VS - {event.opponent}</Text> : null}

            <View style={styles.photoStrip}>
              {[0, 1, 2].map(index => {
                const url = photoUrls[index] || '';
                const thumbUrl = url ? toThumbnailUrl(url, 640) : '';
                const openUrlForImage = photoOpenUrls[index] || url;
                const slot = index + 1;
                const imageKey = `${event.id}:${slot}`;
                const isDeleting = deletingImageKey === imageKey;

                return (
                  <View key={slot} style={styles.photoThumbWrap}>
                    <View style={styles.photoThumbFrame}>
                      {url ? (
                        <Pressable
                          style={styles.photoThumbPressable}
                          onPress={() => {
                            if (openUrlForImage) void openUrl(openUrlForImage);
                          }}>
                          {Platform.OS === 'web' ? (
                            <img
                              src={thumbUrl}
                              alt={`Photo ${slot}`}
                              loading="lazy"
                              decoding="async"
                              crossOrigin="anonymous"
                              referrerPolicy="no-referrer"
                              style={WEB_THUMB_IMAGE_STYLE as any}
                            />
                          ) : (
                            <Image source={{ uri: thumbUrl }} style={styles.photoThumb} resizeMode="cover" />
                          )}
                        </Pressable>
                      ) : (
                        <View style={styles.photoEmpty}>
                          <Text style={styles.photoEmptyText}>No Photo {slot}</Text>
                        </View>
                      )}
                    </View>
                    {url ? (
                      <Pressable
                        disabled={isDeleting}
                        style={[styles.deleteThumbButton, isDeleting ? styles.disabledButton : null]}
                        onPress={async () => {
                          const confirmed = await confirmAction({
                            title: 'Delete Photo',
                            message: 'Remove this photo from the game card?',
                            confirmLabel: 'Delete',
                            cancelLabel: 'Keep Photo',
                            destructive: true,
                          });
                          if (!confirmed) return;
                          void deleteArt(slot, imageKey);
                        }}>
                        <MaterialIcons name={isDeleting ? 'hourglass-empty' : 'delete'} size={14} color="#ffd2d2" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={styles.actionsRow}>
              <Pressable
                disabled={!canUploadArt || uploading}
                style={[styles.iconButton, styles.editButton, !canUploadArt || uploading ? styles.disabledButton : null]}
                onPress={() => {
                  void uploadArt();
                }}>
                <MaterialIcons name={uploading ? 'hourglass-empty' : 'cloud-upload'} size={20} color="#f5fff8" />
              </Pressable>
              <Pressable
                disabled={!event.signUpUrl}
                style={[styles.iconButton, styles.signUpButton, !event.signUpUrl ? styles.disabledButton : null]}
                onPress={() => {
                  if (event.signUpUrl) void openUrl(event.signUpUrl);
                }}>
                <MaterialIcons name="assignment" size={20} color="#f5fff8" />
              </Pressable>
              <Pressable
                disabled={!event.responsesUrl}
                style={[styles.iconButton, styles.responsesButton, !event.responsesUrl ? styles.disabledButton : null]}
                onPress={() => {
                  if (event.responsesUrl) void openUrl(event.responsesUrl);
                }}>
                <MaterialIcons name="list-alt" size={20} color="#f5fff8" />
              </Pressable>
              <Pressable
                disabled={!calendarUrl}
                style={[styles.iconButton, styles.calendarButton, !calendarUrl ? styles.disabledButton : null]}
                onPress={() => {
                  if (calendarUrl) void openUrl(calendarUrl);
                }}>
                <MaterialIcons name="event" size={20} color="#f5fff8" />
              </Pressable>
            </View>

            {user?.canViewInfo ? (
              <View style={styles.adminPickerWrap}>
                <Text style={styles.inputLabel}>Sign up as</Text>
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

            <View style={styles.primaryActionRow}>
              <Pressable
                disabled={claiming}
                style={[styles.primaryButton, styles.signActionButton, claiming ? styles.disabledButton : null]}
                onPress={() => {
                  void signUp();
                }}>
                <Ionicons name="add-circle" size={18} color="#f5fff8" />
                <Text style={styles.primaryButtonText}>{claiming ? 'Signing Up...' : 'Sign Up'}</Text>
              </Pressable>

              <Pressable
                disabled={!canCancelMySpot || cancellingMine}
                style={[
                  styles.primaryButton,
                  styles.cancelActionButton,
                  !canCancelMySpot || cancellingMine ? styles.disabledButton : null,
                ]}
                onPress={() => {
                  void cancelMySpot();
                }}>
                <Ionicons name="remove-circle" size={18} color="#f5fff8" />
                <Text style={styles.primaryButtonText}>{cancellingMine ? 'Cancelling...' : 'Cancel My Reservation'}</Text>
              </Pressable>
            </View>

            {canOptOut ? (
              <Pressable
                disabled={optingOut}
                style={[styles.secondaryButton, optingOut ? styles.disabledButton : null]}
                onPress={() => {
                  void optOut();
                }}>
                <MaterialIcons name="close" size={18} color="#f5fff8" />
                <Text style={styles.secondaryButtonText}>{optingOut ? 'Opting Out...' : 'Anatomy Opt Out of Game'}</Text>
              </Pressable>
            ) : null}

            {user?.canViewInfo ? (
              <View style={styles.adminEditorWrap}>
                <Text style={styles.inputLabel}>Change Tattooer (admin)</Text>
                {Platform.OS === 'web' ? (
                  <View style={styles.adminSelectWrap}>
                    <select
                      value={staffNameDraft}
                      onChange={(event: any) => setStaffNameDraft(String(event.target.value))}
                      style={WEB_SELECT_STYLE as any}>
                      <option value="">Clear slot</option>
                      {adminClaimOptions.map(name => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.adminChipRow}>
                    <Pressable
                      style={[styles.adminChip, staffNameDraft.trim() === '' ? styles.adminChipActive : null]}
                      onPress={() => setStaffNameDraft('')}>
                      <Text style={[styles.adminChipText, staffNameDraft.trim() === '' ? styles.adminChipTextActive : null]}>Clear</Text>
                    </Pressable>
                    {adminClaimOptions.map(name => (
                      <Pressable
                        key={name}
                        style={[styles.adminChip, normalizeName(staffNameDraft) === normalizeName(name) ? styles.adminChipActive : null]}
                        onPress={() => setStaffNameDraft(name)}>
                        <Text style={[styles.adminChipText, normalizeName(staffNameDraft) === normalizeName(name) ? styles.adminChipTextActive : null]}>
                          {name}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <View style={styles.slotButtonRow}>
                  {[1, 2, 3].map(slot => (
                    <Pressable
                      key={slot}
                      disabled={(staffNameDraft.trim() !== '' && isCounterOnlyName(staffNameDraft) && slot !== 3) || settingSlot === slot}
                      style={[
                        styles.slotButton,
                        (staffNameDraft.trim() !== '' && isCounterOnlyName(staffNameDraft) && slot !== 3) || settingSlot === slot
                          ? styles.disabledButton
                          : null,
                      ]}
                      onPress={() => {
                        void setSlot(slot);
                      }}>
                      <Text style={styles.slotButtonText}>{settingSlot === slot ? `Saving ${slot}...` : `Set ${slot}`}</Text>
                    </Pressable>
                  ))}
                </View>
                {staffNameDraft.trim() !== '' && isCounterOnlyName(staffNameDraft) ? (
                  <Text style={styles.counterRuleText}>Kevin, Jacob, and Jason can only be assigned to slot 3.</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.bottomTabBar,
          {
            paddingTop: 8,
            paddingBottom: 10 + insets.bottom,
          },
        ]}>
        <Pressable style={styles.bottomTabButton} onPress={() => router.replace('/(tabs)')}>
          <Ionicons name="flash-outline" size={20} color="#e0e8ee" />
          <Text style={styles.bottomTabLabel}>Next Up</Text>
        </Pressable>
        <Pressable style={styles.bottomTabButton} onPress={() => router.replace('/(tabs)/schedule')}>
          <Ionicons name="calendar-outline" size={20} color="#e0e8ee" />
          <Text style={styles.bottomTabLabel}>Schedule</Text>
        </Pressable>
        <Pressable style={styles.bottomTabButton} onPress={() => router.replace('/(tabs)/my-games')}>
          <Ionicons name="person-outline" size={20} color="#e0e8ee" />
          <Text style={styles.bottomTabLabel}>My Games</Text>
        </Pressable>
        <Pressable style={styles.bottomTabButton} onPress={() => router.replace('/(tabs)/claim-spot')}>
          <Ionicons name="add-circle-outline" size={20} color="#e0e8ee" />
          <Text style={styles.bottomTabLabel}>Sign Up</Text>
        </Pressable>
        {user?.canViewInfo ? (
          <Pressable style={styles.bottomTabButton} onPress={() => router.replace('/(tabs)/about')}>
            <Ionicons name="information-circle-outline" size={20} color="#e0e8ee" />
            <Text style={styles.bottomTabLabel}>Info</Text>
          </Pressable>
        ) : null}
      </View>
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
    paddingBottom: 32,
    gap: 10,
  },
  infoText: {
    color: '#d2dae0',
  },
  errorText: {
    color: '#ff9db1',
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  teamText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  themeText: {
    fontSize: 22,
    fontWeight: '700',
  },
  detailText: {
    color: '#d2dae0',
    lineHeight: 20,
  },
  staffingText: {
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
  photoThumbFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3f5563',
    backgroundColor: '#0f1316',
  },
  photoThumbPressable: {
    width: '100%',
    height: '100%',
  },
  photoThumb: {
    width: '100%',
    height: '100%',
  },
  photoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmptyText: {
    color: '#93a0aa',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteThumbButton: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#774646',
    backgroundColor: '#3d2323',
    width: '100%',
    alignItems: 'center',
  },
  actionsRow: {
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
  calendarButton: {
    backgroundColor: '#2b333a',
  },
  primaryActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  signActionButton: {
    backgroundColor: '#2f6fed',
  },
  cancelActionButton: {
    backgroundColor: '#8b1f1f',
  },
  primaryButtonText: {
    color: '#f5fff8',
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#3a4046',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryButtonText: {
    color: '#f5fff8',
    fontWeight: '700',
  },
  adminPickerWrap: {
    marginTop: 10,
    gap: 6,
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
  adminEditorWrap: {
    marginTop: 10,
    gap: 6,
  },
  inputLabel: {
    color: '#a8b6c2',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  slotButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  slotButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#2b333a',
    alignItems: 'center',
    paddingVertical: 9,
  },
  slotButtonText: {
    color: '#e5edf3',
    fontWeight: '700',
  },
  counterRuleText: {
    color: '#ffd0d0',
    fontSize: 12,
    lineHeight: 16,
  },
  disabledButton: {
    backgroundColor: '#3a4046',
    borderColor: '#4f5862',
  },
  bottomTabBar: {
    borderTopWidth: 1,
    borderTopColor: '#2f3840',
    backgroundColor: '#25292e',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  bottomTabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    flex: 1,
    paddingVertical: 4,
  },
  bottomTabLabel: {
    color: '#e0e8ee',
    fontSize: 11,
    fontWeight: '700',
  },
});
