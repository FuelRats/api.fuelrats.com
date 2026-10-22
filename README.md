# api.fuelrats.com

[![Deploy](https://github.com/FuelRats/api.fuelrats.com/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/FuelRats/api.fuelrats.com/actions/workflows/deploy.yml)
[![Open GitHub Issues](https://img.shields.io/github/issues/FuelRats/api.fuelrats.com.svg?style=flat-square)](https://github.com/FuelRats/api.fuelrats.com/issues)

The Fuel Rats API: a JSON:API service for rescues, rats, users, groups and OAuth2/OIDC sign-in, with
IRC services (Anope) integration. It runs on [Bun](https://bun.sh) with [Hono](https://hono.dev) and
[Sequelize](https://sequelize.org) on PostgreSQL.

## Requirements

- [Bun](https://bun.sh) 1.4.3 (the version pinned in the `Dockerfile` and CI)
- [Docker](https://docs.docker.com/get-docker/) with Compose, for PostgreSQL 17 and [Mailpit](https://mailpit.axllent.org)
- [Node.js](https://nodejs.org) 22 or newer, only for running database migrations (`sequelize-cli` does not run on Bun)

## Getting started

These steps run the API on your machine with Bun, against PostgreSQL and Mailpit in Docker. The commands
assume a POSIX shell such as bash or zsh.

1. Install dependencies:

       git clone https://github.com/FuelRats/api.fuelrats.com.git
       cd api.fuelrats.com
       bun install

2. Create the development secrets that Compose mounts into its containers:

       mkdir -p .docker/secrets
       for secret in frapi_postgres_password frapi_cookie frapi_jwt_secret; do
         openssl rand -hex 32 > .docker/secrets/$secret
       done

3. Start PostgreSQL and Mailpit:

       docker compose up -d db mailpit

4. Load a development database. The dump is not in the repository (`fuelratsdev.dump` is gitignored), so
   ask a maintainer for one. Restore it, mark the migrations it already contains, then apply the rest:

       docker compose exec -T db pg_restore -U fuelrats -d fuelrats --no-owner --no-privileges < fuelratsdev.dump
       docker compose exec -T db psql -U fuelrats -d fuelrats < scripts/sequelize-meta-baseline.sql
       bun run db:migrate --url "postgres://fuelrats:$(cat .docker/secrets/frapi_postgres_password)@localhost:5432/fuelrats"

   Skip the `sequelize-meta-baseline.sql` step if the dump already has a `SequelizeMeta` table. A database
   volume created by an older PostgreSQL major version will not start on 17; remove it with
   `docker compose down -v` and restore again.

5. Download the GeoLite2 databases (the same mirror the `Dockerfile` uses):

       mkdir -p static/geoip
       for db in City ASN; do
         curl -L -o static/geoip/GeoLite2-$db.mmdb "https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-$db.mmdb"
       done

6. Create a `.env` file (gitignored; Bun loads it automatically) and generate `build.json`:

       cat > .env <<EOF
       FRAPI_COOKIE=$(cat .docker/secrets/frapi_cookie)
       FRAPI_JWT_SECRET=$(cat .docker/secrets/frapi_jwt_secret)
       FRAPI_POSTGRES_PASSWORD=$(cat .docker/secrets/frapi_postgres_password)
       FRAPI_GEOIP_DIRECTORY=static/geoip
       FRAPI_SMTP_HOSTNAME=localhost
       FRAPI_SMTP_PORT=1025
       EOF
       bun run build:info

7. Start the API, restarting on file changes:

       bun run dev

The API listens on http://localhost:8080 and serves its API reference at http://localhost:8080/. Mail the
API sends shows up in Mailpit at http://localhost:8025.

### Running everything in Docker

`docker compose up --build` builds the API image and runs it with PostgreSQL, Mailpit and an SSH tunnel to
the development Anope database. The tunnel needs SSH access to `services.fuelrats.dev` with the key in
`~/.ssh/id_rsa`, and the API container waits for it to be healthy. Without that access, use the setup above.

## Configuration

All configuration comes from `FRAPI_*` environment variables, defined with their defaults and validation in
[`src/config.mjs`](src/config.mjs). A variable can also be provided as a Docker secret file at
`/run/secrets/<variable name in lower case>`, which is how Compose passes `FRAPI_COOKIE`,
`FRAPI_JWT_SECRET` and `FRAPI_POSTGRES_PASSWORD`.

On startup the API prints a warning for every recommended variable that is missing and exits if a required
one is invalid. `FRAPI_COOKIE`, `FRAPI_JWT_SECRET` and `FRAPI_GEOIP_DIRECTORY` have no defaults. The Anope
integration stays disabled until `FRAPI_ANOPE_DATABASE` is set.

## Development

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the API and restart it on file changes |
| `bun run eslint` | Lint the project |
| `bun test` | Run the integration tests |
| `bun run db:migrate --url <postgres url>` | Apply pending migrations |
| `bun run db:migrate:status --url <postgres url>` | List migrations and whether they are applied |
| `bun run openapi:build` | Regenerate the OpenAPI spec in `docs/openapi/` |
| `bun run openapi:lint` | Validate the OpenAPI spec |

### Tests

The tests in `tests/` are integration tests: they send requests to a running API (`FRAPI_TEST_URL`,
default `http://localhost:8080`) and seed and remove their own records with `psql` inside the database
container (`FRAPI_TEST_DB_CONTAINER`, default `apifuelratscom-db-1`). Run them against a development
database only.

### Migrations

Schema changes are CommonJS files in [`migrations/`](migrations), named `<timestamp>-<description>.js`
and applied with `bun run db:migrate`, which runs `sequelize-cli` on Node.

### API documentation

The API serves an interactive reference (Scalar) at `/`, built from `docs/openapi/bundled.yaml`. The spec is
generated from the route definitions in `src/routes/` and the hand-written files in `docs/openapi/`; run
`bun run openapi:build` after changing either. The Docker build regenerates it as well.

## Deployment

GitHub Actions builds the Docker image, pushes it to `ghcr.io/fuelrats/api.fuelrats.com` and updates the
Docker Swarm service: pushes to `develop` deploy to the development API, pushes to `main` to production. Pull
requests run ESLint and a Docker build. Dependabot opens update pull requests against `develop`.

The Bun version is pinned in the `Dockerfile` and in both workflows in `.github/workflows/`; change all three
together.

## License
Copyright 2017 The Fuel Rats Mischief

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
