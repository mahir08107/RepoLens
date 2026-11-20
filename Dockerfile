FROM node:22-alpine

WORKDIR /app

# Copy backend package manifests first for optimal layer caching
COPY backend/package*.json ./backend/

# Install backend production + build dependencies
RUN npm ci --prefix backend

# Copy shared definitions and backend source code
COPY shared/ ./shared/
COPY backend/ ./backend/

# Compile TypeScript to JavaScript
RUN npm run build --prefix backend

# Cloud Run defaults
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Start compiled backend production server
CMD ["npm", "start", "--prefix", "backend"]

