import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import LikharrioLogo from "../ui/LikharrioLogo";

type Props = {
  onSignIn: () => void;
  onCreateAccount: () => void;
  onGuest: () => void;
};

const FEATURES = [
  { title: "Showcases", body: "Artists publish portfolios the community can browse, like, and save." },
  { title: "Marketplace", body: "Listings sit beside the work, so collectors can find something to take home." },
  { title: "Events", body: "Openings and workshops stay on the same page as the people making them." },
];

export default function WebWelcome({
  onSignIn,
  onCreateAccount,
  onGuest,
}: Props) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.nav}>
        <View style={styles.brand}>
          <LikharrioLogo size={32} variant="light" showWordmark={false} showTagline={false} />
          <Text style={styles.brandName}>Likharrio</Text>
        </View>
        <View style={styles.navActions}>
          <Pressable onPress={onSignIn} style={styles.navGhost}>
            <Text style={styles.navGhostText}>Sign in</Text>
          </Pressable>
          <Pressable onPress={onCreateAccount} style={styles.navSolid}>
            <Text style={styles.navSolidText}>Create account</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>CORDILLERAN ART & CREATIVITY</Text>
          <Text style={styles.headline}>A place to share work, find artists, and keep the conversation going.</Text>
          <Text style={styles.sub}>
            Likharrio is the community for makers and the people who follow them. Browse on the web the same way you would a gallery site.
          </Text>
          <View style={styles.heroActions}>
            <Pressable onPress={onCreateAccount} style={styles.primary}>
              <Text style={styles.primaryText}>Create account</Text>
            </Pressable>
            <Pressable onPress={onGuest} style={styles.secondary}>
              <Text style={styles.secondaryText}>Browse as guest</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Join the community</Text>
          <Text style={styles.cardSub}>Sign in with the email on your account.</Text>
          <Pressable onPress={onSignIn} style={styles.email}>
            <Text style={styles.emailText}>Sign in with email</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.features}>
        {FEATURES.map((feature) => (
          <View key={feature.title} style={styles.feature}>
            <Text style={styles.featureTitle}>{feature.title}</Text>
            <Text style={styles.featureBody}>{feature.body}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  content: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  nav: {
    height: 72,
    paddingHorizontal: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EDE0D4",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#2A1005",
  },
  navActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navGhost: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  navGhostText: {
    color: "#2A1005",
    fontWeight: "700",
    fontSize: 15,
  },
  navSolid: {
    backgroundColor: "#8B1A1A",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navSolidText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  hero: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 48,
    paddingHorizontal: 40,
    paddingTop: 56,
    paddingBottom: 28,
    maxWidth: 1180,
    width: "100%",
    alignSelf: "center",
  },
  heroCopy: {
    flex: 1.2,
    minWidth: 320,
    gap: 16,
  },
  kicker: {
    color: "#8B1A1A",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  headline: {
    color: "#2A1005",
    fontSize: 44,
    lineHeight: 52,
    fontWeight: "800",
  },
  sub: {
    color: "#6B5946",
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 520,
  },
  heroActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  primary: {
    backgroundColor: "#8B1A1A",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  secondary: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#E4D5C4",
    backgroundColor: "#FFFFFF",
  },
  secondaryText: {
    color: "#2A1005",
    fontWeight: "700",
    fontSize: 15,
  },
  card: {
    flex: 0.8,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    padding: 28,
    gap: 12,
    maxWidth: 380,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#2A1005",
  },
  cardSub: {
    color: "#6B5946",
    fontSize: 14,
    marginBottom: 6,
  },
  google: {
    borderWidth: 1,
    borderColor: "#E4D5C4",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#FFFcf8",
  },
  googleText: {
    fontWeight: "700",
    color: "#2A1005",
  },
  email: {
    backgroundColor: "#8B1A1A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  emailText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
  features: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingHorizontal: 40,
    paddingTop: 20,
    maxWidth: 1180,
    width: "100%",
    alignSelf: "center",
  },
  feature: {
    flex: 1,
    minWidth: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EDE0D4",
    padding: 20,
    gap: 8,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2A1005",
  },
  featureBody: {
    color: "#6B5946",
    fontSize: 14,
    lineHeight: 21,
  },
});
