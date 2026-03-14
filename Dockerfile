FROM node:20-alpine

WORKDIR /app

# Copy backend package files and prisma schema first for layer caching
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy the rest of the backend source
COPY backend/ .

# Build TypeScript → dist/
RUN npm run build

EXPOSE 4000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
