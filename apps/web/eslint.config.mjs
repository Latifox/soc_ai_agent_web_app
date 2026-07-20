import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * Next.js 16 ships native ESLint flat configs — spread them directly.
 * `typescript` already supplies the global ignores (.next, out, build,
 * next-env.d.ts) and the TypeScript parser/rules.
 */
const eslintConfig = [...nextCoreWebVitals, ...nextTypeScript];

export default eslintConfig;
