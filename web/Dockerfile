FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
# Harita verisi statik hosting'deki PMTiles'tan okunacaksa (bos: VDS tileserver)
ARG VITE_TILES_PMTILES
ENV VITE_TILES_PMTILES=$VITE_TILES_PMTILES
ARG VITE_GLYPHS_URL
ENV VITE_GLYPHS_URL=$VITE_GLYPHS_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
