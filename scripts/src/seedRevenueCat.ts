// Seeds RevenueCat with Copointo's CONSUMABLE coin packs.
// Source: blueprint id=revenuecat (Replit integration).
//
// Coins are consumable (bought repeatedly, no entitlement gate), so this script
// intentionally creates NO subscription and NO entitlement — just 6 consumable
// products (one per coin pack) wired into a single current "default" offering.
//
// Run with: pnpm --filter @workspace/scripts exec tsx src/seedRevenueCat.ts
import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Offering,
  type Package,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "Copointo";

const APP_STORE_APP_NAME = "Copointo iOS";
const APP_STORE_BUNDLE_ID = "com.copointo.app";
const PLAY_STORE_APP_NAME = "Copointo Android";
const PLAY_STORE_PACKAGE_NAME = "com.copointo.app";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Copointo Coins";

// The single source of truth for coin packs. `coins` is encoded into the package
// lookup_key so the client can map a purchased package back to a coin amount
// without any extra storage. Prices mirror the previous OMPay USD packs.
const COIN_PACKS = [
  { coins: 500, priceUsd: 0.99, displayName: "500 Coins" },
  { coins: 1500, priceUsd: 4.99, displayName: "1,500 Coins" },
  { coins: 4500, priceUsd: 9.99, displayName: "4,500 Coins" },
  { coins: 12500, priceUsd: 19.99, displayName: "12,500 Coins" },
  { coins: 30000, priceUsd: 49.99, displayName: "30,000 Coins" },
  { coins: 80000, priceUsd: 99.99, displayName: "80,000 Coins" },
] as const;

const storeIdentifier = (coins: number) => `coins_${coins}`;
const packageLookupKey = (coins: number) => `coins_${coins}`;

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // --- Project ---
  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  // --- Apps (test store comes pre-created with the project) ---
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  const testApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testApp) throw new Error("No test_store app found");
  console.log("Test Store app:", testApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = newApp;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = newApp;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app:", playStoreApp.id);
  }

  // --- Consumable products (one per pack, per store) ---
  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureConsumable = async (
    targetApp: App,
    label: string,
    identifier: string,
    displayName: string,
    isTestStore: boolean,
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) => p.store_identifier === identifier && p.app_id === targetApp.id,
    );
    if (existing) {
      console.log(`${label} product already exists:`, existing.id);
      return existing;
    }

    const body: CreateProductData["body"] = {
      store_identifier: identifier,
      app_id: targetApp.id,
      type: "consumable",
      display_name: displayName,
    };
    if (isTestStore) {
      body.title = displayName; // required for Test Store products
    }

    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error(`Failed to create ${label} product (${identifier})`);
    console.log(`Created ${label} product:`, created.id);
    return created;
  };

  const addTestStorePrice = async (product: Product, priceUsd: number) => {
    const { error } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: product.id },
      body: { prices: [{ amount_micros: Math.round(priceUsd * 1_000_000), currency: "USD" }] },
    });
    if (error) {
      if (typeof error === "object" && error && "type" in error && error["type"] === "resource_already_exists") {
        console.log("  test store price already exists");
      } else {
        throw new Error("Failed to add test store price");
      }
    } else {
      console.log("  added test store price:", `$${priceUsd.toFixed(2)}`);
    }
  };

  // --- Offering ---
  let offering: Offering;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error("Failed to list offerings");

  const existingOffering = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (existingOffering) {
    console.log("Offering already exists:", existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOffering, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", newOffering.id);
    offering = newOffering;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering as current");
    console.log("Set offering as current");
  }

  const { data: existingPackages, error: listPackagesError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 50 },
  });
  if (listPackagesError) throw new Error("Failed to list packages");

  // --- Per-pack: products + package + attach ---
  for (const pack of COIN_PACKS) {
    const id = storeIdentifier(pack.coins);
    console.log(`\nPack ${pack.coins} coins ($${pack.priceUsd}):`);

    const testProduct = await ensureConsumable(testApp, "Test Store", id, pack.displayName, true);
    const appStoreProduct = await ensureConsumable(appStoreApp, "App Store", id, pack.displayName, false);
    const playStoreProduct = await ensureConsumable(playStoreApp, "Play Store", id, pack.displayName, false);

    await addTestStorePrice(testProduct, pack.priceUsd);

    const lookupKey = packageLookupKey(pack.coins);
    let pkg: Package | undefined = existingPackages.items?.find((p) => p.lookup_key === lookupKey);
    if (pkg) {
      console.log("  package already exists:", pkg.id);
    } else {
      const { data: newPackage, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: lookupKey, display_name: pack.displayName },
      });
      if (error) throw new Error(`Failed to create package ${lookupKey}`);
      pkg = newPackage;
      console.log("  created package:", pkg.id);
    }

    const { error: attachError } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkg.id },
      body: {
        products: [
          { product_id: testProduct.id, eligibility_criteria: "all" },
          { product_id: appStoreProduct.id, eligibility_criteria: "all" },
          { product_id: playStoreProduct.id, eligibility_criteria: "all" },
        ],
      },
    });
    if (attachError) {
      if (
        attachError.type === "unprocessable_entity_error" &&
        attachError.message?.includes("Cannot attach product")
      ) {
        console.log("  skipping attach: package already has incompatible product");
      } else {
        throw new Error(`Failed to attach products to package ${lookupKey}`);
      }
    } else {
      console.log("  attached products to package");
    }
  }

  // --- Public API keys ---
  const keysFor = async (appId: string, label: string) => {
    const { data, error } = await listAppPublicApiKeys({
      client,
      path: { project_id: project.id, app_id: appId },
    });
    if (error) throw new Error(`Failed to list public API keys for ${label}`);
    return data?.items.map((i) => i.key).join(", ") ?? "N/A";
  };

  const testKeys = await keysFor(testApp.id, "Test Store");
  const appStoreKeys = await keysFor(appStoreApp.id, "App Store");
  const playStoreKeys = await keysFor(playStoreApp.id, "Play Store");

  console.log("\n====================");
  console.log("RevenueCat setup complete!");
  console.log("REVENUECAT_PROJECT_ID:", project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID:", testApp.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID:", appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID:", playStoreApp.id);
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY:", testKeys);
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:", appStoreKeys);
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:", playStoreKeys);
  console.log("====================\n");
}

seedRevenueCat().catch((err) => {
  console.error(err);
  process.exit(1);
});
