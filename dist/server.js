"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const maxmind = __importStar(require("maxmind"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '7755', 10);
const DB_PATH = path.join(__dirname, "..", "data", "GeoLite2-City.mmdb");
const DB_URL = 'https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb';
let cityLookup = null;
app.use(express_1.default.json());
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                const location = response.headers.location;
                if (!location) {
                    reject(new Error("Redirect without location header"));
                    return;
                }
                downloadFile(location, dest).then(resolve).catch(reject);
                return;
            }
            if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', reject);
        file.on('error', reject);
    });
}
async function downloadDatabase() {
    console.log('GeoLite2 database not found. Downloading...');
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        console.log('Created data directory');
    }
    try {
        await downloadFile(DB_URL, DB_PATH);
        console.log('Database downloaded successfully!');
        const stats = fs.statSync(DB_PATH);
        console.log('File size:', (stats.size / (1024 * 1024)).toFixed(2), 'MB');
    }
    catch (error) {
        console.error('Failed to download database:', error.message);
        throw error;
    }
}
async function initializeDatabase() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            await downloadDatabase();
        }
        cityLookup = await maxmind.open(DB_PATH);
        console.log("GeoLite2 database loaded successfully");
    }
    catch (error) {
        console.error("Failed to initialize GeoLite2 database:", error.message);
        process.exit(1);
    }
}
function getClientIp(req) {
    const forwardedFor = req.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    return (req.headers["cf-connecting-ip"] ||
        forwardedIp?.split(",")[0] ||
        req.headers["x-real-ip"] ||
        (req.connection?.remoteAddress) ||
        (req.socket?.remoteAddress) ||
        (req.connection?.socket?.remoteAddress) ||
        req.ip ||
        null);
}
function getCloudflareGeoInfo(req) {
    const cfCountry = req.headers["cf-ipcountry"];
    const cfCity = req.headers["cf-ipcity"];
    const cfRegion = req.headers["cf-region"];
    const cfTimezone = req.headers["cf-timezone"];
    const cfLatitude = req.headers["cf-iplatitude"];
    const cfLongitude = req.headers["cf-iplongitude"];
    const clientIp = getClientIp(req);
    if (!cfCountry || cfCountry === "XX" || !clientIp) {
        return null;
    }
    const euCountries = [
        "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
        "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
        "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    ];
    return {
        country_code: cfCountry,
        country_name: cfCountry,
        city: cfCity || null,
        latitude: cfLatitude ? parseFloat(cfLatitude) : null,
        longitude: cfLongitude ? parseFloat(cfLongitude) : null,
        IPv4: clientIp,
        eu: euCountries.includes(cfCountry) ? "1" : "0",
        region: cfRegion || "00",
        timezone: cfTimezone || null,
    };
}
function getLocalIpInfo(ip) {
    if (!cityLookup) {
        throw new Error("Database not initialized");
    }
    const result = cityLookup.get(ip);
    if (!result) {
        throw new Error("IP address not found in database");
    }
    const euCountries = [
        "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
        "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
        "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    ];
    const countryCode = result.country?.iso_code || null;
    const countryName = result.country?.names?.en || null;
    const cityName = result.city?.names?.en || null;
    const latitude = result.location?.latitude || null;
    const longitude = result.location?.longitude || null;
    const timezone = result.location?.time_zone || null;
    const region = result.subdivisions?.[0]?.iso_code || "00";
    return {
        country_code: countryCode,
        country_name: countryName,
        city: cityName,
        latitude: latitude,
        longitude: longitude,
        IPv4: ip,
        eu: countryCode && euCountries.includes(countryCode) ? "1" : "0",
        region: region,
        timezone: timezone,
    };
}
app.get("/ip", async (req, res) => {
    try {
        const clientIp = getClientIp(req);
        if (!clientIp || clientIp === "::1" || clientIp === "127.0.0.1") {
            res.status(400).json({ error: "Unable to determine client IP address" });
            return;
        }
        const cfGeoInfo = getCloudflareGeoInfo(req);
        if (cfGeoInfo) {
            res.json(cfGeoInfo);
            return;
        }
        const ipInfo = getLocalIpInfo(clientIp);
        res.json(ipInfo);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get("/ip/:address", async (req, res) => {
    try {
        const ipAddress = req.params.address;
        if (!ipAddress) {
            res.status(400).json({ error: "IP address parameter is required" });
            return;
        }
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(ipAddress)) {
            res.status(400).json({ error: "Invalid IP address format" });
            return;
        }
        const ipInfo = getLocalIpInfo(ipAddress);
        res.json(ipInfo);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.get("/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
});
async function startServer() {
    await initializeDatabase();
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server is running on port ${PORT}`);
    });
}
startServer().catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
});
//# sourceMappingURL=server.js.map