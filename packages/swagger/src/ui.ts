import { IRequest, IResponse } from '@voltrix/core';

export const swaggerUi = (spec: any, path: string = '/docs') => {
  const jsonPath = `${path}/openapi.json`.replace(/\/+/g, '/');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Swagger UI</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle({
                url: '${jsonPath}',
                dom_id: '#swagger-ui',
            });
        };
    </script>
</body>
</html>
`;

  return (req: IRequest, res: IResponse, next: () => void) => {
    const url = req.url;
    if (url === path || url === `${path}/`) {
      return res.type('text/html').send(html);
    }
    if (url === jsonPath) {
      return res.json(spec);
    }
    next();
  };
};
