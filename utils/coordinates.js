import * as satellite from 'satellite.js';
import * as THREE from 'three';
import { EARTH_RADIUS_KM } from './constants.js';

/**
 * @param {{ x: number, y: number, z: number }} positionEcf  
 * @returns {THREE.Vector3} 
 */
export function ecefToThree({ x, y, z }) {
  return new THREE.Vector3(
    x / EARTH_RADIUS_KM,   
    z / EARTH_RADIUS_KM,   
   -y / EARTH_RADIUS_KM    
  );
}

/**
 * @param {Object} satrec   
 * @param {Date}   date
 * @returns {Object|null}
 */
export function propagateISS(satrec, date) {
  const posVel = satellite.propagate(satrec, date);
  if (!posVel || !posVel.position || posVel.position === false) return null;

  const positionEci  = posVel.position;  // { x, y, z } km
  const velocityEci  = posVel.velocity;  // { x, y, z } km/s

  const gmst = satellite.gstime(date);

  const positionEcf = satellite.eciToEcf(positionEci, gmst);

  const geodetic = satellite.eciToGeodetic(positionEci, gmst);

  // 5. Convert to degrees
  const lat = satellite.degreesLat(geodetic.latitude);
  const lon = satellite.degreesLong(geodetic.longitude);
  const alt = geodetic.height; // km

  // 6. Velocity magnitude (km/s)
  const velocity = Math.sqrt(
    velocityEci.x ** 2 +
    velocityEci.y ** 2 +
    velocityEci.z ** 2
  );

  // 7. ECEF to Three.js coordinate system
  const positionThree = ecefToThree(positionEcf);

  return {
    positionThree,
    positionEcf,
    positionEci,
    lat,
    lon,
    alt,
    velocity,
    gmst,
  };
}

/**
 * @param {number} latDeg  degrees
 * @param {number} lonDeg  degrees
 * @param {number} [radiusScale=1]  
 * @returns {THREE.Vector3}
 */
export function latLonToThree(latDeg, lonDeg, radiusScale = 1) {
  const lat = latDeg * (Math.PI / 180);
  const lon = lonDeg * (Math.PI / 180);

  // Standard spherical to Cartesian
  return new THREE.Vector3(
    Math.cos(lat) * Math.cos(lon),   // → Three X
    Math.sin(lat),                    // → Three Y 
   -Math.cos(lat) * Math.sin(lon)    // → Three Z 
  ).multiplyScalar(radiusScale);
}
