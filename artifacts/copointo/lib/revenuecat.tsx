// RevenueCat client integration for Copointo's CONSUMABLE coin packs.
// Source: blueprint id=revenuecat (Replit integration).
//
// Coins are consumable, so there is NO entitlement to check. Instead, each
// purchased package maps back to a coin amount via its identifier ("coins_<n>",
// set in scripts/src/seedRevenueCat.ts). The buy-coins screen consumes
// `offerings` + `purchase()` and credits coins using `coinsForPackage()`.
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import Purchases, {
  type PurchasesOffering,
  type PurchasesPackage,
  type CustomerInfo,
} from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

// Result of a purchase attempt. `cancelled` distinguishes a user-dismissed
// store sheet (no coins) from a completed transaction (credit coins once).
export type PurchaseResult = {
  cancelled: boolean;
  transactionId: string | null;
  customerInfo?: CustomerInfo;
};

// Coins are mapped from the package/product identifier "coins_<n>" rather than a
// hardcoded table, so the catalog stays single-sourced in RevenueCat.
export function coinsForPackage(pkg: PurchasesPackage): number {
  const fromPackage = pkg.identifier?.match(/coins_(\d+)/i);
  if (fromPackage) return parseInt(fromPackage[1], 10);
  const fromProduct = pkg.product?.identifier?.match(/coins_(\d+)/i);
  if (fromProduct) return parseInt(fromProduct[1], 10);
  return 0;
}

function getRevenueCatApiKey(): string {
  if (!REVENUECAT_TEST_API_KEY || !REVENUECAT_IOS_API_KEY || !REVENUECAT_ANDROID_API_KEY) {
    throw new Error("RevenueCat Public API Keys not found");
  }

  // Expo Go / web / dev all use the Test Store key (Preview API Mode handles the
  // missing native module gracefully).
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY;
  }
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY;
  return REVENUECAT_TEST_API_KEY;
}

export function initializeRevenueCat() {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) throw new Error("RevenueCat Public API Key not found");

  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });

  console.log("Configured RevenueCat");
}

function useSubscriptionContext(enabled: boolean) {
  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => Purchases.getCustomerInfo(),
    staleTime: 60 * 1000,
    enabled,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => Purchases.getOfferings(),
    staleTime: 300 * 1000,
    enabled,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: PurchasesPackage): Promise<PurchaseResult> => {
      try {
        const { customerInfo, transaction } = await Purchases.purchasePackage(packageToPurchase);
        return {
          cancelled: false,
          customerInfo,
          transactionId: transaction?.transactionIdentifier ?? null,
        };
      } catch (e: any) {
        // User dismissing the App Store / Play sheet is not an error.
        if (e?.userCancelled) return { cancelled: true, transactionId: null };
        throw e;
      }
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => Purchases.restorePurchases(),
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const currentOffering: PurchasesOffering | null = offeringsQuery.data?.current ?? null;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    currentOffering,
    isLoading: customerInfoQuery.isLoading || offeringsQuery.isLoading,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetchOfferings: offeringsQuery.refetch,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  // Configure RevenueCat INSIDE a mount effect — never at module-eval time.
  // Under the New Architecture (bridgeless), calling the native Purchases
  // module while the JS bundle is still being evaluated runs before the native
  // runtime is ready and segfaults on launch (EXC_BAD_ACCESS on the JS thread,
  // Swift/StoreKit frames) — which is what crashed the App Store review build.
  // Running it here, after the first render, guarantees the native side is up.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      initializeRevenueCat();
      setReady(true);
    } catch (err) {
      // A misconfiguration must never crash or block the app — coin purchases
      // simply stay unavailable (queries below remain disabled).
      console.warn("RevenueCat unavailable:", err);
    }
  }, []);
  const value = useSubscriptionContext(ready);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}

export type { PurchasesPackage, PurchasesOffering, CustomerInfo };
