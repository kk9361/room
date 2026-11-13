FROM node:22-slim AS build
WORKDIR /srv/apps/web
COPY apps/web/package*.json ./
RUN npm ci
COPY apps/web ./
COPY packages /srv/packages
ENV NEXT_TELEMETRY_DISABLED=1
ARG API_INTERNAL_URL=http://backend:8000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
RUN npm run build
EXPOSE 3000
USER node
CMD ["npm", "start", "--", "--hostname", "0.0.0.0"]
