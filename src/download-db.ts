import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';

const DB_URL = 'https://github.com/P3TERX/GeoLite.mmdb/raw/download/GeoLite2-City.mmdb';
const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'GeoLite2-City.mmdb');

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
        console.error('Failed to download database:', (error as Error).message);
        process.exit(1);
    }
}

if (require.main === module) {
    downloadDatabase();
}