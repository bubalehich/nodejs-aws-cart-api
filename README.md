# Cart Service

NestJS-based shopping cart microservice deployed as an AWS Lambda behind API Gateway, backed by PostgreSQL on RDS.

## Architecture

- **NestJS** wrapped with `@vendia/serverless-express` for Lambda
- **PostgreSQL** on RDS `db.t4g.micro` in a private isolated VPC subnet
- **TypeORM** for data access
- **AWS CDK** provisions all infrastructure

```
API Gateway → Lambda (cartApi) → RDS PostgreSQL
                                    ▲
                            Lambda (cartDbSeeder)
```

## Schema

See [`db/schema.sql`](./db/schema.sql) — `users`, `carts`, `cart_items`, `orders` tables.

Seed data: [`db/seed.sql`](./db/seed.sql).

## Endpoints

All endpoints require `Authorization: Basic <base64(login:password)>`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/profile/cart` | Get current user's OPEN cart items |
| PUT | `/api/profile/cart` | Add or update a cart item |
| DELETE | `/api/profile/cart` | Clear current user's cart |
| PUT | `/api/profile/cart/order` | Checkout (creates order, marks cart ORDERED) |
| GET | `/api/profile/cart/order` | List all orders |

## Deploy / destroy

```bash
npm install --legacy-peer-deps
npm run cdk:deploy

# After RDS is up, run the seeder once to create tables and insert sample data
aws lambda invoke --function-name cartDbSeeder --payload '{}' /tmp/out.json --cli-binary-format raw-in-base64-out

npm run cdk:destroy  # tears everything down
```

## Notes

- VPC is `PRIVATE_ISOLATED` (no NAT gateway, no public IP) so RDS is free of egress charges
- DB password is passed to Lambda env via CloudFormation token (`secretValueFromJson(...).unsafeUnwrap()`) — fine for the learning task, would be moved to a Secrets Manager VPC endpoint in production
- Test user pre-seeded into the in-memory `UsersService`: `bubalehich` / `TEST_PASSWORD`
