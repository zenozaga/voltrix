import voltrix from './voltrix.js';
import { App } from 'uWebSockets.js';

const response = (username?: string) => ({
  message: `Hello, ${username}!`,
  timestamp: Date.now(),
});

async function voltrixApp() {
  const app = voltrix();

  app.get('/user', (req, res) => {
    res.json(response('World'));
  });

  app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
  });
}

async function uwsApp() {
  const uwsApp = App();

  uwsApp.get('/user', (res, req) => {
    res.end(JSON.stringify(response(req.getParameter(0))));
  });

  uwsApp.listen(3000, token => {
    if (token) {
      console.log('Server is running on http://localhost:3000');
    } else {
      console.error('Failed to start server');
    }
  });
}

voltrixApp().catch(err => console.error(err));
