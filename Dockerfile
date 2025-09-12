# Use a lightweight Node.js image
FROM node:20-alpine AS audit-runner

# Set working directory
WORKDIR /app

# Install only what we need
RUN apk add --no-cache git curl

# Copy only the audit script and dependencies
COPY nextjs-audit.js .

# Install minimal required packages
RUN npm init -y && \
    npm install acorn@10.3.0 glob@8.1.0 --save-dev --omit=dev

# Define entrypoint
ENTRYPOINT ["node", "nextjs-audit.js"]
