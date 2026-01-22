# Hyperfy ⚡️

<div align="center">
  <img src="overview.png" alt="Hyperfy Ecosystem" width="100%" />
  <p>
    <strong>Build, deploy, and experience interactive 3D virtual worlds</strong>
  </p>
</div>

## What is Hyperfy?

Hyperfy is an open-source framework for building interactive 3D virtual worlds. It combines a powerful physics engine, networked real-time collaboration, and a component-based application system to create immersive experiences that can be self-hosted or connected to the wider Hyperfy ecosystem.

## 🧬 Key Features

- **Standalone persistent worlds** - Host on your own domain
- **Realtime content creation** - Build directly in-world
- **Interactive app system** - Create dynamic applications with JavaScript
- **Portable avatars** - Connect via Hyperfy for consistent identity
- **Physics-based interactions** - Built on PhysX for realistic simulation
- **WebXR support** - Experience worlds in VR
- **Extensible architecture** - Highly customizable for various use cases

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/hyperfy-xyz/hyperfy)


## 🆕 Enhanced Features (Migrated from hyperfy/dojo)

### Web3 Integration

**StarkNet Support (Cartridge)**
- Cartridge Controller wallet integration
- Real StarkNet transaction execution
- Access via `world.web3` API in apps

**EVM Support (Ethereum)**
- MetaMask and other wallet integration via wagmi/viem
- ENS resolution with caching
- Real transaction execution
- Access via `world.evm` API in apps

### Advanced Camera System

**Realistic Camera Controls**
- Depth of field (DOF) with Bokeh effects
- Raycast-based autofocus
- Multiple camera presets (portrait, landscape, macro, standard)
- Programmatic focal length control (24-200mm)
- ADS (Aim Down Sights) zoom simulation
- Head bone tracking for avatar focus

**Focus System**
- Automatic focus on player head bones
- Reticle-based focus for objects
- Dynamic DOF adjustment based on zoom
- Smooth focus transitions

### Enhanced SkinnedMesh

**Bone Manipulation**
- `entity.getBone('name')` API for bone access
- Reactive position/quaternion/rotation/scale properties
- Direct matrixWorld manipulation
- Perfect for VRM avatar customization

**VRM Facial Expressions**
- Auto-blink with realistic timing (random intervals 2.5-5s)
- Viseme mouth animations for talking (aa, ee, ih, oh, ou)
- Manual expression control via `vrm.setExpression()`
- Talking state management via `vrm.setSpeaking()`
- Compatible with VRM 1.0 ExpressionManager and VRM 0.x expression nodes


## 🚀 Quick Start

### Prerequisites

- Node.js 22.11.0+ (via [nvm](https://github.com/nvm-sh/nvm) or direct install)

### Installation

```bash
# Clone the repository
git clone https://github.com/hyperfy-xyz/hyperfy.git my-world
cd my-world

# Copy example environment settings
cp .env.example .env

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Docker Deployment

For containerized deployment, check [DOCKER.md](DOCKER.md) for detailed instructions.

## 🧩 Use Cases

- **Virtual Events & Conferences** - Host live gatherings with spatial audio
- **Interactive Showrooms** - Create product displays and demos
- **Social Spaces** - Build community hubs for collaboration
- **Gaming Environments** - Design immersive game worlds
- **Educational Experiences** - Develop interactive learning spaces
- **Creative Showcases** - Display 3D art and interactive installations

## 📚 Documentation & Resources

- **[Community Documentation](https://docs.hyperfy.xyz)** - Comprehensive guides and reference
- **[Website](https://hyperfy.io/)** - Official Hyperfy website
- **[Sandbox](https://play.hyperfy.xyz/)** - Try Hyperfy in your browser
- **[Twitter/X](https://x.com/hyperfy_io)** - Latest updates and announcements

## 📏 Project Structure

```
docs/              - Documentation and references
src/
  client/          - Client-side code and components
  core/            - Core systems (physics, networking, entities)
  server/          - Server implementation
CHANGELOG.md       - Version history and changes
```

## 🛠️ Development

### Key Commands

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start

# Clean orphaned assets (experimental)
npm run world:clean

# Viewer only (development)
npm run viewer:dev

# Client only (development)
npm run client:dev

# Linting
npm run lint
npm run lint:fix
```

## 🖊️ Contributing

Contributions are welcome! Please check out our [contributing guidelines](CONTRIBUTING.md) and [code of conduct](CODE_OF_CONDUCT.md) before getting started.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a pull request

## 🌱 Project Status

This project is still in alpha as we transition all of our [reference platform](https://github.com/hyperfy-xyz/hyperfy-ref) code into fully self hostable worlds.
Most features are already here in this repo but still need to be connected up to work with self hosting in mind.
Note that APIs are highly likely to change during this time.
