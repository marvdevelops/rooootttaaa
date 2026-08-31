import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { CheckIcon, CloseIcon, LockIcon } from '../components/icons';
import { useAuth } from '../lib/AuthContext';
import {
  getDefaultOffering,
  getPaywallDiagnostics,
  isRevenueCatAvailable,
  PRO_ENTITLEMENT_ID,
  type PaywallDiagnostics,
} from '../lib/revenuecat';
import { colors, elevation, fonts, radii } from '../theme/theme';
import Purchases from 'react-native-purchases';

export type PaywallTrigger =
  | 'route_limit'
  | 'gpx_import'
  | 'route_customize'
  | 'group_run_limit'
  | 'group_run_join_limit'
  | 'leg_distance'
  | 'flyby_video'
  // Opened directly from the Profile screen's "Rootah Pro" card, not from
  // hitting a specific limit — needed so App Review (and any user just
  // browsing) can find and reach the IAP without first tripping a gate.
  | 'direct';

interface Props {
  /** Which locked feature sent the user here — drives a tailored, motivation-specific headline; no gating logic depends on it. */
  trigger?: PaywallTrigger;
  onClose: () => void;
  onSuccess: () => void;
}

// Name the exact wall the user just hit, not a generic upsell. Benefit-led,
// no em dashes (see rootah-pro-paywall.md copy principles).
const TRIGGER_HEADLINE: Record<NonNullable<Props['trigger']>, string> = {
  route_limit: "You've outgrown the free plan",
  gpx_import: 'Your watch is waiting',
  route_customize: 'Make this route your own',
  group_run_limit: "You're already hosting a run",
  group_run_join_limit: "You've joined your free event",
  leg_distance: 'Bigger routes need Pro',
  flyby_video: 'Unlock the route fly-through',
  direct: 'Run more. Plan further. Own every route.',
};

const TRIGGER_SUBHEAD: Record<NonNullable<Props['trigger']>, string> = {
  route_limit: 'Rootah Pro gives you unlimited saved routes and the full builder, with no limits attached.',
  gpx_import: 'Rootah Pro lets you bring routes in from Strava, Komoot, or your watch.',
  route_customize: 'Rootah Pro lets you copy any public route and edit your own version.',
  group_run_limit: 'Rootah Pro lets you host unlimited group runs with unlimited RSVPs.',
  group_run_join_limit: 'Rootah Pro lets you join unlimited events, any time.',
  leg_distance: 'Rootah Pro plans routes with legs up to 50 km.',
  flyby_video: 'Rootah Pro unlocks the cinematic fly-through of any route.',
  direct: 'Rootah Pro gives you the full route-building experience, with no limits attached.',
};

const DEFAULT_HEADLINE = 'Run more. Plan further. Own every route.';
const DEFAULT_SUBHEAD = 'Rootah Pro gives you the full route-building experience, with no limits attached.';

const PRO_BENEFITS = [
  'Unlimited saved routes',
  'Import routes from Strava, Komoot, or your watch',
  'Plan longer routes, legs up to 50 km',
  'Copy any public route and make it your own',
  'Host unlimited group runs with unlimited RSVPs',
  'Grow your club beyond 25 members',
  'Recurring weekly and monthly events',
];

function periodLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'ANNUAL':
      return 'Yearly';
    case 'SIX_MONTH':
      return '6 Months';
    case 'THREE_MONTH':
      return '3 Months';
    case 'TWO_MONTH':
      return '2 Months';
    case 'MONTHLY':
      return 'Monthly';
    case 'WEEKLY':
      return 'Weekly';
    case 'LIFETIME':
      return 'Lifetime';
    default:
      return pkg.product.title;
  }
}

const MONTHS_IN_PACKAGE: Record<string, number> = {
  ANNUAL: 12, SIX_MONTH: 6, THREE_MONTH: 3, TWO_MONTH: 2, MONTHLY: 1, WEEKLY: 0.25,
};

/** "SAVE X%" for a longer plan vs. the monthly plan. RevenueCat doesn't
 * always populate pricePerMonth (older StoreKit), so fall back to deriving
 * it from the raw price and how many months the package spans. */
function savingsPercent(pkg: PurchasesPackage, packages: PurchasesPackage[]): number | null {
  if (pkg.packageType === 'MONTHLY') return null;
  const monthly = packages.find((p) => p.packageType === 'MONTHLY');
  if (!monthly) return null;

  const span = MONTHS_IN_PACKAGE[pkg.packageType] ?? 1;
  const thisPerMonth = pkg.product.pricePerMonth || (pkg.product.price ? pkg.product.price / span : 0);
  const baseline = monthly.product.pricePerMonth || monthly.product.price || 0;
  if (!baseline || !thisPerMonth) return null;

  const pct = Math.round((1 - thisPerMonth / baseline) * 100);
  return pct > 0 ? pct : null;
}

const UNIT_DAYS: Record<string, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/** "P2W" -> 14, "P14D" -> 14, "P1M" -> 30. StoreKit's `period` string is the
 * most reliably-populated field; `periodNumberOfUnits` is missing on some SDK
 * builds, which made a 2-week trial read as "1 week". */
function parseIsoPeriodDays(p: string): number | null {
  const m = p.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/);
  if (!m) return null;
  const n = (i: number) => (m[i] ? parseInt(m[i], 10) : 0);
  const days = n(1) * 365 + n(2) * 30 + n(3) * 7 + n(4);
  return days > 0 ? days : null;
}

/** Total days of a free intro offer, or null if the package has no free trial. */
function introTrialDays(pkg: PurchasesPackage): number | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const fromIso = intro.period ? parseIsoPeriodDays(intro.period) : null;
  const fromUnits = (intro.periodNumberOfUnits ?? 0) * (UNIT_DAYS[intro.periodUnit] ?? 0) || null;
  const perCycle = fromIso ?? fromUnits ?? 1;
  return perCycle * Math.max(intro.cycles ?? 1, 1);
}

/** "2 weeks" reads better than "14 days" for whole-week trials. Returns a
 * Title-cased noun phrase for CTAs and an adjective form for running copy. */
function trialLength(days: number): { noun: string; adj: string } {
  if (days >= 7 && days % 7 === 0) {
    const w = days / 7;
    return { noun: `${w} Week${w === 1 ? '' : 's'}`, adj: `${w}-week` };
  }
  if (days % 30 === 0) {
    const m = days / 30;
    return { noun: `${m} Month${m === 1 ? '' : 's'}`, adj: `${m}-month` };
  }
  return { noun: `${days} Day${days === 1 ? '' : 's'}`, adj: `${days}-day` };
}

function trialLabel(pkg: PurchasesPackage): string | null {
  const days = introTrialDays(pkg);
  if (days == null) return null;
  return `${trialLength(days).adj} free trial`;
}

/** e.g. "year", "month" — for the auto-renewal disclosure. */
function periodWord(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case 'ANNUAL': return 'year';
    case 'SIX_MONTH': return '6 months';
    case 'THREE_MONTH': return '3 months';
    case 'TWO_MONTH': return '2 months';
    case 'WEEKLY': return 'week';
    default: return 'month';
  }
}

/** Apple 3.1.2 / Google disclosure — must state trial length, post-trial
 * price, that it renews automatically, and where to cancel. Missing or vague
 * disclosure is a standard first-submission rejection. */
function finePrintFor(pkg: PurchasesPackage | null): string {
  if (!pkg) return '';
  const price = pkg.product.priceString;
  const per = periodWord(pkg);
  const days = introTrialDays(pkg);
  if (days != null) {
    const { adj } = trialLength(days);
    return `Your ${adj} free trial starts today. After it ends, ${price} is charged to your Apple ID unless you cancel at least 24 hours before the trial ends. The subscription then renews automatically every ${per} until you cancel. Manage or cancel anytime in your device Settings.`;
  }
  return `${price} is charged to your Apple ID at confirmation. The subscription renews automatically every ${per} until you cancel. Manage or cancel anytime in your device Settings.`;
}

export default function PaywallScreen({ trigger, onClose, onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const { refreshTier } = useAuth();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [diagnostics, setDiagnostics] = useState<PaywallDiagnostics | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const loadOffering = useCallback(() => {
    setLoadingOffering(true);
    setDiagnostics(null);
    getDefaultOffering()
      .then((o) => {
        setOffering(o);
        // Default to the best-value plan (biggest savings vs. monthly) so the
        // highest-converting choice is pre-selected, not the cheapest-looking one.
        if (o && o.availablePackages.length > 0) {
          const annual = o.availablePackages.find((p) => p.packageType === 'ANNUAL');
          setSelectedId((annual ?? o.availablePackages[0]).identifier);
        }
        // Always pull a diagnostic (offering ids, package ids, product ids,
        // raw errors). Shown automatically when nothing loads; also reachable
        // via a long-press on the eyebrow so we can inspect a *partial*
        // offering (e.g. monthly present, annual missing) without a build.
        getPaywallDiagnostics().then(setDiagnostics).catch(() => {});
      })
      .finally(() => setLoadingOffering(false));
  }, []);

  useEffect(() => {
    loadOffering();
  }, [loadOffering]);

  const packages = offering?.availablePackages ?? [];
  const selectedPackage = useMemo(
    () => packages.find((p) => p.identifier === selectedId) ?? null,
    [packages, selectedId],
  );

  const handlePurchase = useCallback(async () => {
    if (!selectedPackage) return;
    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(selectedPackage);
      if (customerInfo.entitlements.active[PRO_ENTITLEMENT_ID]) {
        await refreshTier();
        onSuccess();
      }
    } catch (e) {
      const cancelled = typeof e === 'object' && e !== null && 'userCancelled' in e && (e as { userCancelled?: boolean }).userCancelled;
      if (!cancelled) {
        Alert.alert('Purchase failed', e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  }, [selectedPackage, refreshTier, onSuccess]);

  const handleRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active[PRO_ENTITLEMENT_ID]) {
        await refreshTier();
        onSuccess();
      } else {
        Alert.alert('Nothing to restore', "We couldn't find an active Rootah Pro subscription for this account.");
      }
    } catch (e) {
      Alert.alert('Restore failed', e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setRestoring(false);
    }
  }, [refreshTier, onSuccess]);

  if (!isRevenueCatAvailable()) {
    // Android isn't wired up yet (Play Console subscriptions still pending
    // the closed-testing eligibility window) — this keeps the screen from
    // showing a permanently broken purchase flow in the meantime.
    return (
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <CloseIcon size={16} />
          </Pressable>
        </View>
        <View style={styles.unavailableWrap}>
          <Text style={styles.title}>Rootah Pro isn&apos;t available yet</Text>
          <Text style={styles.subtitle}>Check back soon — Pro is on the way for this platform.</Text>
        </View>
      </View>
    );
  }

  const selectedTrialDays = selectedPackage ? introTrialDays(selectedPackage) : null;
  const ctaLabel = !selectedPackage
    ? 'Continue'
    : selectedTrialDays != null
      ? `Try ${trialLength(selectedTrialDays).noun} Free`
      : 'Start Rootah Pro';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <CloseIcon size={16} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable onLongPress={() => setShowDiagnostics((v) => !v)} delayLongPress={600}>
          <Text style={styles.eyebrow}>ROOTAH PRO</Text>
        </Pressable>
        <Text style={styles.title}>{trigger ? TRIGGER_HEADLINE[trigger] : DEFAULT_HEADLINE}</Text>
        <Text style={styles.subheadline}>{trigger ? TRIGGER_SUBHEAD[trigger] : DEFAULT_SUBHEAD}</Text>

        {showDiagnostics && diagnostics && (
          <Text selectable style={styles.diagBlock}>
            {[
              `summary: ${diagnostics.summary}`,
              `platform: ${diagnostics.platform}`,
              `apiKey: ${diagnostics.hasApiKey ? 'present' : 'MISSING'}`,
              `configured: ${diagnostics.configured}`,
              `entitlementId: ${diagnostics.entitlementId}`,
              `appUserId: ${diagnostics.appUserId ?? '—'}`,
              `offerings(all): ${diagnostics.offeringCount}`,
              `currentOffering: ${diagnostics.currentOfferingId ?? '—'}`,
              `packages: ${diagnostics.packageCount}`,
              `productIds: ${diagnostics.productIds.join(', ') || '—'}`,
              diagnostics.configureError ? `configureError: ${diagnostics.configureError}` : null,
              diagnostics.offeringsError ? `offeringsError: ${diagnostics.offeringsError}` : null,
            ]
              .filter(Boolean)
              .join('\n')}
          </Text>
        )}

        <View style={styles.featureList}>
          {PRO_BENEFITS.map((feature) => (
            <View key={feature} style={styles.featureRow}>
              <View style={styles.featureCheck}>
                <CheckIcon size={11} color={colors.white} />
              </View>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {loadingOffering ? (
          <ActivityIndicator color={colors.coral} style={{ marginTop: 24 }} />
        ) : packages.length > 0 ? (
          <View style={styles.packageList}>
            {packages.map((pkg) => {
              const selected = pkg.identifier === selectedId;
              const savings = savingsPercent(pkg, packages);
              const trial = trialLabel(pkg);
              return (
                <Pressable
                  key={pkg.identifier}
                  style={[styles.packageCard, selected && styles.packageCardSelected]}
                  onPress={() => setSelectedId(pkg.identifier)}
                >
                  <View style={[styles.radio, selected && styles.radioSelected]}>
                    {selected && <View style={styles.radioDot} />}
                  </View>
                  <View style={styles.packageInfo}>
                    <View style={styles.packageInfoTopRow}>
                      <Text style={styles.packageTitle}>{periodLabel(pkg)}</Text>
                      {savings != null && (
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsBadgeText}>SAVE {savings}%</Text>
                        </View>
                      )}
                    </View>
                    {trial ? (
                      <Text style={styles.packageTrial}>
                        {trial}, then {pkg.product.priceString}
                        {pkg.product.pricePerMonthString && pkg.packageType !== 'MONTHLY' ? ` (${pkg.product.pricePerMonthString}/mo)` : ''}
                      </Text>
                    ) : pkg.product.pricePerMonthString && pkg.packageType !== 'MONTHLY' ? (
                      <Text style={styles.packageSubprice}>{pkg.product.pricePerMonthString}/mo</Text>
                    ) : null}
                  </View>
                  <Text style={styles.packagePrice}>{pkg.product.priceString}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.retryWrap}>
            <Text style={styles.subtitle}>We couldn&apos;t load the plans just now.</Text>
            <Pressable style={styles.retryButton} onPress={loadOffering} accessibilityRole="button" accessibilityLabel="Try again">
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
            {diagnostics && (
              <>
                <Text style={styles.diagSummary}>{diagnostics.summary}</Text>
                <Pressable onPress={() => setShowDiagnostics((v) => !v)} accessibilityRole="button">
                  <Text style={styles.diagToggle}>{showDiagnostics ? 'Hide details' : 'Show details'}</Text>
                </Pressable>
                {showDiagnostics && (
                  <Text selectable style={styles.diagBlock}>
                    {[
                      `platform: ${diagnostics.platform}`,
                      `apiKey: ${diagnostics.hasApiKey ? 'present' : 'MISSING'}`,
                      `configured: ${diagnostics.configured}`,
                      `entitlementId: ${diagnostics.entitlementId}`,
                      `appUserId: ${diagnostics.appUserId ?? '—'}`,
                      `offerings(all): ${diagnostics.offeringCount}`,
                      `currentOffering: ${diagnostics.currentOfferingId ?? '—'}`,
                      `packages: ${diagnostics.packageCount}`,
                      diagnostics.productIds.length ? `productIds: ${diagnostics.productIds.join(', ')}` : null,
                      diagnostics.configureError ? `configureError: ${diagnostics.configureError}` : null,
                      diagnostics.offeringsError ? `offeringsError: ${diagnostics.offeringsError}` : null,
                    ]
                      .filter(Boolean)
                      .join('\n')}
                  </Text>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.ctaButton, (!selectedPackage || purchasing) && styles.ctaButtonDisabled]}
          onPress={handlePurchase}
          disabled={!selectedPackage || purchasing || restoring}
        >
          {purchasing ? <ActivityIndicator color={colors.white} /> : <Text style={styles.ctaButtonText}>{ctaLabel}</Text>}
        </Pressable>

        {selectedPackage && <Text style={styles.finePrint}>{finePrintFor(selectedPackage)}</Text>}

        <View style={styles.trustRow}>
          <LockIcon size={12} color={colors.mist} />
          <Text style={styles.trustText}>Secure payment. Cancel anytime.</Text>
        </View>

        <Pressable style={styles.restoreButton} onPress={handleRestore} disabled={restoring || purchasing}>
          {restoring ? (
            <ActivityIndicator color={colors.stone} size="small" />
          ) : (
            <Text style={styles.restoreButtonText}>Restore purchases</Text>
          )}
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL('https://rootah.com/terms')}>
            <Text style={styles.legalText}>Terms of Use</Text>
          </Pressable>
          <Text style={styles.legalDivider}>·</Text>
          <Pressable onPress={() => Linking.openURL('https://rootah.com/privacy')}>
            <Text style={styles.legalText}>Privacy Policy</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('subtle'),
  },
  unavailableWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 18,
  },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.coral,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    letterSpacing: -0.4,
    color: colors.ink,
    lineHeight: 32,
  },
  subheadline: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.stone,
    lineHeight: 21,
    marginTop: -8,
  },
  subtitle: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.stone,
    textAlign: 'center',
    marginTop: 8,
  },
  featureList: {
    gap: 10,
  },
  retryWrap: {
    marginTop: 20,
    alignItems: 'center',
    gap: 14,
  },
  retryButton: {
    height: 46,
    paddingHorizontal: 26,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation('primaryBtn'),
  },
  retryButtonText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },
  diagSummary: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.stone,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 8,
  },
  diagToggle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.mist,
    textDecorationLine: 'underline',
  },
  diagBlock: {
    fontFamily: 'Courier',
    fontSize: 11,
    lineHeight: 16,
    color: colors.stone,
    backgroundColor: colors.sheetBg,
    borderRadius: radii.sm,
    padding: 12,
    marginTop: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 16,
    color: colors.ink,
  },
  packageList: {
    gap: 10,
    marginTop: 4,
  },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    ...elevation('subtle'),
  },
  packageCardSelected: {
    ...elevation('card'),
    backgroundColor: colors.surface,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.coral,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: colors.coral,
  },
  packageInfo: {
    flex: 1,
    gap: 2,
  },
  packageInfoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    letterSpacing: -0.2,
    color: colors.ink,
  },
  savingsBadge: {
    backgroundColor: colors.coral,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  savingsBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.3,
    color: colors.white,
  },
  packageTrial: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.sage,
  },
  packageSubprice: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.mist,
  },
  packagePrice: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 10,
  },
  ctaButton: {
    height: 56,
    borderRadius: radii.pill,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    ...elevation('primaryBtn'),
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaButtonText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.white,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  finePrint: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 15,
    color: colors.mist,
    textAlign: 'center',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  trustText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.mist,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 9,
  },
  restoreButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.stone,
    textDecorationLine: 'underline',
  },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.mist,
    textDecorationLine: 'underline',
  },
  legalDivider: {
    fontSize: 13,
    color: colors.mist,
  },
});
