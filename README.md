# spendq


This is a Next.js template with shadcn/ui.

## SpendIQ AI

Set `AI_GATEWAY_API_KEY` in `.env.local` and restart the local server. For a Vercel deployment, set it in the project's environment variables. The key stays on the server.

`AI_GATEWAY_MODEL` optionally overrides the default `google/gemini-2.5-flash` model. The Copilot sends the question and a summary of the selected workspace to AI Gateway. When no key is configured or the gateway is unavailable, the drawer shows its built-in demo answers.

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button";
```
