FROM oven/bun:1.4.4

WORKDIR /app

# deploy.yml sets this per run, so the apt layer below never comes from the build
# cache and every image carries the Debian security updates of its build day.
ARG SECURITY_REFRESH=local
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    libvips \
    git \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock* ./
RUN bun install

COPY . .

RUN bun run build:info
RUN bun run openapi:build
RUN bun install --production

RUN mkdir -p /app/geoip \
    && curl -L -o /app/geoip/GeoLite2-City.mmdb "https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-City.mmdb" \
    && curl -L -o /app/geoip/GeoLite2-ASN.mmdb "https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-ASN.mmdb" \
    && curl -L -o /app/geoip/GeoLite2-Country.mmdb "https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-Country.mmdb"

ENV FRAPI_GEOIP_DIRECTORY=/app/geoip

EXPOSE 8080

CMD ["bun", "src/index.mjs"]
