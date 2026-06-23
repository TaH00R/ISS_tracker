export const EARTH_RADIUS = 1.0;              
export const EARTH_RADIUS_KM = 6371.0;           
export const SCENE_UNITS_PER_KM = EARTH_RADIUS / EARTH_RADIUS_KM;

export const EARTH_AXIAL_TILT_DEG = 23.4;         
export const EARTH_AXIAL_TILT_RAD = EARTH_AXIAL_TILT_DEG * (Math.PI / 180);

// ISS nominal orbital parameters
export const ISS_MEAN_ALTITUDE_KM = 420;          
export const ISS_ORBIT_PERIOD_MIN = 92.68;        
export const ISS_INCLINATION_DEG  = 51.6;

// Orbit path sampling
export const ORBIT_SAMPLES        = 180;           
export const GROUNDTRACK_SAMPLES  = 180;           
export const ORBIT_LOOKAHEAD_MIN  = ISS_ORBIT_PERIOD_MIN;

// Sun distance 
export const SUN_DISTANCE         = 80;            
export const SUN_INTENSITY        = 2.2;

// TLE cache lifetime
export const TLE_CACHE_MS         = 60 * 60 * 1000; 

// Atmosphere
export const ATMOSPHERE_RADIUS    = EARTH_RADIUS * 1.025;

// Camera defaults
export const CAMERA_INITIAL_DISTANCE = 3.2;
export const CAMERA_FOLLOW_DISTANCE  = 0.18;      
