FROM ghcr.io/ggml-org/llama.cpp@sha256:d880b2a0e478795ce99d0a275732f5a50e579cb234ae7d2d3815afc909fd02f2

COPY scripts/docker-entrypoint.sh /usr/local/bin/k7-entrypoint.sh
RUN chmod +x /usr/local/bin/k7-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/k7-entrypoint.sh"]
