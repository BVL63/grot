import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({
  base:'/grot/',
  build:{rollupOptions:{input:{
    main:resolve(process.cwd(),'index.html'),
    v2preview:resolve(process.cwd(),'v2-preview.html')
  }}}
});
