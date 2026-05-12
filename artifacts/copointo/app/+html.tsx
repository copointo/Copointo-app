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

        <title>Copointo — دليل الكوفيهات في سلطنة عمان</title>
        <meta
          name="description"
          content="كوبوينتو — دليلك الأول لعالم الكوفيهات في سلطنة عمان ☕ تصفّح أجمل الكوفيهات، اطلب مشروبك المفضّل، احجز طاولتك، استمتع بقسائم الإهداء، شاهد ريلز الكوفيهات، واجمع نقاط الولاء واحصل على قهوة مجاناً."
        />
        <meta name="keywords" content="كوبوينتو, Copointo, كوفي عمان, قهوة عمان, كوفيهات سلطنة عمان, طلب قهوة, حجز طاولة كوفي, قسائم شرائية كوفي, coffee Oman, cafes Oman" />
        <meta name="application-name" content="Copointo" />
        <meta name="theme-color" content="#000000" />
        {/* Explicit indexing opt-in so Lighthouse's "is-crawlable" audit
            passes even when the page is served behind a proxy that may add
            an `X-Robots-Tag` header by default. `max-image-preview:large`
            unlocks rich image previews in Google search results. */}
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
        <meta name="googlebot" content="index, follow" />
        <link rel="canonical" href="https://copointo.com/" />

        {/* Favicons */}
        <link rel="icon" type="image/png" href="/copointo-logo.png" />
        <link rel="shortcut icon" type="image/png" href="/copointo-logo.png" />
        <link rel="apple-touch-icon" href="/copointo-logo.png" />

        {/* Open Graph (Facebook / WhatsApp / LinkedIn) */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Copointo" />
        <meta property="og:title" content="Copointo — دليل الكوفيهات في سلطنة عمان" />
        <meta property="og:description" content="كوبوينتو — دليلك الأول لعالم الكوفيهات في سلطنة عمان ☕ تصفّح أجمل الكوفيهات، اطلب مشروبك المفضّل، احجز طاولتك، استمتع بقسائم الإهداء، شاهد ريلز الكوفيهات، واجمع نقاط الولاء واحصل على قهوة مجاناً." />
        <meta property="og:image" content="/copointo-logo.png" />
        <meta property="og:url" content="https://copointo.com/" />
        <meta property="og:locale" content="ar_OM" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Copointo — دليل الكوفيهات في سلطنة عمان" />
        <meta name="twitter:description" content="كوبوينتو — دليلك الأول لعالم الكوفيهات في سلطنة عمان ☕ تصفّح أجمل الكوفيهات، اطلب مشروبك المفضّل، احجز طاولتك، استمتع بقسائم الإهداء، شاهد ريلز الكوفيهات، واجمع نقاط الولاء واحصل على قهوة مجاناً." />
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
              url: "https://copointo.com/",
              description: "كوبوينتو — دليلك الأول لعالم الكوفيهات في سلطنة عمان. تصفّح الكوفيهات، اطلب قهوتك، احجز طاولتك، أرسل قسائم إهداء، وشاهد ريلز الكوفيهات.",
              inLanguage: "ar-OM",
              publisher: {
                "@type": "Organization",
                name: "Copointo",
                url: "https://copointo.com/",
                logo: {
                  "@type": "ImageObject",
                  url: "https://copointo.com/copointo-logo.png",
                },
              },
            }),
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
