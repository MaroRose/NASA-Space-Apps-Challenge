import L from "leaflet";

export const GridCRS = L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(1, 0, 1, 0),
});

export const cellToLatLng = (x: number, y: number): L.LatLngTuple => [y, x];