# AI Agent Context

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
