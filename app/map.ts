import $ from './util';
import Layers from './layers';
import * as L from 'leaflet';
import DropMarker from './drop-marker';
import Fullscreen from './fullscreen';
import InitialLocation from './initial-location';
import RecommendLayers from './recommend-layers';
import Router from './router';
import Routing from './routing';
import ShowPosition from './show-position';
import Search from './search';
import StateStore, { State } from './state-store';
import Settings from './settings';
import Tracks from './tracks';
import { MapPlugin, MapPluginConstructor } from './map-plugin';

// The default Icon.Default is incompatible with the AssetGraph build
// due to rewritten urls
L.Marker.prototype.options.icon = L.icon({
  iconUrl: '/node_modules/leaflet/dist/images/marker-icon.png'.toString('url'),
  iconRetinaUrl: '/node_modules/leaflet/dist/images/marker-icon-2x.png'.toString(
    'url'
  ),
  shadowUrl: '/node_modules/leaflet/dist/images/marker-shadow.png'.toString(
    'url'
  ),
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

const plugins: MapPluginConstructor[] = [
  InitialLocation,
  RecommendLayers,
  DropMarker,
  ShowPosition,
  Settings,
  Search,
  Tracks,
  Router,
  Routing,
  Fullscreen,
];

const stateEvents = 'moveend zoomend layeradd layerremove';

// Neither geographically nor politically correct ;)
const europeBounds: L.LatLngBoundsLiteral = [
  [35, -15], // sw
  [65, 35], // ne
];

type MapButtonOptions = {
  className: string;
  handler: () => void;
} & L.ControlOptions;

export class MapButton extends L.Control {
  options: MapButtonOptions;

  constructor(options: MapButtonOptions) {
    super(options);
  }

  onAdd() {
    const button = document.createElement('button');
    $.fastClick(button);
    button.className = this.options.className + '-button';
    button.type = 'button';
    button.addEventListener('click', this.options.handler, false);
    return button;
  }
}

export default class Map {
  options: StateStore;
  plugins: MapPlugin[];
  map?: L.Map;
  layers: [string, string?];

  defaults: State = {
    bounds: europeBounds,
    layers: ['mapboxstreets'],
    routingService: 'mapbox',
  };

  constructor() {
    this.options = new StateStore();

    this.validateLayers();

    // initialize plugins sequentially and
    // asynchronously, collect them in this.plugins
    this.plugins = [];
    chain(
      plugins.map(function (this: Map, Plugin): () => Promise<void> | void {
        return function (this: Map): Promise<void> | void {
          const plugin = new Plugin(this, this.options);
          this.plugins.push(plugin);
          if (plugin.beforeMap) {
            return plugin.beforeMap();
          }
        }.bind(this);
      }, this)
    )
      // continue initializing when the last one is done
      .then(this.pluginsInitialized.bind(this));
  }

  private pluginsInitialized(this: Map) {
    // create map
    const map = (this.map! = new L.Map('map', {
      zoomControl: false,
    }));
    map.addControl(L.control.scale({ imperial: false }));
    map.getContainer().focus();

    // tell plugins about the map instance
    this.plugins.forEach(function (plugin) {
      if (plugin.setMap) {
        plugin.setMap(this.map!);
      }
    }, this);

    // add zoom-control for non-pinch-zoom devices
    if (!/(iPhone|iPod|iPad).*AppleWebKit/i.test(navigator.userAgent)) {
      map.addControl(L.control.zoom());
    }

    // set options
    const defaults: State = {};
    Object.keys(this.defaults).forEach(function (this: Map, k: keyof State) {
      if (typeof (this.options as any).get(k) == 'undefined') {
        const newLocal = this.defaults[k];
        (defaults as any)[k] = newLocal;
      }
    }, this);
    this.options.set(defaults);
    this.setState(this.options.get());

    map.on(stateEvents, this.saveState, this);
  }

  private saveState() {
    this.options.set(this.getState());
    this.options.save();
  }

  private setState(state: State) {
    if (state.layers) {
      this.setLayers(state.layers);
    }
    if (state.center && state.zoom !== undefined) {
      this.map!.setView(state.center, state.zoom /*FIXME , true*/);
    } else if (state.bounds) {
      this.map!.fitBounds(state.bounds);
    }
  }

  private getState(): State {
    const state: State = {
      zoom: this.map!.getZoom(),
      center: this.map!.getCenter(),
      layers: this.layers,
    };
    return state;
  }

  setLayers(layers: [string, string?]) {
    const oldLayers = this.layers;
    this.layers = layers;

    if (oldLayers) {
      oldLayers.forEach(function (layer) {
        layer && this.map!.removeLayer(Layers.get(layer));
      }, this);
    }

    layers.forEach(function (layer) {
      layer && this.map!.addLayer(Layers.get(layer));
    }, this);
  }

  addMarker(position: L.LatLngExpression, options?: L.MarkerOptions) {
    return L.marker(position, options).addTo(this.map!);
  }

  removeMarker(marker: L.Layer) {
    this.map!.removeLayer(marker);
  }

  createButton(
    className: string,
    position: L.ControlPosition,
    handler: () => void,
    context?: any
  ) {
    const button = new MapButton({
      className: 'map-button ' + className,
      position: position,
      handler: handler.bind(context || this),
    });
    this.map!.addControl(button);
    L.DomEvent.disableClickPropagation(button.getContainer()!);
    return button;
  }

  private validateLayers() {
    // Remove layers from config if they no longer exist
    let layers = this.options.get('layers');
    if (layers) {
      const validLayers = Layers.keys().map(function (layer) {
        return layer.id;
      });
      layers = <[string, string?]>layers.map(function (this: Map, layer, i) {
        if (!layer || validLayers.indexOf(layer) === -1) {
          return this.defaults.layers![i];
        } else {
          return layer;
        }
      }, this);
      this.options.set('layers', layers);
    }
  }
}

function chain(functions: (() => Promise<void> | void)[]) {
  return functions.reduce(function (prev, fn) {
    return prev.then(fn);
  }, Promise.resolve());
}
