# Build stage
FROM node:20-alpine AS build-env
WORKDIR /app

# Copy package requirements
COPY package*.json ./
RUN npm install

# Copy source and build bundle
COPY . ./
RUN npm run build

# Serving stage
FROM nginx:alpine
COPY --from=build-env /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
