process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.lxwherkjkjuhmfqzrziw:aquoradb%402026@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    const res = await client.query(`
      SELECT column_name, is_nullable, column_default, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'PlatformAuditLogs';
    `);
    console.table(res.rows);
  } catch (err) {
    console.error('Error:', err.stack);
  } finally {
    await client.end();
  }
}

run();
