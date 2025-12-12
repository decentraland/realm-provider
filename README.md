# Realm Provider

[![Coverage Status](https://coveralls.io/repos/github/decentraland/realm-provider/badge.svg?branch=main)](https://coveralls.io/github/decentraland/realm-provider?branch=main)

The Realm Provider service is a central gateway for Decentraland clients that provides intelligent realm discovery, real-time scene popularity tracking, and geo-optimized content delivery. It implements [ADR-110](https://adr.decentraland.org/adr/ADR-110) realm descriptions, enabling clients to discover and connect to the optimal Catalyst nodes, Lambdas services, and communication realms.

This server interacts with the Catalyst Network, Archipelago Workers, and the Catalyst DAO smart contract to provide users with optimal realm selection based on geographic location, node health, and current capacity.

## Table of Contents

- [Features](#features)
- [Dependencies & Related Services](#dependencies--related-services)
- [API Documentation](#api-documentation)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Service](#running-the-service)
- [Testing](#testing)
- [AI Agent Context](#ai-agent-context)

## Features

- **Realm Discovery & Selection**: Discover all available Catalyst realms with real-time user counts, automatic health monitoring, and filtering of catalyst nodes
- **Geo-Location Optimization**: Intelligent content server selection based on user geographic location using Cloudflare's CF-IPCountry header and Haversine distance calculation to route users to the nearest healthy Catalyst node
- **Hot Scenes Tracking**: Real-time aggregation of the most popular scenes across all realms with scene popularity metrics and user distribution per realm
- **Main Realm Services**: Comprehensive service information for the main realm managed by Archipelago Workers, including content server, communications, BFF, and Lambdas configurations
- **Catalyst Version Filtering**: Automatic filtering to prefer updated Catalyst nodes over outdated versions
- **Health Monitoring**: Service status and version information with health check endpoints for integration monitoring
- **Smart Caching**: LRU cache implementation for Catalyst DAO queries to optimize performance

## Dependencies & Related Services

This service interacts with the following services:

- **[Catalyst Network](https://github.com/decentraland/catalyst)**: Queries available Catalyst nodes for realm information, health status, and user counts via the `/about` endpoint
- **[Archipelago Workers](https://github.com/decentraland/archipelago-workers)**: Provides the default MAIN realm status and configuration for Genesis City connections
- **[Catalyst DAO Smart Contract](https://github.com/decentraland/catalyst-contracts)**: Retrieves the list of approved Catalyst nodes from the DAO on Ethereum mainnet

External dependencies:

- **Ethereum RPC**: Connects to Ethereum mainnet (or sepolia for testing) via `https://rpc.decentraland.org` to query the Catalyst DAO contract
- **Cloudflare**: Uses CF-IPCountry header for geo-location based routing

## API Documentation

The API is fully documented using the [OpenAPI standard](https://swagger.io/specification/). Its schema is located at [docs/openapi.yaml](docs/openapi.yaml).

## Getting Started

### Prerequisites

Before running this service, ensure you have the following installed:

- **Node.js**: Version 20.x or higher (LTS recommended)
- **Yarn**: Version 1.22.x or higher

### Installation

1. Clone the repository:

```bash
git clone https://github.com/decentraland/realm-provider.git
cd realm-provider
```

2. Install dependencies:

```bash
yarn install
```

3. Build the project:

```bash
yarn build
```

### Configuration

The service uses environment variables for configuration.
Create a `.env` file in the root directory containing the environment variables for the service to run.
Use the `.env.default` variables as an example.

Key configuration variables include:

- `ARCHIPELAGO_STATS_URL`: URL for the Archipelago stats service (required)
- `ARCHIPELAGO_WS_CONNECTOR_URL`: URL for the Archipelago WebSocket connector (required)
- `ETH_NETWORK`: Ethereum network to use for DAO queries (`mainnet` or `sepolia`, defaults to `mainnet`)
- `HTTP_SERVER_HOST`: Host for the HTTP server
- `HTTP_SERVER_PORT`: Port for the HTTP server (defaults to `3000`)
- `CONTENT_URL`: Default content server URL (optional, defaults to `https://peer.decentraland.org/content/`)
- `HTTP_BASE_URL`: Base URL for the service (optional, auto-detected from request if not set)
- `BLACKLISTED_CATALYST`: Semicolon-separated list of catalyst URLs to exclude (optional)
- `COMMIT_HASH`: Git commit hash for status endpoint (optional)
- `CURRENT_VERSION`: Service version for status endpoint (optional)

### Running the Service

#### Setting up the environment

The Realm Provider is a lightweight, stateless service with minimal external dependencies. Unlike other services in the ecosystem, it does not require local databases or message brokers. 

The service only requires:
- Network access to Ethereum RPC endpoint (via `https://rpc.decentraland.org`)
- Network access to Archipelago services (configured via environment variables)
- Network access to public Catalyst nodes

#### Running in development mode

To run the service in development mode:

```bash
yarn build
yarn start
```

This will:
- Start the HTTP server on the port specified by `HTTP_SERVER_PORT` (defaults to 3000)
- Connect to the configured Ethereum network to fetch Catalyst nodes
- Begin serving realm information and hot scenes data

## Testing

This service includes comprehensive test coverage with unit tests.

### Running Tests

Run all tests with coverage:

```bash
yarn test
```

Run tests in watch mode:

```bash
yarn test --watch
```

### Test Structure

- **Unit Tests** (`test/unit/`): Test individual components and functions in isolation

For detailed testing guidelines and standards, refer to our [Testing Standards](https://github.com/decentraland/docs/tree/main/development-standards/testing-standards) documentation.

## AI Agent Context

For detailed AI Agent context, see [docs/ai-agent-context.md](docs/ai-agent-context.md).