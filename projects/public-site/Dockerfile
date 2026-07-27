# ---- Build stage ----
FROM node:22-alpine AS public_site_builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN npm run build:public-site

# ---- Production stage ----
FROM nginx:alpine AS runner
COPY --from=public_site_builder /app/dist/public-site/browser /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
