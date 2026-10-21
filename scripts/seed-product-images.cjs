const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'flo.db');
const db = new Database(dbPath);

const FOOD_IMAGES = {
  'prod-demo-butter-chicken':
    'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=360&auto=format&fit=crop&q=80',
  'prod-demo-paneer-tikka':
    'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=360&auto=format&fit=crop&q=80',
  'prod-demo-chicken-wings':
    'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?w=360&auto=format&fit=crop&q=80',
  'prod-demo-dal-makhani':
    'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=360&auto=format&fit=crop&q=80',
  'prod-demo-jeera-rice':
    'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=360&auto=format&fit=crop&q=80',
  'prod-demo-cola':
    'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=360&auto=format&fit=crop&q=80',
  'prod-demo-lemon-soda':
    'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=360&auto=format&fit=crop&q=80',
  'prod-demo-gulab-jamun':
    'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=360&auto=format&fit=crop&q=80',
};

async function main() {
  console.log('Seeding product images into flo.db...');
  const updateStmt = db.prepare(
    'UPDATE products SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  );

  for (const [productId, url] of Object.entries(FOOD_IMAGES)) {
    try {
      console.log(`Fetching image for ${productId}...`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      const dataUri = `data:image/jpeg;base64,${base64}`;
      const result = updateStmt.run(dataUri, productId);
      console.log(`Updated ${productId}: ${result.changes} row(s) updated.`);
    } catch (err) {
      console.error(`Failed to seed ${productId}:`, err.message);
    }
  }

  console.log('Finished seeding product images!');
}

main().catch(console.error);
