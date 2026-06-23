
import * as satellite from 'satellite.js';
import { fetchTLE, scheduleTLERefresh } from './utils/tle.js';
import { propagateISS } from './utils/coordinates.js';
import { ISS_ORBIT_PERIOD_MIN, ORBIT_SAMPLES } from './utils/constants.js';

export class ISSTracker {
  /** @type {{ name: string, line1: string, line2: string }} */
  #tle = null;

  /** @type {Object} */
  #satrec = null;

  /** @type {boolean} */
  #ready = false;

  /** @type {() => void}   */
  #cancelRefresh = null;

  /**
   * @param {{ onStatus?: (msg:string)=>void }} [opts]
   */
  async init(opts = {}) {
    const status = opts.onStatus ?? (() => {});

    const tle = await fetchTLE({ onStatus: status });
    this.#setTLE(tle);

    // Schedule hourly refresh
    this.#cancelRefresh = scheduleTLERefresh((freshTLE) => {
      this.#setTLE(freshTLE);
      console.log('[Tracker] TLE refreshed at', new Date().toISOString());
    });

    return tle;
  }

  #setTLE(tle) {
    this.#tle = tle;
    this.#satrec = satellite.twoline2satrec(tle.line1, tle.line2);
    this.#ready = true;
  }

  get ready()  { return this.#ready; }
  get tleName() { return this.#tle?.name ?? 'ISS (ZARYA)'; }
  get tleLine1() { return this.#tle?.line1 ?? ''; }
  get tleLine2() { return this.#tle?.line2 ?? ''; }

  /**
   *
   * @param {Date} [date]
   * @returns {{
   *   positionThree: THREE.Vector3,
   *   positionEcf: {x,y,z},
   *   positionEci: {x,y,z},
   *   lat: number,     // degrees
   *   lon: number,     // degrees
   *   alt: number,     // km
   *   velocity: number // km/s
   * } | null}
   */
  getPosition(date = new Date()) {
    if (!this.#ready) return null;
    return propagateISS(this.#satrec, date);
  }

  /**
   * @param {Date}   [startDate]
   * @param {number} [samples]
   * @param {number} [periodMinutes]  defaults to ISS_ORBIT_PERIOD_MIN
   * @returns {Array<object>}
   */
  getOrbitPoints(startDate = new Date(), samples = ORBIT_SAMPLES, periodMinutes = ISS_ORBIT_PERIOD_MIN) {
    if (!this.#ready) return [];

    const stepMs = (periodMinutes * 60 * 1000) / samples;
    const points = [];

    for (let i = 0; i <= samples; i++) {
      const t   = new Date(startDate.getTime() + i * stepMs);
      const pos = propagateISS(this.#satrec, t);
      if (pos) points.push(pos);
    }

    return points;
  }

  dispose() {
    this.#cancelRefresh?.();
  }
}
