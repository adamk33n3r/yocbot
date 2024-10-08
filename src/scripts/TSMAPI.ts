import got from 'got';

import logger from '../Logger';
import { tsmapi } from '../local.config.json';

interface OAuth2Response {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

interface TSMArrayResponse<T> {
    metadata: {
        totalItems: number;
    };
    items: T[];
}

interface TSMAuctionHouseData {
    auctionHouseId: number;
    type: 'Alliance' | 'Horde';
    lastModified: number;
}

interface TSMRealmData {
    realmId: number;
    name: string;
    localizedName: string;
    locale: string;
    auctionHouses: TSMAuctionHouseData[];
}

interface TSMRegionData {
    regionId: number;
    name: string;
    gmtOffset: number;
    gameVersion: string;
    lastModified: number;
    realms: TSMRealmData[];
}

interface TSMItemData {
    auctionHouseId: number;
    itemId: number;
    petSpeciesId: number | null;
    minBuyout: number;
    quantity: number;
    marketValue: number;
    historical: number;
    numAuctions: number;
}

interface TSMRegionItemData extends TSMItemData {
    avgSalePrice: number;
    salePct: number; // 0-100
    soldPerDay: number;
}

async function doit(): Promise<OAuth2Response> {
    const url = 'https://auth.tradeskillmaster.com/oauth2/token';
    return got.post(url, {
        json: {
            client_id: 'c260f00d-1071-409a-992f-dda2e5498536',
            grant_type: 'api_token',
            scope: 'app:realm-api app:pricing-api',
            token: tsmapi.apikey,
        },
    }).json();
}

async function getRequest<T = unknown>(endpoint: string, token: string): Promise<T> {
    return got.get(endpoint, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).json();
}

interface Coins {
    gold: number;
    silver: number;
    copper: number;
}

function splitCoins(coins: number): Coins {
    const gold = Math.floor(coins / 10000);
    coins %= 10000;
    const silver = Math.floor(coins / 100);
    const copper = coins % 100;
    return {
        gold,
        silver,
        copper,
    };
}

function formatCoins(coins: number): string {
    const coinObj = splitCoins(coins);
    return `${coinObj.gold}g ${coinObj.silver}s ${coinObj.copper}c`;
}

logger.info(formatCoins(12343237548219));

doit().then(async (res) => {
    const at = res.access_token;
    logger.info(res);
    // const realm = await getRequest(`https://realm-api.tradeskillmaster.com/realms/${tsmapi.realm}`, at) as TSMRealmData;
    // logger.info(realm.auctionHouses);
    const itemid = 43396;
    const item = await getRequest<TSMItemData>(`https://pricing-api.tradeskillmaster.com/ah/${tsmapi.auctionHouse}/item/${itemid}`, at);
    logger.info(item);
    // const regionItemData = await getRequest<TSMItemData>(`https://pricing-api.tradeskillmaster.com/region/${tsmapi.region}/item/${itemid}`, at);
    // logger.info(regionItemData);
    logger.info(`${item.itemId}: ${formatCoins(item.marketValue)}`);
});
