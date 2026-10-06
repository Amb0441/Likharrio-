import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const mobileScrollLock = `
@media (max-width: 719px) {
  html, body, #root {
    height: 100%;
    max-width: 100%;
    overflow: hidden;
    overscroll-behavior: none;
  }
  body {
    position: fixed;
    inset: 0;
    width: 100%;
  }
}
`;

const serviceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="Permissions-Policy" content="camera=(self), microphone=(), geolocation=(self)" />
        <meta name="theme-color" content="#1A0505" />
        <meta name="description" content="Discover artists, artwork, events, and moderate the Likharrio community." />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Likharrio" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: serviceWorker }} />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: mobileScrollLock }} />
      </head>
      <body style={{ backgroundColor: "#FAF7F2", margin: 0 }}>{children}</body>
    </html>
  );
}
