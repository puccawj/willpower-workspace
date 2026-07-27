# ---- Build stage ----
FROM node:22-alpine AS admin_panel_builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

RUN npm run build:admin-panel

# ---- Production stage ----
FROM nginx:alpine AS runner
COPY --from=admin_panel_builder /app/dist/admin-panel/browser /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
