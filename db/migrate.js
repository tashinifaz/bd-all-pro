const fs = require('fs'), path = require('path');
const pool = require('../src/db');
module.exports = async function migrate() {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log('Migration applied');
};
if (require.main === module) module.exports().then(() => pool.end()).catch(e => { console.error(e); process.exit(1); });
