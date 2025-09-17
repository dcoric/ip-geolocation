import express, { Request, Response } from "express";
import * as maxmind from "maxmind";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

export const app = express();
const PORT = parseInt(process.env.PORT || '7755', 10);
const DB_PATH = path.join(__dirname, "..", "data", "GeoLite2-City.mmdb");
const DB_URL = 'https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb';

let cityLookup: maxmind.Reader<maxmind.CityResponse> | null = null;

export function setCityLookup(reader: maxmind.Reader<maxmind.CityResponse> | null): void {
  cityLookup = reader;
}

export function resetCityLookup(): void {
  cityLookup = null;
}

app.use(express.json());

interface GeoLocationInfo {
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  IPv4: string;
  eu: "0" | "1";
  region: string;
  timezone: string | null;
}

function downloadFile(url: string, dest: string): Promise<void> {
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

async function downloadDatabase(): Promise<void> {
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
  } catch (error) {
    console.error('Failed to download database:', (error as Error).message);
    throw error;
  }
}

async function initializeDatabase(): Promise<void> {
  try {
    if (!fs.existsSync(DB_PATH)) {
      await downloadDatabase();
    }

    cityLookup = await maxmind.open<maxmind.CityResponse>(DB_PATH);
    console.log("GeoLite2 database loaded successfully");
  } catch (error) {
    console.error("Failed to initialize GeoLite2 database:", (error as Error).message);
    process.exit(1);
  }
}

export function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  
  return (
    req.headers["cf-connecting-ip"] as string ||
    forwardedIp?.split(",")[0] ||
    req.headers["x-real-ip"] as string ||
    (req.connection?.remoteAddress) ||
    (req.socket?.remoteAddress) ||
    ((req.connection as any)?.socket?.remoteAddress) ||
    req.ip ||
    null
  );
}

export function getCloudflareGeoInfo(req: Request): GeoLocationInfo | null {
  const cfCountry = req.headers["cf-ipcountry"] as string | undefined;
  const cfCity = req.headers["cf-ipcity"] as string | undefined;
  const cfRegion = req.headers["cf-region"] as string | undefined;
  const cfTimezone = req.headers["cf-timezone"] as string | undefined;
  const cfLatitude = req.headers["cf-iplatitude"] as string | undefined;
  const cfLongitude = req.headers["cf-iplongitude"] as string | undefined;
  const clientIp = getClientIp(req);

  if (!cfCountry || cfCountry === "XX" || !clientIp) {
    return null;
  }

  const euCountries = [
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
    "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
    "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  ] as const;

  return {
    country_code: cfCountry,
    country_name: cfCountry,
    city: cfCity || null,
    latitude: cfLatitude ? parseFloat(cfLatitude) : null,
    longitude: cfLongitude ? parseFloat(cfLongitude) : null,
    IPv4: clientIp,
    eu: euCountries.includes(cfCountry as any) ? "1" : "0",
    region: cfRegion || "00",
    timezone: cfTimezone || null,
  };
}

export function getLocalIpInfo(ip: string): GeoLocationInfo {
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
  ] as const;

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
    eu: countryCode && euCountries.includes(countryCode as any) ? "1" : "0",
    region: region,
    timezone: timezone,
  };
}

export async function handleGetIp(req: Request, res: Response): Promise<void> {
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
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function handleGetIpAddress(req: Request, res: Response): Promise<void> {
  try {
    const ipAddress = req.params.address;
    
    if (!ipAddress) {
      res.status(400).json({ error: "IP address parameter is required" });
      return;
    }

    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ipAddress)) {
      res.status(400).json({ error: "Invalid IP address format" });
      return;
    }

    const ipInfo = getLocalIpInfo(ipAddress);
    res.json(ipInfo);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export function handleHealth(_req: Request, res: Response): void {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
}

app.get("/ip", handleGetIp);
app.get("/ip/:address", handleGetIpAddress);
app.get("/health", handleHealth);

export async function startServer(): Promise<void> {
  await initializeDatabase();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("Failed to start server:", (error as Error).message);
    process.exit(1);
  });
}
