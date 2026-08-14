import { Alert, Linking, Platform } from 'react-native';

/**
 * Prompts the user to open turn-by-turn navigation to a point in either Waze
 * or Google Maps, falling back to each app's web URL when the native app
 * isn't installed (so this always works, even without Waze/Google Maps).
 */
export async function navigateToStart(lat: number, lng: number, label: string) {
  const wazeAppUrl = `waze://?ll=${lat},${lng}&navigate=yes`;
  const wazeWebUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

  const googleMapsAppUrl = Platform.select({
    ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
    android: `google.navigation:q=${lat},${lng}`,
    default: undefined,
  });
  const googleMapsWebUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

  const openWaze = async () => {
    const canOpen = await Linking.canOpenURL(wazeAppUrl).catch(() => false);
    Linking.openURL(canOpen ? wazeAppUrl : wazeWebUrl).catch(() => {
      Alert.alert('Error', 'Could not open Waze.');
    });
  };

  const openGoogleMaps = async () => {
    const canOpen = googleMapsAppUrl ? await Linking.canOpenURL(googleMapsAppUrl).catch(() => false) : false;
    Linking.openURL(canOpen && googleMapsAppUrl ? googleMapsAppUrl : googleMapsWebUrl).catch(() => {
      Alert.alert('Error', 'Could not open Google Maps.');
    });
  };

  Alert.alert(`Navigate to ${label}`, 'Choose an app', [
    { text: 'Waze', onPress: openWaze },
    { text: 'Google Maps', onPress: openGoogleMaps },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
