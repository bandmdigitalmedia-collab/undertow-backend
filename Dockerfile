FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production PORT=8787 TRUST_PROXY=true
EXPOSE 8787
USER node
CMD ["node", "src/server.js"]
