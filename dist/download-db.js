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
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const path = __importStar(require("path"));
const DB_URL = 'https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb';
const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'GeoLite2-City.mmdb');
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
    console.log('Downloading GeoLite2-City database...');
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
        console.log('Created data directory');
    }
    try {
        await downloadFile(DB_URL, DB_FILE);
        console.log('Database downloaded successfully!');
        console.log('File saved to:', DB_FILE);
        const stats = fs.statSync(DB_FILE);
        console.log('File size:', (stats.size / (1024 * 1024)).toFixed(2), 'MB');
    }
    catch (error) {
        console.error('Failed to download database:', error.message);
        process.exit(1);
    }
}
if (require.main === module) {
    downloadDatabase();
}
//# sourceMappingURL=download-db.js.map