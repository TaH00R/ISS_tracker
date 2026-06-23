import * as THREE from "three";
import * as satellite from "satellite.js";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import getStarfield from "./src/getStarfield.js";
import { getFresnelMat } from "./src/getFresnelMat.js";
import { getEarthMat } from "./src/getEarthMat.js";
import getLayer from "./src/getLayer.js";

const tle1 =
  "1 25544U 98067A   26173.51877720  .00011937  00000+0  22013-3 0  9994";

const tle2 =
  "2 25544  51.6335 188.5648 0002295  72.6904 287.4348 15.49996014518459";

let satrec = satellite.twoline2satrec(tle1, tle2);
const trailPoints = [];
const MAX_TRAIL_POINTS = 300;


const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.set(0.2, 0, 3);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(w, h);
document.body.appendChild(renderer.domElement);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const loader = new THREE.TextureLoader();

const sunDirection = new THREE.Vector3(-2, 0.5, 1.5);
const EARTH_ROTATION_SPEED = (2 * Math.PI) / 86164;


// add earth
const earthGroup = new THREE.Group();
earthGroup.rotation.z = -23.4 * Math.PI / 180;
scene.add(earthGroup);

// add controls
const ctrls = new OrbitControls(camera, renderer.domElement);
ctrls.enableDamping = true;

const detail = 32;

const geometry = new THREE.IcosahedronGeometry(1, detail);
const material = getEarthMat(sunDirection);
const earthMesh = new THREE.Mesh(geometry, material);
earthGroup.add(earthMesh);


// add satellite
const satelliteGeo = new THREE.SphereGeometry(0.005, 16, 16);
const satelliteMat = new THREE.MeshBasicMaterial({
  color: 0xff4444
});

const satelliteMesh = new THREE.Mesh(
  satelliteGeo,
  satelliteMat
);

scene.add(satelliteMesh);
satelliteMesh.position.set(1.3, 0, 0);


// add atmosphere
const atmosphereMat = getFresnelMat();
const glowMesh = new THREE.Mesh(geometry, atmosphereMat);
glowMesh.scale.setScalar(1.02);
earthGroup.add(glowMesh);



// add twinkle
const stars = getStarfield({ numStars: 2000 });
scene.add(stars);

const sunLight = new THREE.DirectionalLight(0xffffff, 4.0);
sunLight.position.copy(sunDirection);
scene.add(sunLight);
const sunGeo = new THREE.SphereGeometry(1, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.position.copy(sunDirection).multiplyScalar(5);
scene.add(sunMesh);

const nebula = getLayer({ path: './textures/rad-grad.png' });
scene.add(nebula);


//Orbit path
const orbitMaterial =
  new THREE.LineBasicMaterial({
    color: 0x00ffff
  });

const orbitGeometry = new THREE.BufferGeometry();

const orbitLine = new THREE.Line(
  orbitGeometry,
  orbitMaterial
);

scene.add(orbitLine);

//add trail
const trailGeometry =
  new THREE.BufferGeometry();

const trailMaterial =
  new THREE.LineBasicMaterial({
    color: 0x00ff00
  });

const trailLine =
  new THREE.Line(
    trailGeometry,
    trailMaterial
  );

scene.add(trailLine);
camera.lookAt(satelliteMesh.position);

let prevTime = 0;
let lastOrbitUpdate = 0;

function animate(t = 0) {
  requestAnimationFrame(animate);
  const dt = (t - prevTime) / 1000;
  prevTime = t;
  // earthMesh.rotation.y += EARTH_ROTATION_SPEED * dt;
  // glowMesh.rotation.y += EARTH_ROTATION_SPEED * dt;

  earthGroup.rotation.z = -23.4 * Math.PI / 180;

  if (t - lastOrbitUpdate > 60000) {
    buildOrbitPath();
    lastOrbitUpdate = t;
  }

  const now = new Date();

  const pv = satellite.propagate(
    satrec,
    now
  );

  if (pv.position) {

    const gmst =
      satellite.gstime(now);

    const geodetic =
      satellite.eciToGeodetic(
        pv.position,
        gmst
      );

    const lat =
      satellite.degreesLat(
        geodetic.latitude
      );

    const lon =
      satellite.degreesLong(
        geodetic.longitude
      );

    const alt =
      geodetic.height;

    const earthRadiusKm = 6371;

    const radius =
      1 + (alt / earthRadiusKm);

    const pos = eciToXYZ(
  pv.position
);

satelliteMesh.position.copy(pos);

    satelliteMesh.position.copy(pos);
    trailPoints.push(pos.clone());

    if (trailPoints.length > MAX_TRAIL_POINTS) {
      trailPoints.shift();
    }

    trailGeometry.setFromPoints(trailPoints);
  }
  renderer.render(scene, camera);
  ctrls.update();
}

await fetchISSTLE();
buildOrbitPath();
animate();

function handleWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function latLonToXYZ(lat, lon, radius) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return new THREE.Vector3(x, y, z);
}

function buildOrbitPath() {

  const points = [];
  const now = new Date();

  for (let i = -190; i <= 190; i++) {

    const futureTime = new Date(
      now.getTime() + i * 15 * 1000
    );

    const pv = satellite.propagate(
      satrec,
      futureTime
    );

    if (!pv.position) continue;

    const gmst =
      satellite.gstime(futureTime);

    points.push(
  eciToXYZ(pv.position)
);
  }

  orbitGeometry.setFromPoints(points);
}

function eciToXYZ(positionEci) {
  const scale = 6371;

  return new THREE.Vector3(
    positionEci.x / scale,
    positionEci.y / scale,
    positionEci.z / scale
  );
}

async function fetchISSTLE() {
  try {
    const response = await fetch(
      "https://celestrak.org/NORAD/elements/stations.txt"
    );

    const text = await response.text();

    const lines = text
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean);

    const issIndex = lines.findIndex(
      line => line.includes("ISS")
    );

    if (issIndex === -1) {
      console.error("ISS not found");
      return;
    }

    const tle1 = lines[issIndex + 1];
    const tle2 = lines[issIndex + 2];

    satrec = satellite.twoline2satrec(
      tle1,
      tle2
    );

    console.log("Updated ISS TLE");
    console.log(tle1);
    console.log(tle2);

  } catch (err) {
    console.error(err);
  }
}


window.addEventListener('resize', handleWindowResize, false);