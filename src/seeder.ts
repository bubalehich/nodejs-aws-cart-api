import { Handler } from 'aws-lambda';
import { Client } from 'pg';

const DDL = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password VARCHAR(255)
  );

  DO $$ BEGIN
    CREATE TYPE cart_status AS ENUM ('OPEN', 'ORDERED');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    status cart_status NOT NULL DEFAULT 'OPEN'
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (cart_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    cart_id UUID NOT NULL REFERENCES carts(id),
    payment JSONB,
    delivery JSONB,
    comments TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    total NUMERIC(12, 2) NOT NULL DEFAULT 0
  );
`;

const SEED = `
  INSERT INTO users (id, name, email)
  VALUES
    ('00000000-0000-0000-0000-000000000001', 'Bubalehich', 'bubalehich@example.com'),
    ('00000000-0000-0000-0000-000000000002', 'Frodo', 'frodo@shire.example.com')
  ON CONFLICT DO NOTHING;

  INSERT INTO carts (id, user_id, status)
  VALUES
    ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'OPEN')
  ON CONFLICT DO NOTHING;

  INSERT INTO cart_items (cart_id, product_id, count) VALUES
    ('11111111-1111-1111-1111-111111111111', '7e247b9f-ea77-4428-ba96-ef629ae4ef8a', 2),
    ('11111111-1111-1111-1111-111111111111', 'b539d879-337e-4b96-97fb-582c4623cc20', 1)
  ON CONFLICT DO NOTHING;
`;

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
    await client.query(DDL);
    console.log('Schema applied');
    await client.query(SEED);
    console.log('Seed data inserted');
    const { rows } = await client.query('SELECT COUNT(*) AS count FROM carts');
    console.log('carts count:', rows[0].count);
  } finally {
    await client.end();
  }

  return { statusCode: 200, body: 'OK' };
};
