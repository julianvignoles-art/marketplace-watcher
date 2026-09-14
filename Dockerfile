# Playwright's own image ships Chromium plus every system dependency it
# needs, which avoids a long apt-get list here.
FROM mcr.microsoft.com/playwright:v1.63.0-jammy

WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL="file:/data/app.db"
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

RUN mkdir -p /data

EXPOSE 3000

# db push keeps SQLite's schema in sync on every boot -- fine for a
# single-user app with no concurrent migrations to coordinate.
CMD sh -c "npx prisma db push --accept-data-loss --skip-generate && npm run start"
