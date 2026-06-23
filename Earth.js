import * as THREE from 'three';
import { EARTH_RADIUS, EARTH_AXIAL_TILT_RAD } from './utils/constants.js';

//I can make changes according to my needs, I don't know what I'm doing with this file, but it works and looks cool so I'm keeping it.
//Most of the math is from the three-globe library
//I did try to understand satellite working and maybe tweak it to my needs
//Yes I wrote all the comments, Yes Im retarded
//Also the atmosphere doesnt work properly, but I dont care...
//I hate this file but its the main earth rendering file.

// Texture URLs 
const TEXTURE_URLS = {
  day:    'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  night:  'https://unpkg.com/three-globe/example/img/earth-night.jpg',
  clouds: 'https://unpkg.com/three-globe/example/img/earth-clouds.png',
  specular: 'https://unpkg.com/three-globe/example/img/earth-water.png',
};

// Day/Night shader 
const EARTH_VERT = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const EARTH_FRAG = /* glsl */`
  uniform sampler2D uDayTex;
  uniform sampler2D uNightTex;
  uniform sampler2D uSpecTex;
  uniform vec3 uSunDir;        // world-space direction toward the sun (normalised)
  uniform float uTime;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  varying vec3 vPosition;

  void main() {
    vec4 dayColor   = texture2D(uDayTex, vUv);
    vec4 nightColor = texture2D(uNightTex, vUv);
    vec4 specColor  = texture2D(uSpecTex, vUv);

    // How much is this surface point lit by the sun?
    float NdotL = dot(vWorldNormal, normalize(uSunDir));

    // Smooth transition: twilight zone spans ±0.15 around the terminator.
    float dayMix = smoothstep(-0.15, 0.15, NdotL);

    // City-lights intensity on the night side
    float nightMix = 1.0 - dayMix;
    vec4 combined =
  mix(
    nightColor * 2.5,
    dayColor,
    dayMix
  );

    // Add specular highlight on water (ocean glint)
    vec3 viewDir = normalize(cameraPosition - vPosition);
    vec3 halfDir = normalize(normalize(uSunDir) + viewDir);
    float spec   = pow(max(dot(vWorldNormal, halfDir), 0.0), 60.0) * specColor.r * dayMix;
    combined.rgb += vec3(spec) * 0.35;

    gl_FragColor = combined;
  }
`;

// Atmosphere shader 
const ATMO_VERT = `
  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    vNormal  = normalize(normalMatrix * normal);
    vec4 pos = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-pos.xyz);
    gl_Position = projectionMatrix * pos;
  }
`;

const ATMO_FRAG = `
  uniform vec3 uSunDir;
  uniform vec3 uAtmoColor;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vViewDir;

  void main() {
    // Fresnel: bright at grazing angles (limb), dark face-on
    float fresnel = 1.0 - abs(dot(vNormal, vViewDir));
fresnel =
    pow(fresnel, 3.0) * 2.5;

    // Slightly brighten the sunlit hemisphere's limb
    // float sun = max(dot(vNormal, normalize(uSunDir)), 0.0);
    gl_FragColor = vec4(uAtmoColor, fresnel * uOpacity);
  }
`;


export class Earth {
  /** @type {THREE.Group} */
  group = null;

  /** @type {THREE.Mesh} */
  #earthMesh = null;

  /** @type {THREE.Mesh} */
  #cloudMesh = null;

  /** @type {THREE.ShaderMaterial} */
  #earthMat = null;

  /** @type {THREE.ShaderMaterial} */
  #atmoMat  = null;

  /** @type {THREE.Vector3} */
  #sunDir = new THREE.Vector3(1, 0, 0);

  /** @type {number} */
  #baseRotation = 0;

  /** @type {number} */
  #baseTime = 0;

  /**
   * @param {THREE.Scene} scene
   * @param {THREE.LoadingManager} [manager]
   * @returns {Promise<void>}
   */
  async build(scene, manager) {
    const loader = new THREE.TextureLoader(manager);

    const [dayTex, nightTex, cloudTex, specTex] = await Promise.all([
      this.#loadTexture(loader, TEXTURE_URLS.day),
      this.#loadTexture(loader, TEXTURE_URLS.night),
      this.#loadTexture(loader, TEXTURE_URLS.clouds),
      this.#loadTexture(loader, TEXTURE_URLS.specular),
    ]);

    //Earth surface
    this.#earthMat = new THREE.ShaderMaterial({
      vertexShader:   EARTH_VERT,
      fragmentShader: EARTH_FRAG,
      uniforms: {
        uDayTex:   { value: dayTex   },
        uNightTex: { value: nightTex },
        uSpecTex:  { value: specTex  },
        uSunDir:   { value: this.#sunDir },
        uTime:     { value: 0 },
      },
    });

    const earthGeo =new THREE.IcosahedronGeometry(EARTH_RADIUS,32);
    this.#earthMesh = new THREE.Mesh(earthGeo, this.#earthMat);
    this.#earthMesh.name = 'earth-surface';

    //Cloud layer 
    const cloudMat = new THREE.MeshPhongMaterial({
      map:         cloudTex,
      transparent: true,
      opacity:     0.38,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
    });
    const cloudGeo  = new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 48, 48);
    this.#cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.#cloudMesh.name = 'earth-clouds';

    // Atmosphere 
    this.#atmoMat = new THREE.ShaderMaterial({
      vertexShader:   ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: {
        uSunDir:    { value: this.#sunDir },
        uAtmoColor: {value: new THREE.Color(0x2f7dff)},
        uOpacity:   { value: 1.0 },
      },
      side:        THREE.BackSide,
      transparent: true,
      depthWrite:  false,
    });
    const atmoGeo =new THREE.IcosahedronGeometry(EARTH_RADIUS * 0.5, 16);
    const atmoMesh = new THREE.Mesh(atmoGeo, this.#atmoMat);
    atmoMesh.name  = 'earth-atmosphere';

    // Assemble group 
    this.group = new THREE.Group();
    this.group.name = 'earth-group';
    this.group.add(this.#earthMesh, this.#cloudMesh, atmoMesh);

    // Apply axial tilt on Z axis
    this.group.rotation.z = EARTH_AXIAL_TILT_RAD;

    scene.add(this.group);

    // Initialise rotation to match current GMST so textures align
    this.#syncRotationToGMST();
  }

  #syncRotationToGMST() {
    const now  = new Date();
    const J2000 = 2451545.0; // Julian date of J2000.0
    const JD    = now.getTime() / 86400000 + 2440587.5;
    const T     = (JD - J2000) / 36525;

    // IAU formula for GMST in degrees at 0h UT1
    const gmst0 = 100.4606184 + 36000.77004 * T + 0.000387933 * T * T;
    // Add daily rotation for current time of day
    const hrs   = (now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600);
    const gmstDeg = (gmst0 + 360.98564724 * (hrs / 24)) % 360;
    const gmstRad = gmstDeg * (Math.PI / 180);

    // Negative because Earth rotation moves east-facing faces toward +X
    this.#baseRotation = -gmstRad;
    this.#baseTime     = Date.now();
    this.#earthMesh.rotation.y = this.#baseRotation;
    this.#cloudMesh.rotation.y = this.#baseRotation;
  }

  /**
   * @param {number} elapsedSeconds )
   * @param {THREE.Vector3} sunDir  
   */
  update(elapsedSeconds, sunDir) {
    if (!this.group) return;

    const SIDEREAL_RATE = (2 * Math.PI) / 86164.1;
    const elapsed = (Date.now() - this.#baseTime) / 1000;
    const rot     = this.#baseRotation - elapsed * SIDEREAL_RATE;

    this.#earthMesh.rotation.y = rot;
    this.#cloudMesh.rotation.y = rot + elapsedSeconds * 0.00003; 

    // Update shader uniforms
    this.#sunDir.copy(sunDir);
    if (this.#earthMat) {
      this.#earthMat.uniforms.uSunDir.value = sunDir;
      this.#earthMat.uniforms.uTime.value   = elapsedSeconds;
    }
    if (this.#atmoMat) {
      this.#atmoMat.uniforms.uSunDir.value = sunDir;
    }
  }

  /**
   * @param {THREE.TextureLoader} loader
   * @param {string} url
   * @returns {Promise<THREE.Texture>}
   */
  #loadTexture(loader, url) {
    return new Promise((resolve) => {
      loader.load(
        url,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          resolve(tex);
        },
        undefined,
        () => {
          console.warn('[Earth] Texture failed to load:', url, '— using fallback');
          // a procedural fallback texture
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 2;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = url.includes('night') ? '#000820' : '#1a4a8a';
          ctx.fillRect(0, 0, 2, 2);
          resolve(new THREE.CanvasTexture(canvas));
        }
      );
    });
  }
}
