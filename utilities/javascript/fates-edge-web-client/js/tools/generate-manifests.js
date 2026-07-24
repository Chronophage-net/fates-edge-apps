import fs from 'fs';
import path from 'path';

const dataDirs = [
  './data/patrons',
  './data/terrestrial',
  './data/religions',
  // add others as needed
];

for (const dir of dataDirs) {
  const fullPath = path.resolve(dir);
  if (!fs.existsSync(fullPath)) continue;

  const files = fs.readdirSync(fullPath);
  const slugs = files
    .filter(f => f.endsWith('.json') && f !== 'manifest.json')
    .map(f => f.replace(/\.json$/, ''));

  fs.writeFileSync(
    path.join(fullPath, 'manifest.json'),
    JSON.stringify(slugs, null, 2)
  );
  console.log(`📄 Generated manifest for ${dir} (${slugs.length} entries)`);
}
