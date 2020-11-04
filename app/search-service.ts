import * as L from 'leaflet';
import { AbortablePromise, get } from './xhr';

const baseUrl = '//nominatim.openstreetmap.org/search';

export interface SearchResult {
  boundingbox: [number, number, number, number];
  lon: number;
  lat: number;
  // eslint-disable-next-line camelcase
  display_name: string;
}

export function search(
  query: string,
  options: { bounds: L.LatLngBounds }
): AbortablePromise<SearchResult[]> {
  const params = {
    addressdetails: '1',
    format: 'json',
    limit: '15',
    viewboxlbrt: options.bounds.toBBoxString(),
    q: query,
  };
  const url = baseUrl + '?' + encodeParams(params);
  return get(url);
}

function encodeParams(params: { [key: string]: string }) {
  return Object.keys(params)
    .reduce(function (entries, key) {
      entries.push(key + '=' + encodeURIComponent(params[key]));
      return entries;
    }, [])
    .join('&');
}
