import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { VIDEOS, VideoPost, formatNumber } from "@/data/mockData";
import { useColors } from "@/hooks/useColors";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const VIDEO_HEIGHT = Platform.OS === "web" ? SCREEN_HEIGHT - 84 - 67 : SCREEN_HEIGHT;

const BG_GRADIENTS = [
  ["#2C1810", "#6B3F1A"],
  ["#1A2C10", "#3F6B1A"],
  ["#10182C", "#1A3F6B"],
  ["#2C1A10", "#6B4B1A"],
  ["#1A102C", "#4B1A6B"],
];

function VideoCard({
  video,
  isActive,
  index,
}: {
  video: VideoPost;
  isActive: boolean;
  index: number;
}) {
  const colors = useColors();
  const router = useRouter();
  const { likedVideos, toggleLikeVideo } = useApp();
  const insets = useSafeAreaInsets();
  const isLiked = likedVideos.includes(video.id);
  const [localLikes, setLocalLikes] = useState(video.likes);

  const gradient = BG_GRADIENTS[index % BG_GRADIENTS.length];

  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLikeVideo(video.id);
    setLocalLikes((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const bottomPadding = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.videoCard, { height: VIDEO_HEIGHT }]}>
      <View style={[styles.videoBg, { backgroundColor: gradient[0] }]}>
        <View
          style={[
            styles.videoGlow,
            { backgroundColor: gradient[1], opacity: 0.4 },
          ]}
        />
        <View style={styles.videoCenter}>
          <Text style={styles.playIcon}>▶</Text>
          <Text style={[styles.duration, { color: "rgba(255,255,255,0.7)" }]}>
            {video.duration}
          </Text>
        </View>
      </View>

      <View style={[styles.videoOverlay, { paddingBottom: bottomPadding + 20 }]}>
        <View style={styles.videoInfo}>
          <TouchableOpacity
            style={styles.cafeTag}
            onPress={() => router.push(`/cafe/${video.cafeId}`)}
          >
            <Feather name="coffee" size={12} color="#FFF" />
            <Text style={styles.cafeName}>{video.cafeName}</Text>
          </TouchableOpacity>
          <Text style={styles.username}>@{video.username}</Text>
          <Text style={styles.description} numberOfLines={2}>
            {video.description}
          </Text>
          <View style={styles.views}>
            <Feather name="eye" size={12} color="rgba(255,255,255,0.7)" />
            <Text style={styles.viewsText}>{formatNumber(video.views)} views</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Feather
              name="heart"
              size={28}
              color={isLiked ? "#FF4040" : "#FFF"}
              fill={isLiked ? "#FF4040" : "none"}
            />
            <Text style={styles.actionText}>{formatNumber(localLikes)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Feather name="message-circle" size={28} color="#FFF" />
            <Text style={styles.actionText}>{formatNumber(video.comments)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Feather name="share-2" size={26} color="#FFF" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push(`/cafe/${video.cafeId}`)}
          >
            <Feather name="shopping-bag" size={26} color="#FFF" />
            <Text style={styles.actionText}>Order</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function VideosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const topPadding = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <Text style={styles.topTitle}>Copointo Videos</Text>
        <Feather name="camera" size={22} color="#FFF" />
      </View>

      <FlatList
        data={VIDEOS}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <VideoCard video={item} isActive={index === activeIndex} index={index} />
        )}
        pagingEnabled
        snapToAlignment="start"
        snapToInterval={VIDEO_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        scrollEnabled={VIDEOS.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  topTitle: {
    color: "#FFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  videoCard: {
    width: SCREEN_WIDTH,
    position: "relative",
  },
  videoBg: {
    position: "absolute",
    inset: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  videoGlow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    bottom: 100,
    right: -50,
  },
  videoCenter: {
    alignItems: "center",
    gap: 8,
  },
  playIcon: {
    fontSize: 64,
    color: "rgba(255,255,255,0.3)",
  },
  duration: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  videoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 100,
    gap: 12,
    background:
      "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)",
  },
  videoInfo: {
    flex: 1,
    gap: 6,
  },
  cafeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(196, 123, 43, 0.8)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  cafeName: {
    color: "#FFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  username: {
    color: "#FFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  description: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  views: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  viewsText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  actions: {
    alignItems: "center",
    gap: 20,
  },
  actionBtn: {
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    color: "#FFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
});
