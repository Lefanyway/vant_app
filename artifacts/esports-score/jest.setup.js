jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
  Ionicons: () => null,
}));

jest.mock("@/components/ResolvedLogo", () => ({
  ResolvedLogo: () => null,
  logoSlot: { list: { size: 22, maxWidth: 64 }, header: { size: 28, maxWidth: 84 }, profile: { size: 72, maxWidth: 180 } },
}));

jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

// Screens read the bell's unread count; tests run without the Supabase-backed provider.
jest.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => ({ items: [], unread: 0, markAllRead: async () => undefined, simulate: async () => undefined }),
  NotificationsProvider: ({ children }) => children,
}));

jest.mock("react-native-keyboard-controller", () => require("react-native-keyboard-controller/jest"));
