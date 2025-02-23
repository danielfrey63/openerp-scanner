/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OPENERP_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const OPENERP_BASE_URL: string;
