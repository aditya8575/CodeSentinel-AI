import { Router } from "express";
import specYaml from "../../../../lib/api-spec/openapi.yaml";

const router = Router();

router.get("/openapi.yaml", (_req, res) => {
  res.setHeader("Content-Type", "text/yaml; charset=utf-8");
  res.send(specYaml);
});

router.get("/docs", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeSentinel AI — API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f1117; font-family: system-ui, sans-serif; }

    #topbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 24px;
      background: #161b22;
      border-bottom: 1px solid #30363d;
    }
    #topbar svg { color: #00d4ff; flex-shrink: 0; }
    #topbar span { font-size: 18px; font-weight: 700; color: #00d4ff; letter-spacing: -0.3px; }
    #topbar a {
      margin-left: auto;
      font-size: 13px;
      color: #8b949e;
      text-decoration: none;
    }
    #topbar a:hover { color: #c9d1d9; }

    #swagger-ui { max-width: 1200px; margin: 0 auto; padding: 24px 16px 64px; }

    .swagger-ui .topbar { display: none !important; }

    .swagger-ui { color: #c9d1d9 !important; }
    .swagger-ui .info h2.title,
    .swagger-ui .info .title { color: #e6edf3 !important; }
    .swagger-ui .info .description p { color: #8b949e !important; }
    .swagger-ui .opblock-tag { color: #e6edf3 !important; border-bottom-color: #30363d !important; }
    .swagger-ui .opblock { border-radius: 8px !important; border: 1px solid #30363d !important; margin-bottom: 8px !important; background: #161b22 !important; }
    .swagger-ui .opblock .opblock-summary { border-radius: 7px !important; }
    .swagger-ui .opblock.opblock-get .opblock-summary { background: rgba(0,112,201,0.08) !important; }
    .swagger-ui .opblock.opblock-post .opblock-summary { background: rgba(73,204,144,0.08) !important; }
    .swagger-ui .opblock.opblock-delete .opblock-summary { background: rgba(249,62,62,0.08) !important; }
    .swagger-ui .opblock .opblock-summary-description { color: #8b949e !important; }
    .swagger-ui .opblock-body { background: #0d1117 !important; }
    .swagger-ui .model-box { background: #161b22 !important; border-radius: 6px !important; }
    .swagger-ui section.models { border: 1px solid #30363d !important; border-radius: 8px !important; }
    .swagger-ui section.models h4 { color: #e6edf3 !important; }
    .swagger-ui .scheme-container { background: #161b22 !important; box-shadow: none !important; border-bottom: 1px solid #30363d !important; }
    .swagger-ui .btn.execute { background: #238636 !important; border-color: #2ea043 !important; border-radius: 6px !important; }
    .swagger-ui .btn.execute:hover { background: #2ea043 !important; }
    .swagger-ui input, .swagger-ui textarea, .swagger-ui select { background: #0d1117 !important; color: #c9d1d9 !important; border-color: #30363d !important; border-radius: 6px !important; }
    .swagger-ui .response-col_status { color: #e6edf3 !important; }
    .swagger-ui table thead tr th { color: #8b949e !important; border-color: #30363d !important; }
    .swagger-ui table tbody tr td { border-color: #21262d !important; color: #c9d1d9 !important; }
    .swagger-ui .parameter__name { color: #79c0ff !important; }
    .swagger-ui .parameter__type { color: #7ee787 !important; }
    .swagger-ui .prop-type { color: #7ee787 !important; }
    .swagger-ui .prop-format { color: #ffa657 !important; }
    .swagger-ui .renderedMarkdown p { color: #8b949e !important; }
    .swagger-ui .microlight { background: #0d1117 !important; color: #c9d1d9 !important; border-radius: 6px !important; }
    .swagger-ui .highlight-code { background: #0d1117 !important; border-radius: 6px !important; }
    .swagger-ui .responses-wrapper { background: #0d1117 !important; }
    .swagger-ui .response-body pre { background: #0d1117 !important; }
    .swagger-ui .model-title { color: #e6edf3 !important; }
    .swagger-ui .model { color: #c9d1d9 !important; }
    .swagger-ui .info { margin: 20px 0 !important; }
    .swagger-ui .info .base-url { color: #8b949e !important; }
    .swagger-ui .servers > label select { background: #0d1117 !important; color: #c9d1d9 !important; }
    .swagger-ui .opblock-tag-section { margin-bottom: 16px !important; }
    .swagger-ui .arrow { fill: #8b949e !important; }
    .swagger-ui .markdown code, .swagger-ui .renderedMarkdown code { background: #161b22 !important; color: #ffa657 !important; border-radius: 3px !important; padding: 2px 5px !important; }
  </style>
</head>
<body>
  <div id="topbar">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
    <span>CodeSentinel AI</span>
    <a href="/">← Back to app</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/api/openapi.yaml",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
      filter: true,
      syntaxHighlight: { activated: true, theme: "agate" },
    });
  </script>
</body>
</html>`);
});

export default router;
