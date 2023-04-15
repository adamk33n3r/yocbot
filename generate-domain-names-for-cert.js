const base = 'nas.adamk33n3r.com';
const root = 'adamk33n3r.com';
const subdomains = [
    'LD50',
    'bazarr',
    'ha',
    'lidarr',
    'portainer',
    'prowlarr',
    'radarr',
    'request', // ombi
    'sabnzbd',
    'sonarr',
    'tautulli',
    'tdarr',
    'photos',
];

console.log(base);
console.log(subdomains.map(sub => `${sub}.${root}`).join(';'));
