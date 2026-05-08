"use client";

import { useMemo, useEffect, useState, useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";

const gltfCache = new Map();

let ktx2Loader: KTX2Loader | null = null;
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");

function PlaceholderMesh() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshBasicMaterial color="#444" wireframe opacity={0.2} transparent />
    </mesh>
  );
}

interface RealModelProps {
  url: string;
  productTitle: string;
  onLoad?: () => void;
}

export default function RealModel({
  url,
  productTitle,
  onLoad,
}: RealModelProps) {
  const gl = useThree((state) => state.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    // Check Cache
    if (gltfCache.has(url)) {
      console.log(`⚡ FROM CACHE: ${productTitle}`);
      Promise.resolve().then(() => {
        if (isMounted) {
          setScene(gltfCache.get(url));
        }
      });
      return;
    }

    console.log(`⬇️ DOWNLOADING: ${productTitle} from ${url}`);
    const loader = new GLTFLoader();
    
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    loader.setDRACOLoader(draco);
    
    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }

    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath("https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/jsm/libs/basis/");
    ktx2.detectSupport(gl);
    loader.setKTX2Loader(ktx2);

    loader.load(
      url,
      (gltf) => {
        if (!isMounted) return;
        console.log(`✅ LOADED: ${productTitle}`);
        gltfCache.set(url, gltf.scene);
        setScene(gltf.scene);
      },
      (progress) => {
        if (progress.total > 0) {
          console.log(`⏳ LOADING ${productTitle}: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
        }
      },
      (err) => {
        if (!isMounted) return;
        console.error(`❌ Error loading ${productTitle}:`, err);
        setError(err);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [url, gl, productTitle]);

  // Handle Side Effects (Scene Prep)
  useLayoutEffect(() => {
    if (scene && onLoad) {
      onLoad();
    }
  }, [scene, onLoad]);

  const clone = useMemo(() => {
    if (!scene) return null;
    const c = scene.clone();
    c.traverse((obj: any) => {
      if (obj.isMesh) {
        console.log(`Mesh found: ${obj.name}`);
        obj.castShadow = true;
        obj.receiveShadow = true;
        
        if (obj.material) {
          const originalMap = obj.material.map;
          if (originalMap) {
            const clonedMap = originalMap.clone();
            clonedMap.needsUpdate = true;
            clonedMap.anisotropy = gl.capabilities.getMaxAnisotropy();

            obj.material = new THREE.MeshBasicMaterial({
              map: clonedMap,
              color: obj.material.color,
              transparent: true,
              opacity: obj.material.transmission > 0 ? Math.max(0.6, 1.0 - obj.material.transmission) : obj.material.opacity,
              side: obj.material.side,
              alphaTest: obj.material.alphaTest || 0.1,
            });
          } else {
            obj.material = new THREE.MeshBasicMaterial({
              color: obj.material.color,
              transparent: obj.material.transparent,
              opacity: obj.material.transmission > 0 ? Math.max(0.6, 1.0 - obj.material.transmission) : obj.material.opacity,
              side: obj.material.side,
            });
          }
          obj.material.needsUpdate = true;
        }
      }
    });
    return c;
  }, [scene, gl]);

  // Clean up cloned materials and textures when this component unmounts
  useEffect(() => {
    return () => {
      if (clone) {
        clone.traverse((obj: any) => {
          if (obj.isMesh && obj.material) {
            // Dispose of the texture if a map exists
            if (obj.material.map) {
              obj.material.map.dispose();
            }
            // Dispose of the top-level material
            obj.material.dispose();
          }
        });
      }
    };
  }, [clone]);

  if (error) return <PlaceholderMesh />;
  if (!clone) return <PlaceholderMesh />;

  return <primitive object={clone} />;
}
