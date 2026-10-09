import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "scripts/whatsapp-polls/node_modules/**",
      ".cursor/**",
      ".claude/**",
      ".windsurf/**",
      ".agents/**",
    ],
  },
];

export default eslintConfig;
