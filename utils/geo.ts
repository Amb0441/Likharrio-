import * as Location from "expo-location";
import { withTimeout } from "./withTimeout";

export interface LatLng {
  latitude: number;
  longitude: number;
}

const GEOLOCATION_TIMEOUT_MS = 6000;

export const DEFAULT_CENTER: LatLng = { latitude: 16.4023, longitude: 120.596 };

/**
 * Returns the user's position as fast as possible.
 * - Uses the last known cached position instantly when available.
 * - Otherwise requests a fresh fix, bailing out after a timeout so the map
 *   is never blocked behind a slow GPS lock.
 * Returns null when permission is denied or no fix is available.
 */
export async function getQuickPosition(): Promise<LatLng | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 60000,
      requiredAccuracy: 300,
    });
    if (lastKnown) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }

    const pos = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      GEOLOCATION_TIMEOUT_MS,
    );
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

/**
 * Interactive Leaflet picker used in the map modals.
 * Exposes window.locate(centerLat, centerLng, userLat?, userLng?) so the
 * React side can recenter / show the user dot without reloading the WebView.
 */
export function buildPickerMapHtml(
  lat: number,
  lng: number,
  hasPin: boolean,
  userLat?: number | null,
  userLng?: number | null,
) {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  html,body,#map{width:100%;height:100%;margin:0;padding:0;}
  #loader{position:fixed;top:0;left:0;right:0;bottom:0;background:#FAF7F2;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;color:#9B8265;gap:12px;}
  .spinner{width:36px;height:36px;border:4px solid #EDE0D4;border-top:4px solid #8B1A1A;border-radius:50%;animation:spin 0.8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}
</style>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" onload="checkReady('css')" onerror="checkReady('css')"/>
</head>
<body>
<div id="loader"><div class="spinner"></div><span>Loading map...</span></div>
<div id="map"></div>
<script>
  var cssReady=false,jsReady=false,userMarker=null,marker=null;
  function checkReady(type){if(type==='css')cssReady=true;if(type==='js')jsReady=true;if(cssReady&&jsReady)initMap();}
  function initMap(){
    document.getElementById('loader').style.display='none';
    var map=L.map('map',{attributionControl:false}).setView([${lat},${lng}],15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    marker=${hasPin}?L.marker([${lat},${lng}]).addTo(map):null;
    map.on('click',function(e){
      var ll=e.latlng;
      if(marker){marker.setLatLng(ll);}else{marker=L.marker(ll).addTo(map);}
      window.ReactNativeWebView.postMessage(JSON.stringify({lat:ll.lat,lng:ll.lng}));
    });
    window.locate=function(centerLat,centerLng,userCenterLat,userCenterLng){
      if(userCenterLat!=null&&userCenterLng!=null){
        if(!userMarker){
          var userIcon=L.divIcon({className:'',html:'<div style="width:16px;height:16px;border-radius:50%;background:#4285F4;border:3px solid #fff;box-shadow:0 0 0 3px rgba(66,133,244,0.35);"></div>',iconSize:[16,16],iconAnchor:[8,8]});
          userMarker=L.marker([userCenterLat,userCenterLng],{icon:userIcon,interactive:false,zIndexOffset:-100}).addTo(map);
        }else{
          userMarker.setLatLng([userCenterLat,userCenterLng]);
        }
      }
      map.setView([centerLat,centerLng],15);
    };
  }
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onload="checkReady('js')" onerror="checkReady('js')"></script>
</body></html>`;
}

/**
 * Non-interactive Leaflet map used for previews.
 * A popup is bound only when a label is provided.
 */
export function buildStaticMapHtml(lat: number, lng: number, label?: string) {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>html,body,#map{width:100%;height:100%;margin:0;padding:0;}#loader{position:fixed;top:0;left:0;right:0;bottom:0;background:#FAF7F2;display:flex;align-items:center;justify-content:center;z-index:9999;font-family:sans-serif;color:#9B8265;font-size:12px;}</style>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" onload="checkReady('css')" onerror="checkReady('css')"/>
</head>
<body>
<div id="loader">Loading map...</div>
<div id="map"></div>
<script>
  var cssReady=false,jsReady=false;
  function checkReady(type){if(type==='css')cssReady=true;if(type==='js')jsReady=true;if(cssReady&&jsReady)initMap();}
  function initMap(){
    document.getElementById('loader').style.display='none';
    var map=L.map('map',{zoomControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,touchZoom:false,attributionControl:false}).setView([${lat},${lng}],15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
    var m=L.marker([${lat},${lng}]).addTo(map);
    ${label ? `m.bindPopup(${JSON.stringify(label)}).openPopup();` : ""}
  }
</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onload="checkReady('js')" onerror="checkReady('js')"></script>
</body></html>`;
}
