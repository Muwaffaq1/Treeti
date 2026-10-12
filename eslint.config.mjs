import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([...nextVitals, ...nextTs, globalIgnores(['.next/**', '.open-next/**', '**/.wrangler/**', 'src/modules/documents/fonts.generated.ts', 'node_modules/**', 'test-results/**', 'playwright-report/**', 'next-env.d.ts']), { rules: { 'react-hooks/set-state-in-effect': 'off' } }]);
