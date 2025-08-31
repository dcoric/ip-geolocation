const fs = require('fs');
const https = require('https');
const path = require('path');

const DB_URL = 'https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb';
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'GeoLite2-City.mmdb');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
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
    } catch (error) {
        console.error('Failed to download database:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    downloadDatabase();
}