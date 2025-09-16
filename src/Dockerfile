# Use an official Node.js runtime as a parent image
FROM node:20-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to leverage Docker cache
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Bundle app source
COPY . .

# Your app binds to port 3000 so you'll use this port
EXPOSE 3000

# Defines the command to run your app
CMD ["npm", "run", "dev"]
