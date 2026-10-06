import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import COLORS from "../../constants/Colors";
import { useMeasuredWidth } from "../../hooks/useLayoutMode";

const ADS = [
  {
    id: "1",
    image: require("../../assets/images/cafe.jpg"),
    title: "Kapehan sa Ulap",
    subtitle: "Your cozy art café destination",
  },
  {
    id: "2",
    image: require("../../assets/images/gallery.jpg"),
    title: "Art Painting Class",
    subtitle: "Coming soon",
  },
  {
    id: "3",
    image: require("../../assets/images/draw.jpg"),
    title: "Digital Arts Webinar",
    subtitle: "Attend on May 10!",
  },
];

export default function AdCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width: slideWidth, onLayout } = useMeasuredWidth();

  useEffect(() => {
    if (!slideWidth) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % ADS.length;
        scrollRef.current?.scrollTo({
          x: next * slideWidth,
          animated: true,
        });
        return next;
      });
    }, 3500);
    return () => clearInterval(interval);
  }, [slideWidth]);

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      {slideWidth > 0 && <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={slideWidth}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) =>
          setActiveIndex(
            Math.round(
              e.nativeEvent.contentOffset.x / slideWidth,
            ),
          )
        }
      >
        {ADS.map((ad) => (
          <TouchableOpacity
            key={ad.id}
            style={[styles.slide, { width: slideWidth }]}
            activeOpacity={0.92}
          >
            <Image source={ad.image} style={styles.image} resizeMode="cover" />
            <View style={styles.overlay}>
              <View>
                <Text style={styles.title}>{ad.title}</Text>
                <Text style={styles.subtitle}>{ad.subtitle}</Text>
              </View>
              <View style={styles.arrow}>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>}

      <View style={styles.dots}>
        {ADS.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 18,
    overflow: "hidden",
    height: 190,
    position: "relative",
  },
  slide: {
    height: 190,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.overlay.medium,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text.white,
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  arrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  dots: {
    position: "absolute",
    bottom: 10,
    right: 14,
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    width: 16,
    backgroundColor: COLORS.text.white,
  },
});
