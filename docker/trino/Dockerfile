FROM trinodb/trino:477

# Copy template and entrypoint script
COPY catalog/postgres.properties.template /etc/trino/catalog/
COPY docker-entrypoint.sh /usr/local/bin/

USER root
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER trino

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

