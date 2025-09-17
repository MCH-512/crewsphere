# Use an official Node.js runtime as a parent image
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

# The app binds to port 9002 by default, so we'll expose it
EXPOSE 9002

# The default command to run when starting the container
CMD [ "npm", "run", "dev" ]
