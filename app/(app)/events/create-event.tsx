import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { useGuardedRouter } from "../../../utils/navigationGuard";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { db } from "../../../lib/firebase";
import VerificationGateModal from "../../../components/ui/VerificationGateModal";
import COLORS from "../../../constants/Colors";
import { useAuth } from "../../../contexts/AuthContext";
import { useArtistVerification } from "../../../hooks/useArtistVerification";
import { notifyNewEvent } from "../../../utils/notifications";
import {
  buildPickerMapHtml,
  buildStaticMapHtml,
  DEFAULT_CENTER,
  getQuickPosition,
} from "../../../utils/geo";

interface PinnedLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Returns midnight at the start of tomorrow
function getTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function CreateEvent() {
  const { guardedPush, guardedReplace, guardedBack } = useGuardedRouter();
  const { user, userProfile } = useAuth();
  const { canCreate, isPending, blockMessage } = useArtistVerification();
  const [gateVisible, setGateVisible] = useState(false);

  useEffect(() => {
    if (!canCreate) setGateVisible(true);
  }, [canCreate]);

  // ── Auto-detect GPS location on mount ──
  useEffect(() => {
    (async () => {
      const coords = await getQuickPosition();
      if (!coords) return;
      setUserLocation(coords);
      try {
        const results = await Location.reverseGeocodeAsync(coords);
        if (results.length > 0) {
          const r = results[0];
          const parts = [r.street, r.district, r.city, r.region, r.country].filter(Boolean);
          if (parts.length > 0) {
            setLocation(parts.join(", "));
            setPinnedLocation({ latitude: coords.latitude, longitude: coords.longitude, address: parts.join(", ") });
          }
        }
      } catch {}
    })();
  }, []);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [showMapModal, setShowMapModal] = useState(false);
  const [pinnedLocation, setPinnedLocation] = useState<PinnedLocation | null>(
    null,
  );
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [tempPin, setTempPin] = useState<PinnedLocation | null>(null);
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [eventDate, setEventDate] = useState(getTomorrow());
  const minimumDate = getTomorrow();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const webRef = useRef<WebView>(null);
  const pendingLocate = useRef<{
    lat: number;
    lng: number;
    userLat?: number | null;
    userLng?: number | null;
  } | null>(null);

  // Build picker HTML from the best-known center so the map renders instantly.
  const pickerHtml = useMemo(() => {
    const center = pinnedLocation
      ? { lat: pinnedLocation.latitude, lng: pinnedLocation.longitude }
      : userLocation
        ? { lat: userLocation.latitude, lng: userLocation.longitude }
        : { lat: DEFAULT_CENTER.latitude, lng: DEFAULT_CENTER.longitude };
    return buildPickerMapHtml(
      center.lat,
      center.lng,
      !!pinnedLocation,
      userLocation?.latitude,
      userLocation?.longitude,
    );
  }, [pinnedLocation, userLocation]);

  const formatDate = (d: Date) =>
    `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const handleDateChange = (_: any, sel?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (sel) {
      const n = new Date(eventDate);
      n.setFullYear(sel.getFullYear());
      n.setMonth(sel.getMonth());
      n.setDate(sel.getDate());
      setEventDate(n);
    }
  };
  const handleTimeChange = (_: any, sel?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (sel) {
      const n = new Date(eventDate);
      n.setHours(sel.getHours());
      n.setMinutes(sel.getMinutes());
      setEventDate(n);
    }
  };

  const flushLocate = () => {
    const p = pendingLocate.current;
    if (!p || !webRef.current) return;
    webRef.current.injectJavaScript(
      `window.locate && window.locate(${p.lat},${p.lng},${p.userLat ?? "null"},${p.userLng ?? "null"}); true;`,
    );
  };

  const applyLocate = (
    center: { latitude: number; longitude: number },
    user?: { latitude: number; longitude: number } | null,
  ) => {
    pendingLocate.current = {
      lat: center.latitude,
      lng: center.longitude,
      userLat: user?.latitude ?? null,
      userLng: user?.longitude ?? null,
    };
    flushLocate();
  };

  const openMapPicker = async () => {
    setTempPin(pinnedLocation);
    // Open the modal right away — the WebView renders instantly and recenters
    // via injected JS once GPS resolves, instead of waiting for the fix.
    setShowMapModal(true);

    const pos = await getQuickPosition();
    if (pos) {
      setUserLocation(pos);
      applyLocate(pinnedLocation ?? pos, pos);
    } else {
      applyLocate(
        pinnedLocation ?? userLocation ?? {
          latitude: DEFAULT_CENTER.latitude,
          longitude: DEFAULT_CENTER.longitude,
        },
        userLocation,
      );
    }
  };

  const handleWebViewMessage = async (data: string) => {
    try {
      const { lat, lng } = JSON.parse(data);
      setTempPin({ latitude: lat, longitude: lng });
      setFetchingAddress(true);
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });
        if (results?.length > 0) {
          const r = results[0];
          setTempPin({
            latitude: lat,
            longitude: lng,
            address: [r.name, r.street, r.city, r.region]
              .filter(Boolean)
              .join(", "),
          });
        }
      } catch (_) {
      } finally {
        setFetchingAddress(false);
      }
    } catch (_) {}
  };

  const confirmPin = () => {
    if (tempPin) {
      setPinnedLocation(tempPin);
      if (tempPin.address && !location) setLocation(tempPin.address);
    }
    setShowMapModal(false);
  };

  const handleCreateEvent = async () => {
    if (!canCreate) {
      setGateVisible(true);
      return;
    }
    if (!title.trim()) {
      Alert.alert("Error", "Please enter an event title");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Error", "Please enter an event description");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Error", "Please enter an event location");
      return;
    }
    if (!user) {
      Alert.alert("Error", "You must be logged in to create an event");
      return;
    }

    // Enforce at least 1 day in advance
    const tomorrow = getTomorrow();
    if (eventDate < tomorrow) {
      Alert.alert(
        "Invalid Date",
        "Events must be scheduled at least one day in advance.",
      );
      return;
    }

    setLoading(true);
    try {
      const eventData: any = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        eventDate,
        artistId: user.uid,
        artistName:
          userProfile?.displayName ||
          user.email?.split("@")[0] ||
          "Unknown Artist",
        artistEmail: user.email || "",
        status: "upcoming",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (pinnedLocation)
        eventData.locationPin = {
          latitude: pinnedLocation.latitude,
          longitude: pinnedLocation.longitude,
        };
      const docRef = await addDoc(collection(db, "events"), eventData);
      try {
        const { getDocs, query, where } = await import("firebase/firestore");
        const snap = await getDocs(
          query(collection(db, "following"), where("artistId", "==", user.uid)),
        );
        const artistName =
          userProfile?.displayName || user.email?.split("@")[0] || "An artist";
        snap.docs.forEach(async (d) => {
          await notifyNewEvent(
            d.data().userId,
            artistName,
            user.uid,
            title,
            docRef.id,
          );
        });
      } catch {}
      Alert.alert("Success", "Your event has been created!", [
        { text: "OK", onPress: () => guardedBack() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to create event. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* ── Top bar ── */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => guardedBack()}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={18} color="#2A1005" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* ── Header ── */}
          <View style={styles.headerSection}>
            <Text style={styles.title}>Create Event</Text>
            <Text style={styles.subtitle}>
              Host an exhibition or workshop for art enthusiasts
            </Text>
          </View>

          {/* ── Title ── */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Event Title <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Art Exhibition 2024"
              placeholderTextColor="#C4AFA5"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* ── Description ── */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your event…"
              placeholderTextColor="#C4AFA5"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          {/* ── Location ── */}
          <View style={styles.section}>
            <Text style={styles.label}>
              Location <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., SM Baguio Lower Ground"
              placeholderTextColor="#C4AFA5"
              value={location}
              onChangeText={setLocation}
              maxLength={150}
            />
          </View>

          {/* ── Map pin ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Pin Exact Location</Text>
            <Text style={styles.helperText}>
              Drop a pin so attendees know exactly where to go.
            </Text>

            {pinnedLocation ? (
              <View style={styles.mapPreviewWrap}>
                <WebView
                  style={styles.mapPreview}
                  source={{
                    html: buildStaticMapHtml(
                      pinnedLocation.latitude,
                      pinnedLocation.longitude,
                    ),
                  }}
                  scrollEnabled={false}
                  javaScriptEnabled
                  originWhitelist={["*"]}
                  cacheEnabled
                  cacheMode="LOAD_CACHE_ELSE_NETWORK"
                />
                <View style={styles.mapActions}>
                  <TouchableOpacity
                    style={styles.mapActionBtn}
                    onPress={openMapPicker}
                  >
                    <Feather name="edit-2" size={12} color="#fff" />
                    <Text style={styles.mapActionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.mapActionBtn, styles.mapActionRemove]}
                    onPress={() => {
                      setPinnedLocation(null);
                      setTempPin(null);
                    }}
                  >
                    <Feather name="trash-2" size={12} color="#fff" />
                    <Text style={styles.mapActionText}>Remove</Text>
                  </TouchableOpacity>
                </View>
                {pinnedLocation.address && (
                  <View style={styles.addressRow}>
                    <Feather name="map-pin" size={12} color="#8B1A1A" />
                    <Text style={styles.addressText} numberOfLines={1}>
                      {pinnedLocation.address}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.mapPickerBtn}
                onPress={openMapPicker}
                activeOpacity={0.75}
              >
                <View style={styles.mapPickerIcon}>
                  <Feather name="map-pin" size={24} color="#8B1A1A" />
                </View>
                <Text style={styles.mapPickerTitle}>Open Map & Drop Pin</Text>
                <Text style={styles.mapPickerSub}>
                  Tap to choose exact location
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Date & Time ── */}
          <View style={styles.rowFields}>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>
                Date <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.pickerRow,
                  showDatePicker && styles.pickerRowActive,
                ]}
                onPress={() => {
                  setShowTimePicker(false);
                  setShowDatePicker(true);
                }}
              >
                <Feather
                  name="calendar"
                  size={16}
                  color={showDatePicker ? "#8B1A1A" : "#9B8265"}
                />
                <Text
                  style={[
                    styles.pickerRowText,
                    showDatePicker && styles.pickerRowTextActive,
                  ]}
                >
                  {formatDate(eventDate)}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.label}>
                Time <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.pickerRow,
                  showTimePicker && styles.pickerRowActive,
                ]}
                onPress={() => {
                  setShowDatePicker(false);
                  setShowTimePicker(true);
                }}
              >
                <Feather
                  name="clock"
                  size={16}
                  color={showTimePicker ? "#8B1A1A" : "#9B8265"}
                />
                <Text
                  style={[
                    styles.pickerRowText,
                    showTimePicker && styles.pickerRowTextActive,
                  ]}
                >
                  {formatTime(eventDate)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {(showDatePicker || showTimePicker) && (
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerHeaderText}>
                  {showDatePicker ? "Select Date" : "Select Time"}
                </Text>
                <TouchableOpacity
                  style={styles.pickerCloseBtn}
                  onPress={() => {
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                  }}
                >
                  <Feather name="x" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={eventDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleDateChange}
                  minimumDate={minimumDate}
                  style={styles.picker}
                  textColor="#2A1005"
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={eventDate}
                  mode="time"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={handleTimeChange}
                  style={styles.picker}
                  textColor="#2A1005"
                />
              )}
            </View>
          )}

          {/* ── Preview card — matches event-all.tsx card exactly ── */}
          <View style={styles.section}>
            <Text style={styles.label}>Preview</Text>
            <View style={styles.eventCard}>
              {/* Date box — same as event board */}
              <View style={styles.eventDateBox}>
                <Text style={styles.eventDateLabel}>
                  {MONTHS[eventDate.getMonth()]}
                </Text>
                <Text style={styles.eventDateNum}>{eventDate.getDate()}</Text>
              </View>

              <View style={styles.eventInfo}>
                <Text style={styles.eventTitle} numberOfLines={1}>
                  {title || "Event Title"}
                </Text>
                <Text style={styles.eventSub} numberOfLines={1}>
                  {location || "Location"}
                </Text>
                <Text style={styles.eventTime}>{formatTime(eventDate)}</Text>
              </View>

              <View style={styles.eventRight}>
                {pinnedLocation && (
                  <View style={styles.pinBadge}>
                    <Feather name="map-pin" size={10} color="#8B1A1A" />
                  </View>
                )}
                <Feather name="chevron-right" size={16} color="#C8BAA8" />
              </View>
            </View>
          </View>

          {/* ── Info note ── */}
          <View style={styles.noteBox}>
            <Feather name="info" size={14} color="#8B1A1A" />
            <Text style={styles.noteText}>
              Events must be scheduled at least one day in advance. Your event
              will be visible to all enthusiasts on their home page.
            </Text>
          </View>
        </ScrollView>

        {/* ── Footer button ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.createBtn, loading && styles.createBtnDisabled]}
            onPress={handleCreateEvent}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="plus-circle" size={18} color="#fff" />
                <Text style={styles.createBtnText}>Create Event</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── Verification gate ── */}
      <VerificationGateModal
        visible={gateVisible}
        onClose={() => {
          setGateVisible(false);
          guardedBack();
        }}
        title={blockMessage.title}
        message={blockMessage.message}
        actionLabel={blockMessage.actionLabel}
        actionRoute={blockMessage.actionRoute}
        isPending={isPending}
      />

      {/* ── Map modal ── */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setShowMapModal(false)}
      >
        <SafeAreaView style={styles.mapModal}>
          <View style={styles.mapModalHeader}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setShowMapModal(false)}
            >
              <Feather name="x" size={18} color="#2A1005" />
            </TouchableOpacity>
            <Text style={styles.mapModalTitle}>Pin Event Location</Text>
            <TouchableOpacity
              style={[styles.confirmBtn, !tempPin && styles.confirmBtnDisabled]}
              onPress={confirmPin}
              disabled={!tempPin}
            >
              <Text style={styles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.mapBanner}>
            <Feather name="info" size={14} color="#8B1A1A" />
            <Text style={styles.mapBannerText}>
              {tempPin
                ? "Pin placed! Tap elsewhere to move it."
                : "Tap anywhere on the map to drop a pin."}
            </Text>
            {fetchingAddress && (
              <ActivityIndicator
                size="small"
                color="#8B1A1A"
                style={{ marginLeft: 8 }}
              />
            )}
          </View>

          <WebView
            ref={webRef}
            style={{ flex: 1 }}
            source={{ html: pickerHtml }}
            javaScriptEnabled
            originWhitelist={["*"]}
            onMessage={(e) => handleWebViewMessage(e.nativeEvent.data)}
            onLoadEnd={flushLocate}
            cacheEnabled
            cacheMode="LOAD_CACHE_ELSE_NETWORK"
          />

          {tempPin?.address && (
            <View style={styles.mapAddressPill}>
              <Feather name="map-pin" size={14} color="#8B1A1A" />
              <Text style={styles.mapAddressText} numberOfLines={2}>
                {tempPin.address}
              </Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ──
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background.primary },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  // Top bar
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border.light,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  // Header
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.text.primary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.text.secondary,
  },

  // Section
  section: {
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  required: { color: COLORS.primary.deepRed },
  helperText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    marginBottom: 10,
  },
  charCount: {
    fontSize: 12,
    color: COLORS.text.muted,
    textAlign: "right",
    marginTop: 6,
  },

  // Inputs
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text.primary,
  },
  textArea: {
    height: 110,
    paddingTop: 14,
  },

  // Map picker
  mapPickerBtn: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
    borderStyle: "dashed",
    alignItems: "center",
    paddingVertical: 28,
    gap: 6,
  },
  mapPickerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#FDF5F2",
    borderWidth: 1,
    borderColor: "#F0DDD8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  mapPickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
  },
  mapPickerSub: {
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  mapPreviewWrap: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  mapPreview: {
    width: "100%",
    height: 180,
  },
  mapActions: {
    flexDirection: "row",
    position: "absolute",
    top: 10,
    right: 10,
    gap: 8,
  },
  mapActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary.deepRed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  mapActionRemove: { backgroundColor: "#555" },
  mapActionText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.secondary,
  },

  // Date / Time row
  rowFields: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 0,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: COLORS.border.light,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerRowActive: {
    borderColor: COLORS.primary.deepRed,
    backgroundColor: "#FDF5F2",
  },
  pickerRowText: {
    fontSize: 13,
    color: COLORS.text.primary,
    fontWeight: "500",
    flex: 1,
  },
  pickerRowTextActive: { color: COLORS.primary.deepRed },
  pickerContainer: {
    marginHorizontal: 20,
    marginBottom: 22,
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border.light,
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.text.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pickerHeaderText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  pickerCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  picker: {
    height: 120,
    width: "100%",
  },

  // Preview card
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border.light,
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventDateBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(139,26,26,0.08)",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  eventDateLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: COLORS.primary.deepRed,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  eventDateNum: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.primary.deepRed,
    lineHeight: 20,
  },
  eventInfo: { flex: 1 },
  eventTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text.primary,
    marginBottom: 3,
  },
  eventSub: {
    fontSize: 12,
    color: COLORS.text.secondary,
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 11,
    color: COLORS.text.muted,
  },
  eventRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  pinBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "rgba(139,26,26,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Note box
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 20,
    padding: 14,
    backgroundColor: "#FDF5F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0DDD8",
    marginBottom: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.secondary,
    lineHeight: 19,
  },

  // Footer
  footer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 20 : 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary.deepRed,
    borderRadius: 14,
    paddingVertical: 18,
  },
  createBtnDisabled: { backgroundColor: COLORS.button.disabled },
  createBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#fff",
  },

  // Map modal
  mapModal: {
    flex: 1,
    backgroundColor: COLORS.background.primary,
  },
  mapModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border.light,
    backgroundColor: COLORS.background.primary,
  },
  mapModalTitle: {
    fontSize: 16,
    fontWeight: "700",
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
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  mapBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDF5F2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0DDD8",
  },
  mapBannerText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.secondary,
  },
  mapLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background.primary,
    gap: 12,
  },
  mapLoadingText: {
    fontSize: 14,
    color: COLORS.text.secondary,
  },
  mapAddressPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 20,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: "#F0DDD8",
    shadowColor: COLORS.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  mapAddressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text.primary,
    fontWeight: "500",
  },
});
