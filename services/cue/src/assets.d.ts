declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

declare module "*.woff2" {
  const data: ArrayBuffer;
  export default data;
}
