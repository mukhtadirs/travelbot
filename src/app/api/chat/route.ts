import OpenAI from 'openai';
import { NextRequest } from 'next/server';
import { getSystemPrompt } from '@/lib/systemPrompt';

export const runtime = 'edge';

function toErrorResponse(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return toErrorResponse('Server misconfiguration: OPENAI_API_KEY missing', 500);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    return toErrorResponse('Invalid JSON');
  }

  const { messages, model } = (body ?? {}) as {
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    model?: string;
  };

  if (!Array.isArray(messages)) {
    return toErrorResponse('messages must be an array');
  }

  const client = new OpenAI({ apiKey });

  const system = getSystemPrompt();
  const finalMessages = [
    { role: 'system' as const, content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  const preferredModel = model || process.env.OPENAI_MODEL || 'gpt-5';
  const fallbackModel = process.env.OPENAI_FALLBACK_MODEL || 'gpt-4o-mini';

  async function streamWithModel(modelToUse: string) {
    const stream = await client.chat.completions.create({
      model: modelToUse,
      messages: finalMessages,
      stream: true,
      temperature: 0.7,
    });

    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices?.[0]?.delta?.content ?? '';
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch (e) {
          controller.error(e);
        } finally {
          controller.close();
        }
      },
    });
  }

  try {
    const readable = await streamWithModel(preferredModel);
    return new Response(readable, {
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (err: any) {
    const message = err?.message || String(err);
    // Try fallback on model errors (e.g., not found / not available)
    if (preferredModel !== fallbackModel) {
      try {
        const readable = await streamWithModel(fallbackModel);
        return new Response(readable, {
          headers: {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
            'x-model-fallback': fallbackModel,
          },
        });
      } catch (e: any) {
        console.error('OpenAI fallback failed:', e?.message || e);
      }
    }
    console.error('OpenAI error:', message);
    return toErrorResponse(`OpenAI error: ${message}`, 500);
  }
}


