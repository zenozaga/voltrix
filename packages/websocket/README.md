# @voltrix/websocket

High-performance, programmatic-first and decorator-driven WebSocket package with pluggable adapters and distributed pub/sub for Voltrix.

## Features
- **Programmatic-First**: Full programmatic instanciation and routing support without decorators.
- **Ultra High-Performance**: Optimized for zero-allocation hot paths running directly on uWebSockets.js.
- **Pre-Upgrade Handshake validation**: Validate tokens and deny connection in HTTP Upgrade phase (zero TCP ws handle leakage).
- **Pluggable Pub/Sub Engine**: Local C++ uWS pub/sub or clustered Redis Pub/Sub out-of-the-box.
- **Decorator Gateways**: Optional elegant controllers mimicking high-level clean architectures.
