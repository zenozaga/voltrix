// import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// import { createTestServer, closeTestServer, TestServer } from './test-utils.js';

// describe('Voltrix Renderer Integration', () => {
//   let server: TestServer;

//   beforeEach(async () => {
//     server = await createTestServer();
//   });

//   afterEach(async () => {
//     await closeTestServer(server);
//   });

//   it('should render a view with layout through Response.render()', async () => {
//     const app = server.app;

//     // Register engines
//     app.viewEngine('html', (file, data) => `<h1>${data.title}</h1>`);
//     app.viewEngine('layout.html', (file, data) => `<html><body>${data.body}</body></html>`);

//     // Set layout
//     app.viewSet('layout', 'layout.html');

//     // Route
//     app.get('/page', (req, res) => {
//       res.render('home.html', { title: 'Voltrix with Layout 2' });
//     });

//     const response = await fetch(`${server.baseURL}/page`);
//     const html = await response.text();

//     console.log('Rendered HTML:', html);

//     expect(response.status).toBe(200);
//     expect(html).toBe('<html><body><h1>Voltrix with Layout</h1></body></html>');

//     app.viewSet('layout', undefined);
//   });

// //   it('should apply beforeRender hook and override output', async () => {
// //     const app = server.app;

// //     app.viewEngine('html', (file, data) => `<h1>${data.title}</h1>`);

// //     app.viewBeforeRender(view => {
// //       if (view === 'cached.html') return '<h1>Cached Output</h1>';
// //     });

// //     app.get('/cached', (req, res) => res.render('cached.html', { title: 'Ignored' }));

// //     const response = await fetch(`${server.baseURL}/cached`);
// //     const html = await response.text();

// //     expect(html).toBe('<h1>Cached Output</h1>');
// //   });

// //   it('should apply afterRender hook to modify final output', async () => {
// //     const app = server.app;

// //     app.viewEngine('html', (file, data) => `<h1>${data.title}</h1>`);
// //     app.viewAfterRender(html => html.replace('Voltrix', 'Transformed'));

// //     app.get('/transform', (req, res) => res.render('page.html', { title: 'Voltrix' }));

// //     const response = await fetch(`${server.baseURL}/transform`);
// //     const html = await response.text();

// //     expect(html).toBe('<h1>Transformed</h1>');
// //   });

// //   it('should use onError when render engine fails', async () => {
// //     const app = server.app;

// //     app.viewEngine('fail.html', () => {
// //       throw new Error('Render failed');
// //     });

// //     app.viewSet('onError', (err, view) => `<error>${view}: ${err.message}</error>`);

// //     app.get('/fail', (req, res) => res.render('fail.html'));

// //     const response = await fetch(`${server.baseURL}/fail`);
// //     const html = await response.text();

// //     expect(html).toBe('<error>fail.html: Render failed</error>');
// //   });

// //   it('should inject helpers correctly', async () => {
// //     const app = server.app;

// //     app.viewSet('helpers', {
// //       upper: (v: string) => v.toUpperCase(),
// //     });

// //     app.viewEngine('html', (file, data) => `<p>${data.helpers.upper(data.name)}</p>`);

// //     app.get('/helper', (req, res) => res.render('name.html', { name: 'voltrix' }));

// //     const response = await fetch(`${server.baseURL}/helper`);
// //     const html = await response.text();

// //     expect(html).toBe('<p>VOLTRIX</p>');
// //   });

// //   it('should handle missing engine with proper error', async () => {
// //     const app = server.app;

// //     app.get('/unknown', (req, res) => res.render('unknown.xyz'));

// //     const response = await fetch(`${server.baseURL}/unknown`);
// //     expect(response.status).toBe(500);
// //     const text = await response.text();
// //     expect(text).toContain('No engine registered');
// //   });
// });
