FROM oven/bun:1.2 AS tamer-test

WORKDIR /tamer

# Copy package files first (for caching)
COPY package.json bun.lock tsconfig.json ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY seeds/ ./seeds/
COPY tests/ ./tests/
COPY docs/ ./docs/

# Create tamer data directory with seed rules
RUN mkdir -p /root/.tamer && \
    cp seeds/rules.json /root/.tamer/rules.json

# Expose the complete package to OpenCode and keep the local entry dependency-only.
RUN mkdir -p .opencode/plugins .opencode/node_modules && \
    ln -s /tamer .opencode/node_modules/opencode-tamer && \
    printf 'export { tamerPlugin as TamerPlugin } from "opencode-tamer"\n' > .opencode/plugins/tamer.ts

# Create minimal opencode config (only tamer, no EQ OS)
RUN echo '{"$schema":"https://opencode.ai/config.json"}' > opencode.json

# Default: run unit tests
CMD ["bun", "test", "tests/unit/"]
