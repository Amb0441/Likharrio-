import { Feather, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams } from "expo-router";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import {
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView as SafeAreaViewRN } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { db } from "../../../lib/firebase";
import { getCached, setCache, cacheKey } from "../../../lib/dataCache";
import { isEventPast } from "../../../lib/helpers";
import ReportModal from "../../../components/modals/ReportModal";
import {
  buildPickerMapHtml,
  buildStaticMapHtml,
  DEFAULT_CENTER,
  getQuickPosition,
} from "../../../utils/geo";

const { width } = Dimensions.get('window');

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface LocationPin { latitude: number; longitude: number; }
interface EventData {
  id: string; title: string; description: string; location: string;
  eventDate: any; artistId: string; status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
  locationPin?: LocationPin;
}

export default function EventDetail() {
  const { id } = useLocalSearchParams();
  const { guardedPush, guardedReplace, guardedBack } = useGuardedRouter();
  const { user, userProfile, isGuestMode } = useAuth();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocationPin, setEditLocationPin] = useState<LocationPin | null>(null);
  const [editDate, setEditDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [showMapPickerModal, setShowMapPickerModal] = useState(false);
  const [tempPin, setTempPin] = useState<LocationPin | null>(null);
  const [mapCenter, setMapCenter] = useState<LocationPin>({ latitude: DEFAULT_CENTER.latitude, longitude: DEFAULT_CENTER.longitude });
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const isNavigating = useRef(false);
  const webRef = useRef<WebView>(null);
  const pendingLocate = useRef<{ lat: number; lng: number } | null>(null);

  const safeBack = () => {
    if (isNavigating.current) return;
    isNavigating.current = true;
    const role = userProfile?.role;
    if (role === 'artist') guardedReplace('/(app)/artist/artist-home');
    else if (role === 'enthusiast') guardedReplace('/(app)/enthusiast/enthusiast-home');
    else guardedBack();
    setTimeout(() => { isNavigating.current = false; }, 1000);
  };

  useEffect(() => { if (!id) return; fetchEvent(); }, [id]);

  useEffect(() => {
    if (event) {
      setEditTitle(event.title);
      setEditLocation(event.location);
      setEditDescription(event.description);
      setEditLocationPin(event.locationPin || null);
      if (event.eventDate) {
        setEditDate(event.eventDate.toDate ? event.eventDate.toDate() : new Date(event.eventDate));
      }
    }
  }, [event]);

  const fetchEvent = async () => {
    try {
      const cacheKeyStr = cacheKey('event_detail', id as string);
      const cached = getCached<EventData>(cacheKeyStr);
      if (cached) { setEvent(cached); setLoading(false); return; }
      const snap = await getDoc(doc(db, 'events', id as string));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as EventData;
        setEvent(data);
        setCache(cacheKeyStr, data);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDateChange = (e: any, sel?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (sel) { const d = new Date(editDate); d.setFullYear(sel.getFullYear()); d.setMonth(sel.getMonth()); d.setDate(sel.getDate()); setEditDate(d); }
  };

  const handleTimeChange = (e: any, sel?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (sel) { const d = new Date(editDate); d.setHours(sel.getHours()); d.setMinutes(sel.getMinutes()); setEditDate(d); }
  };

  const handleUpdateEvent = async () => {
    if (!editTitle.trim() || !editLocation.trim()) { Alert.alert("Error", "Title and Location are required."); return; }
    setSaving(true);
    try {
      const updateData: any = { title: editTitle, location: editLocation, description: editDescription, eventDate: editDate };
      if (editLocationPin) updateData.locationPin = editLocationPin;
      else { const { deleteField } = await import('firebase/firestore'); updateData.locationPin = deleteField(); }
      await updateDoc(doc(db, 'events', id as string), updateData);
      setEvent(prev => prev ? { ...prev, title: editTitle, location: editLocation, description: editDescription, eventDate: editDate, locationPin: editLocationPin || undefined } : null);
      setShowEditModal(false);
      Alert.alert("Success", "Event updated successfully!");
    } catch { Alert.alert("Error", "Failed to update event."); }
    finally { setSaving(false); }
  };

  const flushLocate = () => {
    const p = pendingLocate.current;
    if (!p || !webRef.current) return;
    webRef.current.injectJavaScript(`window.locate && window.locate(${p.lat},${p.lng}); true;`);
  };

  const openMapPicker = async () => {
    setShowEditModal(false);
    setTempPin(editLocationPin);
    // Open the map right away and recenter via injected JS once GPS resolves,
    // instead of blocking the modal behind a slow GPS fix.
    setShowMapPickerModal(true);
    setFetchingLocation(true);

    const pos = await getQuickPosition();
    if (pos) {
      setMapCenter({ latitude: pos.latitude, longitude: pos.longitude });
      pendingLocate.current = { lat: pos.latitude, lng: pos.longitude };
      flushLocate();
    } else if (editLocationPin) {
      setMapCenter({ latitude: editLocationPin.latitude, longitude: editLocationPin.longitude });
    }
    setFetchingLocation(false);
  };

  const confirmMapPin = () => {
    if (tempPin) setEditLocationPin(tempPin);
    setShowMapPickerModal(false);
    setTimeout(() => setShowEditModal(true), 350);
  };

  const cancelMapPicker = () => {
    setShowMapPickerModal(false);
    setTimeout(() => setShowEditModal(true), 350);
  };

  const openInMaps = (pin: LocationPin, label: string) => {
    const googleMapsUrl = `https://maps.google.com/?q=${pin.latitude},${pin.longitude}`;
    Linking.openURL(googleMapsUrl);
  };

  const formatFullDate = (timestamp: any) => {
    if (!timestamp) return 'Date TBD';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatDateButton = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  const formatTimeButton = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getEventDateObj = (timestamp: any) => {
    if (!timestamp) return new Date();
    return timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  };

  const isArtist = userProfile?.role === 'artist' && user?.uid === event?.artistId;

  if (loading) return <View style={styles.loadingWrap}><ActivityIndicator size="large" color="#8B1A1A" /></View>;

  if (!event) return (
    <SafeAreaViewRN style={styles.root} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.iconBtn} onPress={safeBack}>
          <Feather name="arrow-left" size={18} color="#2A1005" />
        </TouchableOpacity>
      </View>
      <View style={styles.loadingWrap}><Text style={styles.notFoundText}>Event not found</Text></View>
    </SafeAreaViewRN>
  );

  const dateObj = getEventDateObj(event.eventDate);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* ── Top bar (floating over hero) ── */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={safeBack} activeOpacity={0.7}>
            <Feather name="arrow-left" size={18} color="#2A1005" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Event Details</Text>
          {!isArtist ? (
            <TouchableOpacity style={styles.iconBtn} onPress={() => {
              if (isGuestMode) { Alert.alert('Sign In Required', 'Please sign in to report events', [{ text: 'Sign In', onPress: () => guardedPush('/(auth)/login') }, { text: 'Sign Up', onPress: () => guardedPush('/(auth)/role-selection') }, { text: 'Cancel', style: 'cancel' }]); return; }
              setReportModalVisible(true);
            }} activeOpacity={0.7}>
              <Feather name="flag" size={16} color="#2A1005" />
            </TouchableOpacity>
          ) : <View style={{ width: 36 }} />}
        </View>

        {/* ── Hero date banner ── */}
        <View style={styles.heroBanner}>
          <View style={styles.heroDateBox}>
            <Text style={styles.heroMonth}>{MONTHS[dateObj.getMonth()].toUpperCase()}</Text>
            <Text style={styles.heroDay}>{dateObj.getDate()}</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle} numberOfLines={2}>{event.title}</Text>
            <View style={styles.heroTimePill}>
              <Feather name="clock" size={12} color="#8B1A1A" />
              <Text style={styles.heroTimeText}>{formatTimeButton(dateObj)}</Text>
            </View>
          </View>
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>

          {/* Info cards */}
          <View style={styles.infoCards}>
            <View style={styles.infoCard}>
              <View style={styles.infoIconBox}>
                <Feather name="calendar" size={18} color="#8B1A1A" />
              </View>
              <View style={styles.infoCardText}>
                <Text style={styles.infoCardLabel}>Date & Time</Text>
                <View style={styles.dateValueRow}>
                  <Text style={styles.infoCardValue}>{formatFullDate(event.eventDate)}</Text>
                  {isEventPast(event.eventDate) && (
                    <View style={styles.pastBadge}>
                      <Text style={styles.pastBadgeText}>Past Due</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIconBox}>
                <Feather name="map-pin" size={18} color="#8B1A1A" />
              </View>
              <View style={styles.infoCardText}>
                <Text style={styles.infoCardLabel}>Location</Text>
                <Text style={styles.infoCardValue}>{event.location}</Text>
              </View>
            </View>
          </View>

          {/* Map */}
          {event.locationPin && (
            <View style={styles.mapSection}>
              <Text style={styles.sectionLabel}>Location on Map</Text>
              <View style={styles.mapWrap}>
                <WebView
                  style={styles.map}
                  source={{ html: buildStaticMapHtml(event.locationPin.latitude, event.locationPin.longitude, event.title) }}
                  scrollEnabled={false}
                  javaScriptEnabled
                  originWhitelist={['*']}
                  cacheEnabled
                  cacheMode="LOAD_CACHE_ELSE_NETWORK"
                />
                <TouchableOpacity style={styles.openMapsBtn} onPress={() => openInMaps(event.locationPin!, event.title)}>
                  <Feather name="navigation" size={12} color="#fff" />
                  <Text style={styles.openMapsBtnText}>Open in Maps</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Description */}
          <View style={styles.descSection}>
            <Text style={styles.sectionLabel}>About This Event</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Footer ── */}
      {isArtist && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.manageBtn} onPress={() => setShowEditModal(true)} activeOpacity={0.8}>
            <Feather name="edit-2" size={16} color="#fff" />
            <Text style={styles.manageBtnText}>Manage Event</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Edit modal ── */}
      <Modal visible={showEditModal} animationType="slide" transparent onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Event</Text>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowEditModal(false)}>
                <Feather name="x" size={16} color="#2A1005" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Event Title <Text style={styles.required}>*</Text></Text>
                <TextInput style={styles.input} value={editTitle} onChangeText={setEditTitle} placeholder="Enter event title" placeholderTextColor="#C4AFA5" />
              </View>

              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Location <Text style={styles.required}>*</Text></Text>
                <TextInput style={styles.input} value={editLocation} onChangeText={setEditLocation} placeholder="Enter location" placeholderTextColor="#C4AFA5" />
              </View>

              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Map Pin <Text style={styles.optional}>(optional)</Text></Text>
                {editLocationPin ? (
                  <View style={styles.editMapWrap}>
                    <WebView style={styles.editMapView} source={{ html: buildStaticMapHtml(editLocationPin.latitude, editLocationPin.longitude, editLocation || 'Pin') }} scrollEnabled={false} javaScriptEnabled originWhitelist={['*']} cacheEnabled cacheMode="LOAD_CACHE_ELSE_NETWORK" />
                    <View style={styles.mapPinActions}>
                      <TouchableOpacity style={styles.mapPinBtn} onPress={openMapPicker}>
                        <Feather name="edit-2" size={12} color="#fff" />
                        <Text style={styles.mapPinBtnText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.mapPinBtn, styles.mapPinRemoveBtn]} onPress={() => setEditLocationPin(null)}>
                        <Feather name="trash-2" size={12} color="#fff" />
                        <Text style={styles.mapPinBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addPinBtn} onPress={openMapPicker} activeOpacity={0.75}>
                    <View style={styles.addPinIcon}><Feather name="map-pin" size={22} color="#8B1A1A" /></View>
                    <Text style={styles.addPinTitle}>Add Map Pin</Text>
                    <Text style={styles.addPinSub}>Help attendees find the exact location</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Date + Time row */}
              <View style={styles.dateTimeRow}>
                <View style={[styles.fieldSection, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Date</Text>
                  <TouchableOpacity style={[styles.pickerBtn, showDatePicker && styles.pickerBtnActive]} onPress={() => { setShowTimePicker(false); setShowDatePicker(true); }}>
                    <Feather name="calendar" size={15} color={showDatePicker ? "#8B1A1A" : "#9B8265"} />
                    <Text style={[styles.pickerBtnText, showDatePicker && styles.pickerBtnTextActive]}>{formatDateButton(editDate)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.fieldSection, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Time</Text>
                  <TouchableOpacity style={[styles.pickerBtn, showTimePicker && styles.pickerBtnActive]} onPress={() => { setShowDatePicker(false); setShowTimePicker(true); }}>
                    <Feather name="clock" size={15} color={showTimePicker ? "#8B1A1A" : "#9B8265"} />
                    <Text style={[styles.pickerBtnText, showTimePicker && styles.pickerBtnTextActive]}>{formatTimeButton(editDate)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {(showDatePicker || showTimePicker) && (
                <View style={styles.pickerContainer}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerHeaderText}>{showDatePicker ? "Select Date" : "Select Time"}</Text>
                    <TouchableOpacity style={styles.pickerCloseBtn} onPress={() => { setShowDatePicker(false); setShowTimePicker(false); }}>
                      <Feather name="x" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  {showDatePicker && <DateTimePicker value={editDate} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handleDateChange} minimumDate={new Date()} style={{ height: 120 }} textColor="#2A1005" />}
                  {showTimePicker && <DateTimePicker value={editDate} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={handleTimeChange} style={{ height: 120 }} textColor="#2A1005" />}
                </View>
              )}

              <View style={styles.fieldSection}>
                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput style={[styles.input, styles.textArea]} value={editDescription} onChangeText={setEditDescription} placeholder="Describe your event…" placeholderTextColor="#C4AFA5" multiline numberOfLines={4} textAlignVertical="top" />
              </View>

              <TouchableOpacity style={[styles.saveBtn, saving && styles.saveBtnDisabled]} onPress={handleUpdateEvent} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Map picker modal ── */}
      <Modal visible={showMapPickerModal} animationType="slide" statusBarTranslucent onRequestClose={cancelMapPicker}>
        <SafeAreaView style={styles.mapModal}>
          <View style={styles.mapModalHeader}>
            <TouchableOpacity style={styles.iconBtn} onPress={cancelMapPicker}>
              <Feather name="x" size={18} color="#2A1005" />
            </TouchableOpacity>
            <Text style={styles.mapModalTitle}>Pin Event Location</Text>
            <TouchableOpacity style={[styles.confirmBtn, !tempPin && styles.confirmBtnDisabled]} onPress={confirmMapPin} disabled={!tempPin}>
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mapBanner}>
            <Feather name="info" size={14} color="#8B1A1A" />
            <Text style={styles.mapBannerText}>
              {fetchingLocation ? "Getting your location…" : tempPin ? "Pin placed! Tap elsewhere to move it." : "Tap anywhere on the map to drop a pin."}
            </Text>
          </View>
          <WebView
            ref={webRef}
            style={{ flex: 1 }}
            source={{ html: buildPickerMapHtml(mapCenter.latitude, mapCenter.longitude, !!tempPin) }}
            javaScriptEnabled
            originWhitelist={['*']}
            onMessage={e => {
              try { const d = JSON.parse(e.nativeEvent.data); setTempPin({ latitude: d.lat, longitude: d.lng }); } catch {}
            }}
            onLoadEnd={flushLocate}
            cacheEnabled
            cacheMode="LOAD_CACHE_ELSE_NETWORK"
          />
        </SafeAreaView>
      </Modal>

      <ReportModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} targetId={event?.id || ""} targetType="artwork" reportedBy={user?.uid || ""} targetTitle={event?.title || "Event"} />
    </View>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background.primary },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background.primary,
  },
  notFoundText: {
    fontSize: 16,
    color: COLORS.text.secondary,
  },
  scroll: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 12,
    backgroundColor: COLORS.background.primary,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.primary,
  },

  // Hero banner
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 20,
    padding: 20,
  },
  heroDateBox: {
    width: 60,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: 10,
  },
  heroMonth: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
  },
  heroDay: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 36,
  },
  heroInfo: { flex: 1, gap: 8 },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 22,
  },
  heroTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroTimeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },

  // Content
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },

  // Info cards
  infoCards: { gap: 12 },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoIconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#FDF5F2',
    borderWidth: 1,
    borderColor: '#F0DDD8',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoCardText: { flex: 1 },
  infoCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text.muted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoCardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text.primary,
    lineHeight: 20,
  },
  dateValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pastBadge: {
    backgroundColor: '#EDE0D4',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  pastBadgeText: {
    color: '#6B5946',
    fontSize: 10,
    fontWeight: '700',
  },

  // Map
  mapSection: { gap: 12 },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  mapWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    height: 200,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: 200,
  },
  openMapsBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary.deepRed,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
  },
  openMapsBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Description
  descSection: {
    gap: 10,
    paddingBottom: 8,
  },
  description: {
    fontSize: 15,
    color: COLORS.text.secondary,
    lineHeight: 24,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary.deepRed,
    paddingVertical: 18,
    borderRadius: 14,
  },
  manageBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // Edit modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.border.light,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
    gap: 4,
    paddingBottom: 40,
  },

  // Form fields
  fieldSection: { marginBottom: 16 },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  required: { color: COLORS.primary.deepRed },
  optional: {
    fontSize: 12,
    fontWeight: '400',
    color: COLORS.text.muted,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text.primary,
  },
  textArea: {
    height: 100,
    paddingTop: 14,
  },

  // Map pin in edit modal
  editMapWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border.light,
    position: 'relative',
    height: 140,
  },
  editMapView: {
    width: '100%',
    height: 140,
  },
  mapPinActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    gap: 8,
  },
  mapPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary.deepRed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapPinRemoveBtn: { backgroundColor: '#555' },
  mapPinBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  addPinBtn: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
    borderStyle: 'dashed',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  addPinIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FDF5F2',
    borderWidth: 1,
    borderColor: '#F0DDD8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  addPinTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  addPinSub: {
    fontSize: 12,
    color: COLORS.text.secondary,
  },

  // Date / Time pickers
  dateTimeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  pickerBtnActive: {
    borderColor: COLORS.primary.deepRed,
    backgroundColor: '#FDF5F2',
  },
  pickerBtnText: {
    fontSize: 13,
    color: COLORS.text.primary,
    fontWeight: '500',
    flex: 1,
  },
  pickerBtnTextActive: { color: COLORS.primary.deepRed },
  pickerContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.text.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pickerHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  pickerCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Save button
  saveBtn: {
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: { backgroundColor: COLORS.button.disabled },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
  },

  // Map modal
  mapModal: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  mapModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text.primary,
  },
  confirmBtn: {
    backgroundColor: COLORS.primary.deepRed,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  confirmBtnDisabled: { backgroundColor: COLORS.button.disabled },
  confirmBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  mapBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FDF5F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0DDD8',
  },
  mapBannerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.secondary,
  },
});
