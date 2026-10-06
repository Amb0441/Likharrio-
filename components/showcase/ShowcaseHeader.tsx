import { Ionicons } from "@expo/vector-icons";
import { Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import COLORS from "../../constants/Colors";
import type { Portfolio } from "../../lib/types";

const { width } = Dimensions.get("window");

interface ShowcaseHeaderProps {
  portfolio: Portfolio;
  activeSlide: number;
  isOwner: boolean;
  fullScreenImage: boolean;
  setActiveSlide: (slide: number) => void;
  setFullScreenImage: (v: boolean) => void;
  safeBack: () => void;
  guardedPush: (route: any) => void;
}

export default function ShowcaseHeader({
  portfolio,
  activeSlide,
  isOwner,
  fullScreenImage,
  setActiveSlide,
  setFullScreenImage,
  safeBack,
  guardedPush,
}: ShowcaseHeaderProps) {
  const displayImages =
    portfolio.images && portfolio.images.length > 0
      ? portfolio.images
      : [portfolio.coverImage];

  return (
    <>
      <View style={styles.floatingHeader}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={safeBack}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#000"
          />
        </TouchableOpacity>
        {isOwner && (
          <TouchableOpacity
            style={styles.editIconButton}
            onPress={() =>
              guardedPush({
                pathname: "/(app)/portfolio/edit-portfolio",
                params: { id: portfolio.id },
              })
            }
          >
            <Ionicons
              name="create-outline"
              size={24}
              color="#000"
            />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.carouselContainer}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={({ nativeEvent }) => {
            const slide = Math.ceil(
              nativeEvent.contentOffset.x /
              nativeEvent.layoutMeasurement.width,
            );
            setActiveSlide(slide);
          }}
          scrollEventThrottle={16}
        >
          {displayImages.map((img, index) => (
            <TouchableOpacity
              key={index}
              activeOpacity={0.9}
              onPress={() => setFullScreenImage(true)}
            >
              <Image
                source={{ uri: img }}
                style={styles.carouselImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
        {displayImages.length > 1 && (
          <View style={styles.pagination}>
            {displayImages.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === activeSlide &&
                  styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      <Modal
        visible={fullScreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImage(false)}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.fullscreenClose}
            onPress={() => setFullScreenImage(false)}
          >
            <Ionicons
              name="close"
              size={32}
              color={COLORS.text.white}
            />
          </TouchableOpacity>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{
              x: activeSlide * width,
              y: 0,
            }}
          >
            {displayImages.map((img, index) => (
              <Image
                key={index}
                source={{ uri: img }}
                style={styles.fullscreenImage}
                resizeMode="contain"
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingHeader: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  editIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  carouselContainer: {
    height: 400,
    position: "relative",
  },
  carouselImage: {
    width: width,
    height: 400,
  },
  pagination: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  paginationDotActive: {
    backgroundColor: COLORS.primary.deepRed,
    width: 24,
    borderColor: "transparent",
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  fullscreenClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
  },
  fullscreenImage: {
    width: width,
    height: "100%",
  },
});
