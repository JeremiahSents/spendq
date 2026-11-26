# spendq


This is a Next.js template with shadcn/ui.

## SpendIQ AI

Set `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local` and restart the local server. For a Vercel deployment, set the same server-side variable in the project settings.

`GEMINI_MODEL` optionally overrides the default `gemini-3.7-flash` model. Copilot uses the AI SDK Google provider to send the question and a summary of the selected workspace directly to Google. The drawer uses built-in demo answers when the key is missing or Google AI is unavailable.

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
