import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Luvvyremovebg/',
  plugins: [
    {
      name: 'fix-imgly-background-removal-import',
      transform(code, id) {
        if (!id.endsWith('/src/main.js')) return null;
        return code.replace(
          "import removeBackground from '@imgly/background-removal';",
          "import { removeBackground } from '@imgly/background-removal';"
        );
      }
    }
  ],
  build: {
    target: 'es2022',
    sourcemap: true
  }
});
