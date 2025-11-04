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

For detailed AI Agent context, see [docs/ai-agent-context.md](docs/ai-agent-context.md).