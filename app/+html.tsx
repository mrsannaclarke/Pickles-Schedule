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
        <link rel="icon" type="image/svg+xml" href="./pickle-favicon.svg?v=5" />
        <link rel="shortcut icon" type="image/svg+xml" href="./pickle-favicon.svg?v=5" />
      </head>
      <body>{children}</body>
    </html>
  );
}
