FROM trinodb/trino:477

USER root

# Copy catalog templates, JVM config, and entrypoint script
COPY catalog-templates/ /etc/trino/catalog-templates/
COPY jvm.config /etc/trino/jvm.config
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Make entrypoint executable
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER trino

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
