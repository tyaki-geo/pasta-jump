import { defineConfig } from 'vite';

// GitHub Pages (https://<user>.github.io/pasta-jump/) 配下で配信するため相対パスにする
export default defineConfig({
  base: './',
});
