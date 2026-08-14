import Mapbox from '@rnmapbox/maps';

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
if (token) {
  Mapbox.setAccessToken(token);
}
Mapbox.setTelemetryEnabled(false);
