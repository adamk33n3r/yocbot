import { Innertube, UniversalCache } from 'youtubei.js';

(async () => {
    const yt = await Innertube.create({
        cache: new UniversalCache(false),
    });

    yt.session.on('auth-pending', (data) => {
        console.log(`Go to ${data.verification_url} in your browser and enter code ${data.user_code} to authenticate.`);
    });

    yt.session.on('auth', ({ credentials }) => {
        console.log('Sign in successful:', credentials);
    });

    yt.session.on('update-credentials', async ({ credentials }) => {
        console.log('Credentials updated:', credentials);
        await yt.session.oauth.cacheCredentials();
    });

    await yt.session.signIn();

    await yt.session.oauth.cacheCredentials();
})();
