export type UID = string;

export type UserProfile = {
  uid: UID;
  email: string;
  displayName?: string;
  role?: "artist" | "enthusiast" | "admin";
  photoURL?: string;
  createdAt?: number;
};

export type AuthResult =
  | { ok: true; user: UserProfile }
  | { ok: false; error: string };

export interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  imageUrl?: string;
  images?: string[];
  saves?: number;
  views?: number;
  artistId: string;
  artistEmail: string;
  status?: "available" | "sold" | "reserved";
  createdAt?: any;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: any;
  parentId?: string | null;
}

export interface EventData {
  id: string;
  title: string;
  description: string;
  location: string;
  eventDate: any;
  artistId: string;
  artistName: string;
  status?: "upcoming" | "ongoing" | "completed" | "cancelled";
  createdAt?: any;
}

export interface Portfolio {
  id: string;
  artistId: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  coverImage: string;
  images?: string[];
  likes?: number;
  views?: number;
  saves?: number;
  artistEmail?: string;
  createdAt?: any;
}

export interface Artist {
  id: string;
  displayName: string;
  role?: string;
  email: string;
  profileImage?: string;
}

export type ReportTargetType = "listing" | "artist" | "artwork";

export interface ArtistProfile {
  id: string;
  displayName: string;
  profileImage?: string;
  artistType?: string;
}
