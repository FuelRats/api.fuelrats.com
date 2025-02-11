FROM node:23

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libvips \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY . .

RUN npm ci

RUN npm rebuild && npm run build

RUN mkdir -p /app/geoip \
    && curl -L -o /app/geoip/GeoLite2-City.mmdb "https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-City.mmdb" \
    && curl -L -o /app/geoip/GeoLite2-ASN.mmdb "https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-ASN.mmdb" \
    && curl -L -o /app/geoip/GeoLite2-Country.mmdb "https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-Country.mmdb"

ENV FRAPI_GEOIP_DIRECTORY=/app/geoip

EXPOSE 8080

CMD ["node", "dist/index.mjs"]
