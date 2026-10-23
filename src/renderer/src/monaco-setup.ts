import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// Enforce local bundling of Monaco Editor (SEC-002: Zero remote CDN calls, 100% offline self-hosted)
loader.config({ monaco });

export { monaco };
