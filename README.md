# IELTS Practice Backend

## Database demo data

Start the local dependencies and automatically create the Prisma schema and demo IELTS tests:

```sh
docker compose up --build -d
docker compose logs -f db-seed
```

The seed creates a demo author and sample listening and reading tests, including their parts,
question groups, questions, options, and answers. It can be rerun safely; the demo tests are
recreated while other tests are left untouched.

For a locally installed backend, copy `.env.example` to `.env`, then run:

```sh
npm ci
npx prisma generate
npm run db:push
npm run db:seed
```


# Route for history test detail

localhost3001/test-history/{TestId}?attemptId=?