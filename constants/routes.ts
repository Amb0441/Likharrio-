export const ROUTES = {
  // Auth group
  AUTH: {
    WELCOME: '/(auth)/welcome' as const,
    LOGIN: '/(auth)/login' as const,
    SIGNUP: '/(auth)/signup' as const,
    ROLE_SELECTION: '/(auth)/role-selection' as const,
    VERIFY_EMAIL: '/(auth)/verify-email' as const,
    SET_NAME: '/(auth)/set-name' as const,
    FORGOT_PASSWORD: '/(auth)/forgot-password' as const,
  },

  // App group — entry
  HOME: '/(app)/home' as const,

  // Artist
  ARTIST: {
    HOME: '/(app)/artist/artist-home' as const,
    PROFILE: '/(app)/artist/artist-profile' as const,
    PROFILE_VIEW: '/(app)/artist/artist-profile-view' as const,
    VERIFICATION: '/(app)/artist/artist-verification' as const,
    ALL: '/(app)/artist/allartist' as const,
  },

  // Enthusiast
  ENTHUSIAST: {
    HOME: '/(app)/enthusiast/enthusiast-home' as const,
    LIST: '/(app)/enthusiast/enthusiast-list' as const,
    PROFILE: '/(app)/enthusiast/enthusiast-profile' as const,
    RECOMMENDATIONS: '/(app)/enthusiast/recommendations' as const,
  },

  // Chat
  CHAT: {
    INDEX: '/(app)/chat' as const,
    DETAIL: '/(app)/chat/detail' as const,
    GROUP_CHAT: '/(app)/chat/group-chat' as const,
    GROUP_ARTIST: '/(app)/chat/group-artist' as const,
    GROUP_ENTHUSIAST: '/(app)/chat/group-enthusiast' as const,
  },

  // Marketplace
  MARKETPLACE: {
    ARTIST: '/(app)/marketplace/artist-marketplace' as const,
    ENTHUSIAST: '/(app)/marketplace/enthusiast-marketplace' as const,
    LISTING_ITEMS: '/(app)/marketplace/listing-items' as const,
    LISTING_DETAILS: '/(app)/marketplace/listing-details' as const,
    EDIT_LISTING: '/(app)/marketplace/edit-listing' as const,
  },

  // Events
  EVENTS: {
    ALL: '/(app)/events/event-all' as const,
    DETAIL: '/(app)/events/event-detail' as const,
    PUBLIC: '/(app)/events/event-public' as const,
    CREATE: '/(app)/events/create-event' as const,
  },

  // Portfolio
  PORTFOLIO: {
    CREATE: '/(app)/portfolio/create-portfolio' as const,
    EDIT: '/(app)/portfolio/edit-portfolio' as const,
    DETAILS: '/(app)/portfolio/portfolio-details' as const,
  },

  // Showcase
  SHOWCASE: {
    ALL: '/(app)/showcase/showcase-all' as const,
    DETAIL: '/(app)/showcase/showcase-detail' as const,
  },

  // Admin
  ADMIN: {
    HOME: '/(app)/admin' as const,
    VERIFICATIONS: '/(app)/admin/verifications' as const,
    USERS: '/(app)/admin/users' as const,
    REPORTS: '/(app)/admin/reports' as const,
  },

  // Misc
  NOTIFICATIONS: '/(app)/notifications' as const,
  CREATE_SELECTION: '/(app)/create-selection' as const,
  FAQ: '/(app)/faq' as const,
} as const;
