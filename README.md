# 🌌 Paper Intro: Interactive 3D Experience

A high-performance, cinematic 3D landing page built with **Next.js**, **Three.js**, and **Tailwind CSS 4**. This project features scroll-driven animations, advanced atmospheric effects, and optimized 3D model rendering for a premium web experience.

## ✨ Features

- **🎬 Scroll-Driven Storytelling**: Seamless camera transitions and object animations synchronized with the user's scroll progress.
- **🌫️ Atmospheric Effects**: Custom particle systems for mist and clouds, creating a deep, immersive environment.
- **☀️ Cinematic Lighting**: Implementation of sun beams, environmental lighting (IBL), and high-fidelity shadow mapping.
- **🚀 Performance Optimized**: 
  - Support for **Draco** and **Meshopt** compression.
  - **KTX2** texture transcoder support for reduced GPU memory usage.
  - Efficient asset caching and lazy loading.
- **🎨 Premium UI**: Minimalist, responsive overlay built with Tailwind CSS 4, featuring glassmorphism and modern typography.

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **3D Engine**: [Three.js](https://threejs.org/)
- **React Integration**: [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) & [@react-three/drei](https://github.com/pmndrs/drei)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **State/Math**: [Maath](https://github.com/pmndrs/maath) & [Leva](https://github.com/pmndrs/leva)

## 🚀 Getting Started

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd paper-intro
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **View the project:**
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

- `app/`: Next.js routes and main entry point.
- `app/components/`: Modular React Three Fiber components (Models, Skybox, Particles, Camera logic).
- `public/`: 3D models (`.glb`), textures, and static assets.

---

Built with ❤️ for high-end web experiences.

