FROM node:20

WORKDIR /app

# Copy package files first for better layer caching
# Dependencies will only be reinstalled if package files change
COPY package.json package-lock.json* ./

# Install dependencies (use npm ci for faster, reliable, reproducible builds)
RUN npm ci --only=production=false

# Copy configuration files (these change less frequently than source code)
COPY astro.config.mjs tailwind.config.cjs tsconfig.json express-server.js ./

# Copy static assets
COPY public ./public

# Copy source code last (this changes most frequently)
COPY src ./src

# Build arguments and environment
ARG MOUNT_PATH
ENV MOUNT_PATH=${MOUNT_PATH}

# Build the application
RUN npm run build

CMD ["node", "express-server.js"]

