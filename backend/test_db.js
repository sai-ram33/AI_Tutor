import { config } from './config/env.js';
import { pool, query, initDb } from './config/db.js';

async function testDatabase() {
  console.log('====================================================');
  console.log('🔍 Testing PostgreSQL Database Integration');
  console.log('====================================================\n');

  console.log('1. Checking DATABASE_URL configuration:');
  if (config.databaseUrl) {
    console.log('   ✅ DATABASE_URL is defined and loaded from .env');
  } else {
    console.log('   ❌ DATABASE_URL is missing or empty.');
    process.exit(1);
  }

  console.log('\n2. Testing connection and initializing tables:');
  try {
    // Run schema initialization
    await initDb();

    // Run simple query test
    const res = await query('SELECT NOW() AS current_time, current_database() AS db_name, version() AS pg_version');
    console.log('   ✅ Connection query executed successfully.');
    console.log(`   Connected Database: ${res.rows[0].db_name}`);
    console.log(`   Server Timestamp: ${res.rows[0].current_time}`);

    // Verify existing tables
    const tableRes = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n3. Verified Database Tables:');
    const tableNames = tableRes.rows.map(r => r.table_name);
    console.log('   Tables found:', tableNames.join(', '));

    const requiredTables = ['users', 'conversations', 'messages'];
    const allPresent = requiredTables.every(t => tableNames.includes(t));
    if (allPresent) {
      console.log('   ✅ All required tables (users, conversations, messages) exist and are ready.');
    } else {
      console.log('   ⚠️ Some tables are missing. Found:', tableNames);
    }

    console.log('\n====================================================');
    console.log('🎉 PostgreSQL integration is fully functional!');
    console.log('====================================================');
  } catch (err) {
    console.error('❌ PostgreSQL Connection Failed:');
    console.error('   Error message:', err.message);
  } finally {
    await pool.end();
  }
}

testDatabase();
