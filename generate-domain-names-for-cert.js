const hosts = [
    {
        base: 'nas.adamk33n3r.com',
        root: 'adamk33n3r.com',
        subdomains: [
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
        ],
    },
    {
        base: 'thekeenan.family',
        root: 'thekeenan.family',
        subdomains: [
            'home',
            'photos',
        ],
    },
];

for (const host of hosts) {
    console.log(host.base);
    console.log(host.subdomains.map(sub => `${sub}.${host.root}`).join(';'));
    console.log();
}

