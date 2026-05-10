import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

/**
 * Custom HTML shell for Expo Router web export.
 * Sets <title>, meta description, favicon and Open Graph tags so the
 * Copointo logo + Arabic name/description show up:
 *  - in the browser tab (favicon + title)
 *  - in Google search results (title + description)
 *  - in WhatsApp / Twitter / Facebook link previews (Open Graph)
 *
 * Only runs at build/export time; client navigation does not re-render it.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        <title>Copointo — موقع مختص بعالم الكوفيهات في سلطنة عمان</title>
        <meta
          name="description"
          content="موقع مختص بعالم الكوفيهات في سلطنة عمان — اكتشف الكوفيهات، اطلب قهوتك، احجز طاولتك، واستمتع بأجواء كوبوينتو."
        />
        <meta name="application-name" content="Copointo" />
        <meta name="theme-color" content="#000000" />

        {/* Favicons */}
        <link rel="icon" type="image/png" href="/copointo-logo.png" />
        <link rel="shortcut icon" type="image/png" href="/copointo-logo.png" />
        <link rel="apple-touch-icon" href="/copointo-logo.png" />

        {/* Open Graph (Facebook / WhatsApp / LinkedIn) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Copointo" />
        <meta property="og:title" content="Copointo — كوبوينتو" />
        <meta property="og:description" content="موقع مختص بعالم الكوفيهات في سلطنة عمان" />
        <meta property="og:image" content="/copointo-logo.png" />
        <meta property="og:locale" content="ar_OM" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Copointo — كوبوينتو" />
        <meta name="twitter:description" content="موقع مختص بعالم الكوفيهات في سلطنة عمان" />
        <meta name="twitter:image" content="/copointo-logo.png" />

        {/* Structured data for Google search results */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Copointo",
              alternateName: "كوبوينتو",
              description: "موقع مختص بعالم الكوفيهات في سلطنة عمان",
              inLanguage: "ar-OM",
            }),
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
