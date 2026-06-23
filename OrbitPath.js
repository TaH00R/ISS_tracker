import * as THREE from 'three';
import { EARTH_RADIUS, ORBIT_SAMPLES, ORBIT_LOOKAHEAD_MIN } from './utils/constants.js';
import { latLonToThree } from './utils/coordinates.js';

const ORBIT_COLOR        = 0x00c8ff;
const GROUNDTRACK_COLOR  = 0x00ffc8;
const REFRESH_INTERVAL_MS = 90_000; 

const LON_WRAP_THRESHOLD = 120; 

export class OrbitPath {
  /** @type {THREE.Group} */
  group = null;

  #orbitLine   = null;
  #groundGroup = null; 
  #lastRefresh = 0;

  /**
   * @param {THREE.Scene} scene
   */
  build(scene) {
    this.group = new THREE.Group();
    this.group.name = 'orbit-path-group';

    // Orbit line in 3-D space 
    const orbitPositions = new Float32Array((ORBIT_SAMPLES + 1) * 3);
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(orbitPositions, 3));
    orbitGeo.setDrawRange(0, 0);

    const orbitMat = new THREE.LineBasicMaterial({
      color:       ORBIT_COLOR,
      transparent: true,
      opacity:     0.45,
      depthWrite:  false,
    });
    this.#orbitLine = new THREE.Line(orbitGeo, orbitMat);
    this.#orbitLine.name = 'orbit-line';
    this.#orbitLine.frustumCulled = false;
    this.group.add(this.#orbitLine);

    // Ground track sub-group 
    this.#groundGroup = new THREE.Group();
    this.#groundGroup.name = 'ground-track';
    this.group.add(this.#groundGroup);

    scene.add(this.group);
  }

  /**
   * @param {import('./tracker.js').ISSTracker} tracker
   */
  update(tracker) {
    if (!tracker.ready) return;

    const now = Date.now();
    if (now - this.#lastRefresh < REFRESH_INTERVAL_MS) return;
    this.#lastRefresh = now;

    const points = tracker.getOrbitPoints(new Date(), ORBIT_SAMPLES, ORBIT_LOOKAHEAD_MIN);
    if (points.length < 2) return;

    //  Update 3D orbit line 
    const posArr = this.#orbitLine.geometry.attributes.position.array;
    let count = 0;
    for (const pt of points) {
      posArr[count * 3]     = pt.positionThree.x;
      posArr[count * 3 + 1] = pt.positionThree.y;
      posArr[count * 3 + 2] = pt.positionThree.z;
      count++;
    }
    this.#orbitLine.geometry.attributes.position.needsUpdate = true;
    this.#orbitLine.geometry.setDrawRange(0, count);

    // Clear previous children
    while (this.#groundGroup.children.length) {
      const child = this.#groundGroup.children[0];
      child.geometry?.dispose();
      child.material?.dispose();
      this.#groundGroup.remove(child);
    }

    const groundSegments = this.#buildGroundSegments(points);
    groundSegments.forEach(line => this.#groundGroup.add(line));
  }

  /**
   * @param {Array} points
   * @returns {THREE.Line[]}
   */
  #buildGroundSegments(points) {
    const segments = [];
    let current = [];

    const GROUND_ELEVATION = EARTH_RADIUS * 1.003;

    for (let i = 0; i < points.length; i++) {
      const { lat, lon } = points[i];
      const pos = latLonToThree(lat, lon, GROUND_ELEVATION);

      if (i > 0) {
        const prevLon = points[i - 1].lon;
        if (Math.abs(lon - prevLon) > LON_WRAP_THRESHOLD) {
          if (current.length >= 2) segments.push(this.#makeGroundLine(current));
          current = [];
        }
      }

      current.push(pos);
    }

    if (current.length >= 2) segments.push(this.#makeGroundLine(current));

    return segments;
  }

  /**
   * @param {THREE.Vector3[]} positions
   * @returns {THREE.Line}
   */
  #makeGroundLine(positions) {
    const arr = new Float32Array(positions.length * 3);
    positions.forEach((p, i) => {
      arr[i * 3]     = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));

    const mat = new THREE.LineBasicMaterial({
      color:       GROUNDTRACK_COLOR,
      transparent: true,
      opacity:     0.30,
      depthWrite:  false,
      linewidth:   1,
    });

    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    return line;
  }
}
