const express = require("express");
const maxmind = require("maxmind");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 7755;
const DB_PATH = path.join(__dirname, "data", "GeoLite2-City.mmdb");

let cityLookup = null;

app.use(express.json());

async function initializeDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.error("GeoLite2 database not found. Run: node download-db.js");
      process.exit(1);
    }

    cityLookup = await maxmind.open(DB_PATH);
    console.log("GeoLite2 database loaded successfully");
  } catch (error) {
    console.error("Failed to load GeoLite2 database:", error.message);
    process.exit(1);
  }
}

function getClientIp(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    req.ip
  );
}

function getCloudflareGeoInfo(req) {
  const cfCountry = req.headers["cf-ipcountry"];
  const cfCity = req.headers["cf-ipcity"];
  const cfRegion = req.headers["cf-region"];
  const cfTimezone = req.headers["cf-timezone"];
  const cfLatitude = req.headers["cf-iplatitude"];
  const cfLongitude = req.headers["cf-iplongitude"];
  const clientIp = getClientIp(req);

  if (!cfCountry || cfCountry === "XX") {
    return null;
  }

  const euCountries = [
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "ES",
    "SE",
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
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "ES",
    "SE",
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
      return res
        .status(400)
        .json({ error: "Unable to determine client IP address" });
    }

    const cfGeoInfo = getCloudflareGeoInfo(req);
    if (cfGeoInfo) {
      return res.json(cfGeoInfo);
    }

    const ipInfo = getLocalIpInfo(clientIp);
    res.json(ipInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/ip/:address", async (req, res) => {
  try {
    const ipAddress = req.params.address;

    const ipRegex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ipAddress)) {
      return res.status(400).json({ error: "Invalid IP address format" });
    }

    const ipInfo = getLocalIpInfo(ipAddress);
    res.json(ipInfo);
  } catch (error) {
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
