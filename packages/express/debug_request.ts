import { Request } from './src/http/request.js';

async function test() {
  const req = new Request();
  console.log('Constructor context:', req.context);
  
  (req as any).initialize({}, {}, '/test', new Map(), 'GET', '/test');
  console.log('Post-init context:', req.context);
  
  req.context.foo = 'bar';
  console.log('Modified context:', req.context);
  
  (req as any).initialize({}, {}, '/test2', new Map(), 'GET', '/test2');
  console.log('Re-init context (should be empty):', req.context);
}

test().catch(console.error);
