import { Handler } from 'aws-lambda';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function loadSql(name: string): string {
  const candidates = [
    path.join(__dirname, '..', 'db', name),
    path.join(__dirname, 'db', name),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return fs.readFileSync(candidate, 'utf-8');
    }
  }
  throw new Error(`SQL file ${name} not found in ${candidates.join(', ')}`);
}

export const handler: Handler = async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(loadSql('schema.sql'));
    console.log('Schema applied');
    await client.query(loadSql('seed.sql'));
    console.log('Seed data inserted');
    const { rows } = await client.query('SELECT COUNT(*) AS count FROM carts');
    console.log('carts count:', rows[0].count);
  } finally {
    await client.end();
  }

  return { statusCode: 200, body: 'OK' };
};
