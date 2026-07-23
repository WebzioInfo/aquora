process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.lxwherkjkjuhmfqzrziw:aquoradb%402026@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  try {
    const res = await client.query('SELECT "ReservedEmptyJars" FROM aquora_tenant_developer_company."Customers" LIMIT 1;');
    console.log('Query successful! ReservedEmptyJars column exists. Value:', res.rows[0]?.ReservedEmptyJars ?? 'No rows but column exists');
  } catch (err) {
    console.error('Error executing query', err.stack);
  } finally {
    await client.end();
  }
}

run();
