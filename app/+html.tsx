import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <ScrollViewStyleReset />
        <link rel="preload" href="./fonts/Ionicons.ttf" as="font" type="font/ttf" crossOrigin="" />
        <link rel="preload" href="./fonts/MaterialIcons.ttf" as="font" type="font/ttf" crossOrigin="" />
        <link rel="preload" href="./fonts/MaterialCommunityIcons.ttf" as="font" type="font/ttf" crossOrigin="" />
        <style>{`
          @font-face {
            font-family: 'ionicons';
            src: url('./fonts/Ionicons.ttf') format('truetype');
            font-display: block;
          }
          @font-face {
            font-family: 'material';
            src: url('./fonts/MaterialIcons.ttf') format('truetype');
            font-display: block;
          }
          @font-face {
            font-family: 'material-community';
            src: url('./fonts/MaterialCommunityIcons.ttf') format('truetype');
            font-display: block;
          }
        `}</style>
        <meta name="theme-color" content="#111417" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pickles Schedule" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="manifest" href="./manifest.webmanifest?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="./apple-touch-icon.png?v=2" />
        <link rel="icon" type="image/png" sizes="192x192" href="./icon-192.png?v=2" />
        <link rel="icon" type="image/png" sizes="512x512" href="./icon-512.png?v=2" />
        <link rel="icon" type="image/svg+xml" href="./pickle-favicon.svg?v=5" />
        <link rel="shortcut icon" type="image/svg+xml" href="./pickle-favicon.svg?v=5" />
      </head>
      <body>{children}</body>
    </html>
  );
}
