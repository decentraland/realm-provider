# Realm Provider

[![Coverage Status](https://coveralls.io/repos/github/decentraland/realm-provider/badge.svg?branch=main)](https://coveralls.io/github/decentraland/realm-provider?branch=main)

The Realm Provider service is a central gateway for Decentraland clients that provides intelligent realm discovery, real-time scene popularity tracking, and geo-optimized content delivery. It implements [ADR-110](https://adr.decentraland.org/adr/ADR-110) realm descriptions, enabling clients to discover and connect to the optimal Catalyst nodes, Lambdas services, and communication realms.

This server interacts with the Catalyst Network, Archipelago Workers, and the Catalyst DAO smart contract to provide users with optimal realm selection based on geographic location, node health, and current capacity.

## Table of Contents

- [Realm Provider](#realm-provider)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Dependencies \& Related Services](#dependencies--related-services)
  - [API Documentation](#api-documentation)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Configuration](#configuration)
      - [Available Environment Variables](#available-environment-variables)
      - [Example Configuration](#example-configuration)
    - [Running the Service](#running-the-service)
      - [Setting up the environment](#setting-up-the-environment)
      - [Running in development mode](#running-in-development-mode)
  - [Testing](#testing)
    - [Running Tests](#running-tests)
    - [Test Structure](#test-structure)
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

#### Available Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ETH_NETWORK` | Ethereum network to use for querying the Catalyst DAO contract | `mainnet` | No |
| `CATALYST_OVERRIDE` | Semicolon-separated list of catalyst URLs to use instead of querying the DAO contract. Useful for staging/testing environments. | - | No |
| `BLACKLISTED_CATALYST` | Semicolon-separated list of catalyst URLs to exclude from the available catalysts | - | No |
| `CONTENT_URL` | Content server URL for fetching scene metadata | `https://peer.decentraland.org/content/` | No |
| `HTTP_BASE_URL` | Base URL for the service (used for constructing URLs in responses) | Inferred from request | No |
| `COMMIT_HASH` | Git commit hash of the deployed version | - | No |
| `CURRENT_VERSION` | Current service version | - | No |

#### Example Configuration

**Production (using DAO contract):**
```bash
ETH_NETWORK=mainnet
CONTENT_URL=https://peer.decentraland.org/content/
```

**Staging (using hardcoded catalysts):**
```bash
CATALYST_OVERRIDE=https://peer-stg1.decentraland.zone;https://peer-stg2.decentraland.zone;https://peer-stg3.decentraland.zone
CONTENT_URL=https://peer-stg1.decentraland.zone/content/
```

**Development (testing specific catalysts):**
```bash
CATALYST_OVERRIDE=https://peer.decentraland.zone
BLACKLISTED_CATALYST=https://peer-old.decentraland.org
ETH_NETWORK=sepolia
```

### Running the Service

#### Setting up the environment

The Realm Provider is a lightweight, stateless service with minimal external dependencies. Unlike other services in the ecosystem, it does not require local databases or message brokers.

#### Running in development mode

To run the service in development mode:

```bash
yarn build
yarn start
```

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