FROM nginx:1.30.4-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh

COPY index.html login.html /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY modules /usr/share/nginx/html/modules

RUN chmod 0755 /docker-entrypoint.d/40-runtime-config.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/healthz >/dev/null || exit 1
