import * as THREE from 'three';
import { EARTH_RADIUS, SCENE_UNITS_PER_KM } from './utils/constants.js';
import { latLonToThree } from './utils/coordinates.js';

const TRAIL_LENGTH    = 120;   
const MARKER_SIZE     = 0.018; 
const GROUND_RADIUS   = 0.008; 
const NADIR_COLOR     = 0x00ffcc;
const TRAIL_COLOR     = 0x00c8ff;
const GROUND_COLOR    = 0xff6b35;

export class ISS {
  /** @type {THREE.Group} */
  group = null;

  /** @type {{ lat, lon, alt, velocity, positionThree, timestamp } | null} */
  telemetry = null;

  #marker   = null;  // mesh
  #halo     = null;  // sprite
  #trailGeo = null;  // BufferGeometry
  #trailPositions = [];  // circular buffer
  #groundDot = null;
  #nadirLine = null;
  #nadirPositions = null;

  /**
   * @param {THREE.Scene} scene
   */
  build(scene) {
    this.group = new THREE.Group();
    this.group.name = 'iss-group';

    // Marker 
    const markerGeo = new THREE.OctahedronGeometry(MARKER_SIZE, 0);
    const markerMat = new THREE.MeshStandardMaterial({
      color:     0xffffff,
      emissive:  new THREE.Color(0x00c8ff),
      emissiveIntensity: 3.0,
      metalness: 0.3,
      roughness: 0.4,
    });
    this.#marker = new THREE.Mesh(markerGeo, markerMat);
    this.#marker.name = 'iss-marker';
    this.group.add(this.#marker);

    //  Point-light glow at ISS position 
    const pointLight = new THREE.PointLight(0x00c8ff, 0.4, 0.5);
    this.#marker.add(pointLight);

    // Orbit trail 
    const trailPositionsArray = new Float32Array(TRAIL_LENGTH * 3);
    this.#trailGeo = new THREE.BufferGeometry();
    this.#trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositionsArray, 3));
    this.#trailGeo.setDrawRange(0, 0);

    const trailMat = new THREE.LineBasicMaterial({
      color:       TRAIL_COLOR,
      transparent: true,
      opacity:     0.55,
      linewidth:   1,
      depthWrite:  false,
    });
    const trail = new THREE.Line(this.#trailGeo, trailMat);
    trail.name = 'iss-trail';
    trail.frustumCulled = false;
    this.group.add(trail);

    // Sub-satellite ground dot 
    const dotGeo = new THREE.SphereGeometry(GROUND_RADIUS, 12, 12);
    const dotMat = new THREE.MeshStandardMaterial({
      color:    GROUND_COLOR,
      emissive: new THREE.Color(GROUND_COLOR),
      emissiveIntensity: 2,
      roughness: 0.4,
    });
    this.#groundDot = new THREE.Mesh(dotGeo, dotMat);
    this.#groundDot.name = 'iss-ground-dot';
    this.group.add(this.#groundDot);

    // Nadir line
    const nadirArr = new Float32Array(6);
    this.#nadirPositions = nadirArr;
    const nadirGeo = new THREE.BufferGeometry();
    nadirGeo.setAttribute('position', new THREE.BufferAttribute(nadirArr, 3));

    const nadirMat = new THREE.LineBasicMaterial({
      color:       NADIR_COLOR,
      transparent: true,
      opacity:     0.25,
      depthWrite:  false,
    });
    this.#nadirLine = new THREE.Line(nadirGeo, nadirMat);
    this.#nadirLine.name = 'iss-nadir';
    this.#nadirLine.frustumCulled = false;
    this.group.add(this.#nadirLine);

    scene.add(this.group);
  }

  /**
   * @param {import('./tracker.js').ISSTracker} tracker
   * @returns {boolean}
   */
  update(tracker) {
    if (!tracker.ready) return false;

    const result = tracker.getPosition(new Date());
    if (!result) return false;

    const { positionThree, lat, lon, alt, velocity } = result;

    // Move marker 
    this.#marker.position.copy(positionThree);
    this.#marker.rotation.y += 0.01; // slow rotation 

    // Update trail buffer 
    this.#trailPositions.push(positionThree.clone());
    if (this.#trailPositions.length > TRAIL_LENGTH) {
      this.#trailPositions.shift();
    }

    const posArr = this.#trailGeo.attributes.position.array;
    for (let i = 0; i < this.#trailPositions.length; i++) {
      const p = this.#trailPositions[i];
      posArr[i * 3]     = p.x;
      posArr[i * 3 + 1] = p.y;
      posArr[i * 3 + 2] = p.z;
    }
    this.#trailGeo.attributes.position.needsUpdate = true;
    this.#trailGeo.setDrawRange(0, this.#trailPositions.length);

    // Sub-satellite point 
    const groundPos = latLonToThree(lat, lon, EARTH_RADIUS * 1.002);
    this.#groundDot.position.copy(groundPos);

    //  Nadir line 
    const na = this.#nadirPositions;
    na[0] = positionThree.x;  na[1] = positionThree.y;  na[2] = positionThree.z;
    na[3] = groundPos.x;      na[4] = groundPos.y;      na[5] = groundPos.z;
    this.#nadirLine.geometry.attributes.position.needsUpdate = true;

    // Telemetry snapshot 
    this.telemetry = {
      lat, lon, alt, velocity,
      positionThree: positionThree.clone(),
      timestamp: new Date(),
    };

    return true;
  }

  get markerObject() { return this.#marker; }
}
