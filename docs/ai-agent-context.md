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

**Scope and Responsibilities — What Realm Provider Is NOT:**

The Realm Provider is intentionally a very lightweight service. Its sole responsibility is to describe the set of services a client needs to connect to: which content server to use, which Lambdas URL, and which comms configuration. It is a **description layer**, not an execution layer.

- **Not a gatekeeper**: The Realm Provider does not grant or deny access to LiveKit rooms. It has no role in comms access control. Deciding who can connect to a LiveKit room is the responsibility of comms-gatekeeper (for Genesis City scenes) and the Worlds Content Server (for Worlds).
- **Not a comms authority**: It does not issue tokens, validate users, or manage room lifecycles. It only tells the client *where* to go, not *whether* it is allowed in.
- **Stateless and thin**: The Realm Provider holds no meaningful state of its own. It aggregates and exposes configuration from other services (Catalyst nodes, Archipelago workers) and serves it to clients in a standardized ADR-110 format.
