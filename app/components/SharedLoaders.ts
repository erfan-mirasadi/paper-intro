import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

let ktx2Loader: KTX2Loader | null = null;
let dracoLoader: DRACOLoader | null = null;

export function getSharedKTX2Loader(gl: any): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath(
      "https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/jsm/libs/basis/"
    );
    ktx2Loader.detectSupport(gl);
  }
  return ktx2Loader;
}

export function getSharedDRACOLoader(): DRACOLoader {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
  }
  return dracoLoader;
}
