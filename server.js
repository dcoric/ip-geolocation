const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

function getClientIp(req) {
    return req.headers['cf-connecting-ip'] ||
           req.headers['x-forwarded-for']?.split(',')[0] ||
           req.headers['x-real-ip'] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip;
}

function getCloudflareGeoInfo(req) {
    const cfCountry = req.headers['cf-ipcountry'];
    const cfCity = req.headers['cf-ipcity'];
    const cfRegion = req.headers['cf-region'];
    const cfTimezone = req.headers['cf-timezone'];
    const cfLatitude = req.headers['cf-iplatitude'];
    const cfLongitude = req.headers['cf-iplongitude'];
    const clientIp = getClientIp(req);
    
    if (!cfCountry || cfCountry === 'XX') {
        return null;
    }
    
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    
    return {
        country_code: cfCountry,
        country_name: cfCountry,
        city: cfCity || null,
        latitude: cfLatitude ? parseFloat(cfLatitude) : null,
        longitude: cfLongitude ? parseFloat(cfLongitude) : null,
        IPv4: clientIp,
        eu: euCountries.includes(cfCountry) ? "1" : "0",
        region: cfRegion || "00",
        timezone: cfTimezone || null
    };
}

async function getIpInfo(ip) {
    try {
        const response = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,query`);
        const data = response.data;
        
        if (data.status === 'fail') {
            throw new Error(data.message || 'IP lookup failed');
        }

        return {
            country_code: data.countryCode,
            country_name: data.country,
            city: data.city,
            latitude: data.lat,
            longitude: data.lon,
            IPv4: data.query,
            eu: data.countryCode && ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'].includes(data.countryCode) ? "1" : "0",
            region: data.region || "00",
            timezone: data.timezone
        };
    } catch (error) {
        throw new Error(`Failed to resolve IP: ${error.message}`);
    }
}

app.get('/ip', async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        
        if (!clientIp || clientIp === '::1' || clientIp === '127.0.0.1') {
            return res.status(400).json({ error: 'Unable to determine client IP address' });
        }

        const cfGeoInfo = getCloudflareGeoInfo(req);
        if (cfGeoInfo) {
            return res.json(cfGeoInfo);
        }

        const ipInfo = await getIpInfo(clientIp);
        res.json(ipInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/ip/:address', async (req, res) => {
    try {
        const ipAddress = req.params.address;
        
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ipAddress)) {
            return res.status(400).json({ error: 'Invalid IP address format' });
        }

        const ipInfo = await getIpInfo(ipAddress);
        res.json(ipInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});