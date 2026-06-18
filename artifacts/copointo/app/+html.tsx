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
 *
 * PER-ROUTE METADATA: Because the app is served as a single-page application
 * (no Expo static prerender), this file emits home-page defaults that are
 * overridden at the HTTP layer before the response leaves the server:
 *   - Production / deployed: `artifacts/copointo/server/serve.js`
 *     `buildHtmlForRoute()` patches title, description, canonical, og:url,
 *     og:title, og:description, Twitter tags, and injects a WebPage JSON-LD
 *     block for each of the five public routes (/, /videos, /cafes-map,
 *     /game, /leaderboard) so crawlers and social bots see the correct
 *     metadata in the initial HTML without executing JavaScript.
 *   - Client-side SPA navigation: `artifacts/copointo/app/_layout.tsx`
 *     `applyWebMetadata()` updates the same tags in the DOM on every
 *     route change so the browser tab and sharing metadata stay accurate.
 *
 * When adding a new indexable public route, update ROUTE_META in both
 * `serve.js` and `_layout.tsx`, then add the URL to `public/sitemap.xml`.
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
        <meta name="google-site-verification" content="lkgy3K0fmwn37oHmksvjkzPe_IqCJuXjz0SCwS6Hbkc" />
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

        {/* Structured data for Google search results — Organization schema
            (with explicit `logo`) is what Google uses to show the brand
            logo next to the site in search results. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Copointo",
              alternateName: "كوبوينتو",
              url: "https://copointo.com/",
              logo: "https://copointo.com/copointo-logo.png",
              image: "https://copointo.com/copointo-logo.png",
              description: "منصة لعشاق القهوة والتحديات — سلطنة عمان",
              areaServed: "OM",
              sameAs: ["https://www.instagram.com/copointo._"],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Copointo",
              alternateName: "كوبوينتو",
              url: "https://copointo.com/",
              description: "منصة لعشاق القهوة والتحديات — سلطنة عمان",
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
      <body>
        {/* Fallback content shown to crawlers and users without JS,
            replacing Expo's default "You need to enable JavaScript". */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `
<div style="font-family:system-ui,sans-serif;background:#000;color:#E8B86D;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px 20px;direction:rtl;">
  <img src="/copointo-logo.png" alt="Copointo logo" width="80" height="80" style="border-radius:22px;margin-bottom:20px;" />
  <h1 style="font-size:32px;margin:0 0 10px;color:#E8B86D;">Copointo — كوبوينتو</h1>
  <p style="font-size:18px;color:#fff;margin:0 0 8px;">دليلك الأول لعالم الكوفيهات في سلطنة عمان ☕</p>
  <p style="font-size:15px;color:rgba(255,255,255,0.65);max-width:500px;margin:0 0 28px;line-height:1.7;">
    تصفّح أجمل الكوفيهات، اطلب مشروبك المفضّل، احجز طاولتك، استمتع بريلز الكوفيهات، واجمع نقاط الولاء للحصول على قهوة مجاناً.
  </p>
  <ul style="list-style:none;padding:0;margin:0 0 28px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">
    <li style="background:#111;border:1px solid #E8B86D44;border-radius:999px;padding:7px 16px;font-size:14px;color:#E8B86D;">طلب القهوة</li>
    <li style="background:#111;border:1px solid #E8B86D44;border-radius:999px;padding:7px 16px;font-size:14px;color:#E8B86D;">حجز الطاولات</li>
    <li style="background:#111;border:1px solid #E8B86D44;border-radius:999px;padding:7px 16px;font-size:14px;color:#E8B86D;">ريلز الكوفيهات</li>
    <li style="background:#111;border:1px solid #E8B86D44;border-radius:999px;padding:7px 16px;font-size:14px;color:#E8B86D;">نقاط الولاء</li>
    <li style="background:#111;border:1px solid #E8B86D44;border-radius:999px;padding:7px 16px;font-size:14px;color:#E8B86D;">خريطة الكوفيهات</li>
    <li style="background:#111;border:1px solid #E8B86D44;border-radius:999px;padding:7px 16px;font-size:14px;color:#E8B86D;">لوحة الشرف</li>
  </ul>
  <p style="color:rgba(255,255,255,0.45);font-size:13px;margin:0;">لاستخدام كوبوينتو يرجى تفعيل JavaScript في المتصفح.</p>
</div>`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
