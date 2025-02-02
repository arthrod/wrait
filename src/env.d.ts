/// <reference types="vite/client" />

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string
  readonly VITE_API_ENDPOINT: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}