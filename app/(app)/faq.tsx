import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── FAQ DATA ────────────────────────────────────────────────────────────────

const ARTIST_FAQS = [
  {
    id: "a1",
    question: "How do I get verified as an artist?",
    answer:
      "Go to your Profile and tap 'Get Verified →'. You'll be asked to submit proof of your artistry (photos, portfolio links, or IDs). Our team reviews submissions within 3–5 business days. Once approved, a verified badge will appear on your profile.",
  },
  {
    id: "a2",
    question: "How do I list artwork for sale on the marketplace?",
    answer:
      "Tap the '+' button on the home screen and choose 'Create Listing'. Fill in the title, description, price, and upload at least one photo. Your listing will go live immediately after submission.",
  },
  {
    id: "a3",
    question: "What is the Showcase feature?",
    answer:
      "The Showcase is your personal portfolio gallery. Unlike marketplace listings, showcase items are not for sale — they're meant to display your art and build your following. Enthusiasts can like, view, and save items from your showcase.",
  },
  {
    id: "a4",
    question: "How do referral codes work?",
    answer:
      "Verified artists can generate a unique referral code from their profile under 'My Referral Code'. Share this code with new users during sign-up. When they use it, both of you may receive platform benefits as promotions are announced.",
  },
  {
    id: "a5",
    question: "Can I change my artist type after signing up?",
    answer:
      "Yes! Go to your profile, tap the edit icon (top-left), and choose a new artist type from Painting, Drawing & Illustration, Weaving & Textiles, or Other.",
  },
  {
    id: "a6",
    question: "How do I manage my product inventory?",
    answer:
      "Each marketplace listing shows a stock count. When you create or edit a listing, set the 'Quantity' field. The platform automatically decrements stock when orders are placed. You can update quantities anytime by editing the listing.",
  },
  {
    id: "a7",
    question: "What happens when my verification is rejected?",
    answer:
      "You'll see a 'Not Approved — Tap to Resubmit' pill on your profile. Tap it to review the feedback and resubmit with updated documents. Common reasons for rejection include blurry images or insufficient proof of authorship.",
  },
  {
    id: "a8",
    question: "How do I receive payment for sold items?",
    answer:
      "Likharrio is not involved in any payment transaction. All payment arrangements are made directly between you and the buyer — whether that's GCash, bank transfer, cash on meet-up, or any method you both agree on. Once you've settled payment and handed over the artwork, tap 'Mark as Sold' in the chat to update the listing. Always confirm payment before releasing your work.",
  },
  {
    id: "a9",
    question: "How do I create an event?",
    answer:
      "Go to your Artist Home and tap 'Create Event' in the Events Board section (or tap 'View All' → the '+' icon at the top right). Fill in the Event Title, Description, and Location. You can optionally drop a pin on the interactive map so attendees know exactly where to go — the app will even suggest your current location. Then pick a Date and Time (events must be at least one day in advance). A live preview card shows exactly how your event will appear to enthusiasts. Tap 'Create Event' at the bottom to publish. Your followers will receive a notification about your new event.",
  },
  {
    id: "a10",
    question: "What does the Real-Time Performance Forecast show?",
    answer:
      "The Performance Forecast card on your Artist Home tracks your most recently uploaded showcase item. It compares how your latest post is performing against your previous uploads and shows: (1) Projected Views — an estimated 24-hour view count based on your current momentum; (2) a visual track showing where you sit relative to your Typical Range; (3) a Status label — 'Above Typical', 'Typical', or 'Below Typical'; (4) Engagement Rate — the percentage of viewers who liked or saved the work; (5) Current Momentum — your average views per hour while the post is under 24 hours old; and (6) an Optimization Tip with a personalised suggestion to improve reach. Tap the card to open the full Performance Forecast modal with a detailed breakdown. Data refreshes automatically every 30 seconds for new posts and every 5 minutes for older ones.",
  },
  {
    id: "a11",
    question: "What is the Community Chat and what can I do there?",
    answer:
      "The Community Chat is a group messaging space shared with other verified artists (or enthusiasts, depending on your role). Inside you can post messages visible to all members of the community, see who else is active, and have open discussions about art, events, techniques, or anything creative. Messages are sent under your registered display name. Each community has its own chat room — artists have a dedicated space separate from enthusiast communities.",
  },
];

const ENTHUSIAST_FAQS = [
  {
    id: "e1",
    question: "How do I follow an artist?",
    answer:
      "Visit an artist's profile by tapping their name or avatar anywhere on the app. On their profile page, tap the 'Follow' button. Followed artists will appear in your Following list accessible from your profile.",
  },
  {
    id: "e2",
    question: "What is the difference between Liked and Saved?",
    answer:
      "'Liked' records artworks you've hearted — it shows appreciation to the artist. 'Saved' is your personal bookmark list for artworks or listings you want to revisit later. Both are private to you.",
  },
  {
    id: "e3",
    question: "How do I buy artwork from the marketplace?",
    answer:
      "Browse the Marketplace tab and tap any listing to open its detail page. Review the price, description, and stock count, then tap 'Contact Artist' to open a direct chat with the seller. From there, you and the artist coordinate payment and delivery directly — Likharrio is not involved in any transaction. Payment methods (GCash, bank transfer, cash on meet-up, etc.) are agreed upon between you and the artist.",
  },
  {
    id: "e4",
    question: "What is the 'For You' section?",
    answer:
      "The 'For You' section on your profile provides personalised art recommendations based on your interests, liked artworks, and artists you follow. The more you interact with the app, the better the recommendations become.",
  },
  {
    id: "e5",
    question: "Can I change my art interests?",
    answer:
      "Yes! Tap 'Edit Profile' on your profile screen and toggle the interest chips under the 'Interests' section. These preferences directly influence your 'For You' recommendations and home feed.",
  },
  {
    id: "e6",
    question: "How do I report inappropriate content?",
    answer:
      "On any artwork or listing detail page, tap the ⋮ (three-dot) menu in the top-right corner and select 'Report'. Choose a reason and submit. Our moderation team reviews all reports within 24 hours.",
  },
  {
    id: "e7",
    question: "Can I attend events listed on the app?",
    answer:
      "You can browse all upcoming art events posted by artists on the Events section of your home feed. Tap any event to view its title, description, location, date, and time. Attendance and RSVP are handled outside the app — contact the artist directly if you wish to participate.",
  },
  {
    id: "e8",
    question: "What is the Community Chat and what can I do there?",
    answer:
      "The Community Chat is a shared group messaging space for art enthusiasts. You can post messages visible to all members, join open discussions about art, events, and creative topics, and connect with fellow enthusiasts. Messages appear under your registered display name. Your community is separate from the artists' chat rooms.",
  },
  {
    id: "e9",
    question: "Is my activity (likes, saves, views) visible to others?",
    answer:
      "Artists can see the aggregate counts of likes and views on their artworks, but individual user identities are kept private. Your saved list is entirely private and visible only to you.",
  },
];

// ─── TYPES ───────────────────────────────────────────────────────────────────

type TabType = "artist" | "enthusiast";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

// ─── ACCORDION ITEM ──────────────────────────────────────────────────────────

function AccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={styles.accordionCard}>
      <TouchableOpacity
        style={styles.accordionHeader}
        onPress={toggle}
        activeOpacity={0.75}
      >
        <Text style={styles.accordionQuestion}>{item.question}</Text>
        <Feather
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color="#8B1A1A"
        />
      </TouchableOpacity>
      {open && (
        <View style={styles.accordionBody}>
          <View style={styles.accordionDivider} />
          <Text style={styles.accordionAnswer}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

export default function FaqScreen() {
  const params = useLocalSearchParams<{ role?: string }>();
  // If a role param is supplied, lock to that role — no tab switcher shown.
  const lockedRole: TabType | null =
    params.role === "artist"
      ? "artist"
      : params.role === "enthusiast"
      ? "enthusiast"
      : null;

  const initialTab: TabType = lockedRole ?? "artist";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const faqs = activeTab === "artist" ? ARTIST_FAQS : ENTHUSIAST_FAQS;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF7F2" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#2A1005" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab switcher — hidden when role is locked via param */}
      {!lockedRole && (
        <View style={styles.tabsContainer}>
          <View style={styles.tabsRow}>
            {(["artist", "enthusiast"] as TabType[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Feather
                  name={tab === "artist" ? "feather" : "heart"}
                  size={14}
                  color={activeTab === tab ? "#fff" : "#9B8265"}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.tabTextActive,
                  ]}
                >
                  {tab === "artist" ? "For Artists" : "For Enthusiasts"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* FAQ list */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHint}>
          {activeTab === "artist"
            ? "Everything you need to know as a Likharrio artist."
            : "Answers for art lovers using the Likharrio platform."}
        </Text>

        {faqs.map((item) => (
          <AccordionItem key={item.id} item={item} />
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE0D4",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "800",
    color: "#2A1005",
    letterSpacing: -0.2,
  },
  headerSpacer: {
    width: 38,
  },

  // Tabs
  tabsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: "#F0EAE0",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: "#8B1A1A",
    shadowColor: "#8B1A1A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9B8265",
  },
  tabTextActive: {
    color: "#fff",
    fontWeight: "700",
  },

  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionHint: {
    fontSize: 13,
    color: "#9B8265",
    marginBottom: 16,
    lineHeight: 18,
    fontStyle: "italic",
  },

  // Accordion
  accordionCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#2A1005",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  accordionQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#2A1005",
    lineHeight: 20,
  },
  accordionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  accordionDivider: {
    height: 1,
    backgroundColor: "#EDE0D4",
    marginBottom: 12,
  },
  accordionAnswer: {
    fontSize: 14,
    color: "#6B5946",
    lineHeight: 21,
  },

  // Contact card
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FDF5F2",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0DDD8",
    padding: 16,
    marginTop: 8,
  },
  contactText: {
    flex: 1,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#2A1005",
    marginBottom: 3,
  },
  contactSub: {
    fontSize: 13,
    color: "#9B8265",
  },
  contactEmail: {
    color: "#8B1A1A",
    fontWeight: "600",
  },
});
