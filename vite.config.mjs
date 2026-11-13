import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({
  // Relative asset paths work both under GitHub Pages /grot/ and Netlify preview root.
  base:'./',
  build:{rollupOptions:{input:{
    main:resolve(process.cwd(),'index.html'),
    v2preview:resolve(process.cwd(),'v2-preview.html')
  }}}
});
