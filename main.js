import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Earth }     from './Earth.js';
import { ISS }       from './ISS.js';
import { OrbitPath } from './OrbitPath.js';
import { ISSTracker } from './tracker.js';
import {
  CAMERA_INITIAL_DISTANCE,
  CAMERA_FOLLOW_DISTANCE,
  SUN_DISTANCE, SUN_INTENSITY,
} from './utils/constants.js';

// DOM refs 
const container   = document.getElementById('canvas-container');
const tLat        = document.getElementById('t-lat');
const tLon        = document.getElementById('t-lon');
const tAlt        = document.getElementById('t-alt');
const tVel        = document.getElementById('t-vel');
const tsEl        = document.getElementById('ts');
const tleStatus   = document.getElementById('tle-status');
const btnFree     = document.getElementById('btn-free');

//  Scene 
const scene    = new THREE.Scene();
const clock    = new THREE.Clock();

// Camera
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.001, 500);
camera.position.set(0, 0, CAMERA_INITIAL_DISTANCE);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.outputColorSpace  = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping    = true;
controls.dampingFactor    = 0.06;
controls.minDistance      = 1.15;
controls.maxDistance      = 20;
controls.enablePan        = false;

// Lighting 
const ambient = new THREE.AmbientLight(0x111122, 0.15);
scene.add(ambient);

// Directional sunlight
const sunLight = new THREE.DirectionalLight(0xfff8e8, SUN_INTENSITY);
const sunDir   = new THREE.Vector3(1, 0.3, 0.0).normalize();
sunLight.position.copy(sunDir.clone().multiplyScalar(SUN_DISTANCE));
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far  = 200;
sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -3;
sunLight.shadow.camera.right = sunLight.shadow.camera.top = 3;
scene.add(sunLight);

// Sun object 
function buildSun() {
  const geo = new THREE.SphereGeometry(2.8, 24, 24);
  const mat = new THREE.MeshBasicMaterial({ color: 0xfffde0 });
  const sun = new THREE.Mesh(geo, mat);
  sun.position.copy(sunDir.clone().multiplyScalar(SUN_DISTANCE));
  sun.name = 'sun';

  // Glow halo
  const glowGeo = new THREE.SphereGeometry(4.5, 24, 24);
  const glowMat = new THREE.MeshBasicMaterial({
    color:       0xffee88,
    transparent: true,
    opacity:     0.18,
    side:        THREE.BackSide,
    depthWrite:  false,
  });
  sun.add(new THREE.Mesh(glowGeo, glowMat));
  scene.add(sun);
}
buildSun();

// Starfield
function buildStarfield() {
  const STAR_COUNT = 6000;
  const positions  = new Float32Array(STAR_COUNT * 3);
  const sizes      = new Float32Array(STAR_COUNT);
  const colors     = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 180 + Math.random() * 40;

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    sizes[i] = 0.5 + Math.random() * 1.5;

    // Star colour temperature variation (blue-white-yellow)
    const t = Math.random();
    colors[i * 3]     = 0.85 + t * 0.15;
    colors[i * 3 + 1] = 0.88 + t * 0.12;
    colors[i * 3 + 2] = 1.0 - t * 0.3;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size:          0.25,
    sizeAttenuation: true,
    vertexColors:  true,
    transparent:   true,
    opacity:       0.85,
    depthWrite:    false,
  });

  scene.add(new THREE.Points(geo, mat));
}
buildStarfield();

// Module instances
const earth     = new Earth();
const iss       = new ISS();
const orbitPath = new OrbitPath();
const tracker   = new ISSTracker();



//  Initialize
async function init() {

  iss.build(scene);

  orbitPath.build(scene);

  await earth.build(scene);

  const tle = await tracker.init();

  updateTLEStatus(tle);

  orbitPath.update(tracker);

  animate();
}

// Animation loop 
const _issWorldPos = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);

  const elapsed = clock.getElapsedTime();
  const delta   = clock.getDelta ? undefined : 0; 

  earth.update(elapsed, sunDir);

  iss.update(tracker);

  orbitPath.update(tracker);

  controls.update();
  renderer.render(scene, camera);

  if (Math.floor(elapsed * 10) !== Math.floor((elapsed - 0.016) * 10)) {
    updateTelemetryUI();
  }
}



function updateTelemetryUI() {
  const t = iss.telemetry;
  if (!t) return;

  tLat.textContent = `${t.lat >= 0 ? '+' : ''}${t.lat.toFixed(4)}°`;
  tLon.textContent = `${t.lon >= 0 ? '+' : ''}${t.lon.toFixed(4)}°`;
  tAlt.textContent = `${t.alt.toFixed(1)} km`;
  tVel.textContent = `${(t.velocity).toFixed(3)} km/s`;
  tsEl.textContent = t.timestamp.toUTCString().replace('GMT', 'UTC');
}

function updateTLEStatus(tle) {
  if (!tleStatus) return;
  if (tle.fromFallback) {
    tleStatus.textContent = '⚠ offline — using bundled TLE';
    tleStatus.className   = 'stale';
  } else if (tle.fromCache) {
    tleStatus.textContent = '✓ cached TLE';
    tleStatus.className   = 'live';
  } else {
    tleStatus.textContent = '✓ live TLE from Celestrak';
    tleStatus.className   = 'live';
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init().catch(err => {
  console.error('[ISS Tracker] Fatal init error:', err);
  setLoadingMsg(`Error: ${err.message}`);
});
