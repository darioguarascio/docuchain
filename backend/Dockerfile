FROM node:20-alpine

WORKDIR /app

# Install system dependencies for Puppeteer (these rarely change)
# This layer will be cached unless system dependencies change
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Configure Puppeteer to use system Chromium (skip download for faster builds)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copy package files first for better layer caching
# Dependencies will only be reinstalled if package files change
COPY package.json package-lock.json* ./

# Install Node.js dependencies (cached unless package files change)
RUN npm ci --only=production=false

# Copy source code last (this changes most frequently)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

