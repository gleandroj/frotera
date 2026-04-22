"use client";
import { LayersControl, TileLayer } from "react-leaflet";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const ESRI_SAT_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTR = "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community";

const OSM_LABELS_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const TOPO_URL = "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png";
const TOPO_ATTR =
  'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>';

export function MapBaseLayers() {
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="Mapa">
        <TileLayer url={OSM_URL} attribution={OSM_ATTR} maxZoom={19} />
      </LayersControl.BaseLayer>

      <LayersControl.BaseLayer name="Satélite">
        <TileLayer url={ESRI_SAT_URL} attribution={ESRI_ATTR} maxZoom={19} />
      </LayersControl.BaseLayer>

      <LayersControl.BaseLayer name="Híbrido">
        <TileLayer url={ESRI_SAT_URL} attribution={ESRI_ATTR} maxZoom={19} />
      </LayersControl.BaseLayer>

      <LayersControl.BaseLayer name="Topográfico">
        <TileLayer url={TOPO_URL} attribution={TOPO_ATTR} maxZoom={17} />
      </LayersControl.BaseLayer>

      {/* Rótulos OSM sobrepostos — visíveis apenas quando Híbrido está ativo */}
      <LayersControl.Overlay name="Rótulos">
        <TileLayer url={OSM_LABELS_URL} attribution={OSM_ATTR} maxZoom={19} opacity={0.7} />
      </LayersControl.Overlay>
    </LayersControl>
  );
}
