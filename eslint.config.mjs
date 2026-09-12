// ESLint flat config for Next.js 16.
//
// Next.js 16 removed the built-in `next lint` command, so linting now runs
// through the ESLint CLI (`eslint .`, see package.json). eslint-config-next
// v16 ships native flat-config arrays, so we spread its shared presets
// directly: `next/core-web-vitals` (React + Next best practices, which also
// pulls in the base Next config) and `next/typescript` (TypeScript rules).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
