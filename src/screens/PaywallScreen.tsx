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

// MECLABS-style motivation copy: name the exact wall the user just hit, not
// a generic upsell — the reader should recognize their own situation.
const TRIGGER_HEADLINE: Record<NonNullable<Props['trigger']>, string> = {
  route_limit: "You've hit the 5-route limit",
  gpx_import: 'GPX import is a Pro feature',
  route_customize: "Customizing someone else's route is a Pro feature",
  group_run_limit: "You're already hosting a run",
  group_run_join_limit: "You've joined your one free event",
  leg_distance: 'This leg is longer than the free limit',
  flyby_video: 'Flyby videos are a Pro feature',
  direct: 'Get more out of every run',
};

const TRIGGER_SUBHEAD: Record<NonNullable<Props['trigger']>, string> = {
  route_limit: 'Go Pro to save unlimited routes and keep building your collection.',
  gpx_import: 'Go Pro to bring routes in from Strava, Garmin, and anywhere else.',
  route_customize: 'Go Pro to remix any public route into your own.',
  group_run_limit: 'Go Pro to host as many group runs as you want, at once.',
  group_run_join_limit: 'Go Pro to join unlimited events, any time.',
  leg_distance: 'Go Pro for legs up to 50km — plan bigger routes.',
  flyby_video: 'Go Pro to create cinematic flyby videos of your routes.',
  direct: 'Unlock unlimited routes, unlimited group runs, and room to plan bigger.',
};

const DEFAULT_HEADLINE = 'Get more out of every run';
const DEFAULT_SUBHEAD = 'Unlock unlimited routes, unlimited group runs, and room to plan bigger.';

const PRO_BENEFITS = [
  'Unlimited saved routes — never hit a cap',
  'Import GPX files from Strava, Garmin, and more',
  'Host unlimited group runs at once',
  'Plan longer routes — up to 50km per leg',
  'Customize and remix any public route',
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

function savingsBadge(pkg: PurchasesPackage, packages: PurchasesPackage[]): string | null {
  const monthly = packages.find((p) => p.packageType === 'MONTHLY');
  if (!monthly || pkg.identifier === monthly.identifier) return null;
  const baseline = monthly.product.pricePerMonth;
  const thisPerMonth = pkg.product.pricePerMonth;
  if (!baseline || !thisPerMonth || baseline <= 0) return null;
  const pct = Math.round((1 - thisPerMonth / baseline) * 100);
  return pct > 0 ? `SAVE ${pct}%` : null;
}

function parseIsoPeriodValue(period: string): number {
  const match = period.match(/P(\d+)[DWMY]/);
  return match ? parseInt(match[1], 10) : 1;
}

const UNIT_WORDS: Record<string, string> = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' };

function trialLabel(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const n = parseIsoPeriodValue(intro.period) * Math.max(intro.cycles, 1);
  const unitWord = UNIT_WORDS[intro.periodUnit] ?? 'day';
  return `${n}-${unitWord}${n === 1 ? '' : 's'} free trial`;
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
        // Empty offering keeps getting us rejected in App Review — when it
        // happens, pull a full diagnostic so the failure state says *why*.
        if (!o || o.availablePackages.length === 0) {
          getPaywallDiagnostics().then(setDiagnostics).catch(() => {});
        }
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

  const selectedTrial = selectedPackage ? trialLabel(selectedPackage) : null;
  const ctaLabel = !selectedPackage
    ? 'CONTINUE'
    : selectedTrial
      ? `START ${selectedTrial.toUpperCase()}`
      : `CONTINUE — ${selectedPackage.product.priceString}`;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
          <CloseIcon size={16} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.eyebrow}>ROOTAH PRO</Text>
        <Text style={styles.title}>{trigger ? TRIGGER_HEADLINE[trigger] : DEFAULT_HEADLINE}</Text>
        <Text style={styles.subheadline}>{trigger ? TRIGGER_SUBHEAD[trigger] : DEFAULT_SUBHEAD}</Text>

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
              const badge = savingsBadge(pkg, packages);
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
                      {badge && (
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsBadgeText}>{badge}</Text>
                        </View>
                      )}
                    </View>
                    {trial ? (
                      <Text style={styles.packageTrial}>{trial}, then {pkg.product.priceString}</Text>
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

        <View style={styles.trustRow}>
          <LockIcon size={12} color={colors.mist} />
          <Text style={styles.trustText}>Secure payment · Cancel anytime</Text>
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
    backgroundColor: colors.amber,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savingsBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
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
