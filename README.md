# Likharrio

Likharrio is a community for Cordilleran artists and the people who follow their work. Artists share showcases, sell pieces, and post events. Enthusiasts browse, save, like, and message artists. Administrators review artist applications, accounts, and reports.

On a tablet or monitor, Likharrio is a website with a top bar. On a phone, it stays a mobile app with bottom navigation. Both use the same accounts and the same content.

## Demo accounts

Every demo account uses the password **DemoLikharrio2026!**

| Role | Name | Email |
|---|---|---|
| Admin | Likharrio Admin | admin@demo.likharrio.app |
| Artist | Maya Santos | maya.santos@demo.likharrio.app |
| Enthusiast | Carla Mendoza | carla.mendoza@demo.likharrio.app |

The admin account opens the admin pages in the app and the separate admin site. The artist account is already verified and has listings and showcases. The enthusiast account can browse, save, and chat.

## What you can do

**Artists** keep a studio home, publish showcases, list work for sale, post events, and talk with collectors. New artists submit a verification before they can publish.

**Enthusiasts** use Home, Discover, and the Marketplace. They can like, save, follow artists, and open a chat about a piece or join a community thread.

**Guests** can look around the website. Saving, liking, chatting, and posting ask them to sign in.

**Admins** review verifications, manage users, and handle reports. The admin site in `Likharrioadmin` is a separate login for the same community.

## Website, phone, and admin

- **Website** — top navigation, wide marketplace and Discover grids, and a profile laid out for a larger screen.
- **Mobile app** — the same Likharrio app on a phone, with bottom navigation and full-screen pages.
- **Admin** — overview, verifications, users, and reports, either inside the app or on the admin site.

## Setup

Copy `.env.example` to `.env` and fill in the Firebase API key on your own machine. Leave the Cloudinary API key and secret blank in the repository. Restart the app after changing `.env`.

```
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=

EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```
