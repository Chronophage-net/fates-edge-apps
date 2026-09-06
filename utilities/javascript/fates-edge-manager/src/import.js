import { readFile } from 'node:fs/promises';
import { database, migrate } from './db.js';
import { importData } from './import-data.js';

if (!process.argv[2]) throw new Error('Usage: npm run import -- /path/to/reviewed-export.json');
const document=JSON.parse(await readFile(process.argv[2],'utf8'));
const db=await database(process.env.MANAGER_DATABASE_URL);
try { await migrate(db); console.log('Imported:',await importData(db,document)); }
finally {await db.close();}
