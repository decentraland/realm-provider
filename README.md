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
  - [Deployment](#deployment)
- [Testing](#testing)
- [AI Agent Context](#ai-agent-context)

## Features

- **Realm Discovery & Selection**: Discover all available Catalyst realms with real-time user counts, automatic health monitoring, and filtering of catalyst nodes
- **Geo-Location Optimization**: Intelligent content server selection based on user geographic location using Cloudflare's CF-IPCountry header and Haversine distance calculation to route users to the nearest healthy Catalyst node
- **Hot Scenes Tracking**: Real-time list of the most popular scenes, proxied from comms-gatekeeper's presence map
- **Main Realm Services**: Comprehensive service information for the main realm managed by Archipelago Workers, including content server, communications, BFF, and Lambdas configurations
- **Catalyst Version Filtering**: Automatic filtering to prefer updated Catalyst nodes over outdated versions
- **Health Monitoring**: Service status and version information with health check endpoints for integration monitoring
- **Smart Caching**: LRU cache implementation for Catalyst DAO queries to optimize performance

## Dependencies & Related Services

This service interacts with the following services:

- **[Catalyst Network](https://github.com/decentraland/catalyst)**: Queries available Catalyst nodes for realm information, health status, and user counts via the `/about` endpoint
- **[Archipelago Workers](https://github.com/decentraland/archipelago-workers)**: Runs the ws-connector that clients are pointed at as the MAIN realm's comms adapter
- **Pulse**: The only source of online-player information — `/realms` (the `main` entry's `peers`) for the MAIN realm user count and `/health` for its liveness
- **[comms-gatekeeper](https://github.com/decentraland/comms-gatekeeper)**: Computes `/hot-scenes` from its presence map; this service proxies it, adding the MAIN realm to each entry's `realms` distribution
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
Use the `.env.default` variables as an example.

#### Online-player information

Pulse and comms-gatekeeper are the only sources of online-player information: there is no
configurable presence source, no fallback and no shadow mode. `PULSE_URL` and
`COMMS_GATEKEEPER_URL` are required at boot (an absolute `http(s)` URL); startup fails immediately
when either is missing or malformed, rather than answering 500s per request once traffic arrives.
Rollback is deploying the previous image, which requires archipelago-stats to still be running (see
[Deployment](#deployment) below).

| Variable | Default | Description |
| --- | --- | --- |
| `PULSE_URL` | _(none — required)_ | `/realms` gives the MAIN realm user count (the `main` entry's `peers`; 0 when absent), `/health` gives its liveness (200 == healthy). Both reads share one 5 s deadline; past it the realm is reported unhealthy with 0 users. |
| `COMMS_GATEKEEPER_URL` | `https://comms-gatekeeper.decentraland.org` | `/hot-scenes` is proxied (5 s deadline, 10 s cache). |
| `ARCHIPELAGO_WS_CONNECTOR_URL` | `https://archipelago-ws-connector.decentraland.org` | Advertised to clients as the MAIN realm comms adapter. Unrelated to online-player counts. |

`GET /hot-scenes` proxies `${COMMS_GATEKEEPER_URL}/hot-scenes`. Every field the gatekeeper answers
passes through untouched, and this service adds the `realms` distribution its own contract carries —
a single entry for the MAIN realm with the scene's `usersTotalCount`, which is what `places` reads.
The upstream call has a 5 second deadline that covers the body read as well as the headers;
successful answers are cached for 10 seconds, and requests that arrive during a cache miss share one
upstream call instead of each making their own.

While the gatekeeper is warming (`503`) or unreachable, a cached array younger than 60 seconds is
served with an `X-Cache: stale` header (and a warning log). Beyond that age the upstream status is
passed on instead of a stale list: a `503 {"ok":false,"error":"warming"}` reaches the client as it
came, while a connection failure or an elapsed deadline becomes this service's own `503`. A 2xx
whose body is not an array is treated as one of these failures too — it is never cached and never
passed through, so the client gets the stale list if there is one and a `502` otherwise.

The cache lives in the process, so it is empty after every restart or redeploy: the first
`/hot-scenes` request of a fresh process always pays the upstream call, and if the gatekeeper is
warming or unreachable at that moment there is no stale list to fall back to yet — that request
gets the `503`. Serving a stale list also costs the full 5 second deadline, because the cache is
only consulted after the upstream attempt has failed.

### Running the Service

#### Setting up the environment

The Realm Provider is a lightweight, stateless service with minimal external dependencies. Unlike other services in the ecosystem, it does not require local databases or message brokers.

#### Running in development mode

To run the service in development mode:

```bash
yarn build
yarn start
```

### Deployment

Deploy this service only after comms-gatekeeper is serving `/hot-scenes` from its presence map and
Pulse's HTTP surface (`/realms`, `/health`) is up in the target environment. Deploying before that
does not degrade gracefully to zeros: `/hot-scenes` answers `503` (there is nothing cached yet),
`main` is missing from `/realms` entirely (it is only listed while healthy), and `/main/about`
answers `acceptingUsers: false` — a client reads that as "do not connect to this realm", not
"nobody is online here".

Rollback is deploying the previous image. That image aggregates online-player information from
archipelago-stats, so archipelago-stats must still be running in the target environment for a
rollback to serve real data.

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