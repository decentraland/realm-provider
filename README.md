# Realm Provider 

[![Coverage Status](https://coveralls.io/repos/github/decentraland/realm-provider/badge.svg?branch=coverage)](https://coveralls.io/github/decentraland/realm-provider?branch=coverage)

The realm provider service offers a realm description ([ADR-110](https://adr.decentraland.org/adr/ADR-110)) detailing the services clients need to connect. It can select any Catalyst and Lambdas service from the Catalyst Network and provides access to the default MAIN realm, managed by the [Archipelago workers](https://github.com/decentraland/archipelago-workers), to direct users to a default location. 

## Development 

```bash
yarn
yarn build
yarn test
yarn start
```

## API 

| **Endpoint**      | **Method** | **Description** |
|-------------------|------------|-----------------|
| `/status`         | `GET`      | Returns the status of the service to ensure it's operational. |
| `/realms`         | `GET`      | Lists all available realms within the Catalyst Network. |
| `/hot-scenes`     | `GET`      | Retrieves information about the most popular scenes currently active. |
| `/main/about`     | `GET`      | Provides details about the default MAIN realm managed by the Archipelago workers. |

## AI Agent Context

**Service Purpose:** Provides realm configuration service for Decentraland clients. Implements ADR-110 realm descriptions, enabling clients to discover and connect to available Catalyst nodes, Lambdas services, and communication realms (like the MAIN Archipelago realm).

**Key Capabilities:**

- Lists available realms in the Catalyst Network
- Provides realm descriptions with service endpoints (Catalyst URLs, Lambdas URLs, comms configurations)
- Exposes hot scenes data (popular/active scenes) for client discovery
- Provides MAIN realm information for Archipelago workers connection
- Enables dynamic realm selection and load balancing across Catalyst nodes

**Communication Pattern:** Synchronous HTTP REST API

**Technology Stack:**

- Runtime: Node.js
- Language: TypeScript
- HTTP Framework: @well-known-components/http-server
- Component Architecture: @well-known-components (logger, metrics, http-server)

**External Dependencies:**

- Catalyst Network: Queries available Catalyst nodes for realm information
- Archipelago Workers: MAIN realm status and configuration
- Stats Service: Hot scenes data (from archipelago-workers stats service)

**Key Concepts:**

- **Realm**: A communication/render configuration specifying which Catalyst, Lambdas, and comms services to use
- **MAIN Realm**: Default realm managed by Archipelago workers for Genesis City
- **Hot Scenes**: Popular/active scenes for user discovery
