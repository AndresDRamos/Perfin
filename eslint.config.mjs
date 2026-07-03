// eslint-config-next 16 ships flat configs; FlatCompat chokes on them (circular
// structure in the legacy validator), so import them directly.
import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [...coreWebVitals, ...typescript];

export default eslintConfig;
