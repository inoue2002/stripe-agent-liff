import { NextResponse } from 'next/server';
import { StripeAgentToolkit } from '@stripe/agent-toolkit/openai';
import { ChatCompletionTool } from 'openai/resources/chat';

// ツールをフラットな構造に変換する関数
function flattenTools(tools: ChatCompletionTool[]): Array<{ function: { name: string, description: string, parameters: object } }> {
  return tools.map((tool) => {
    // descriptionがundefinedの場合は空文字列を設定
    const description = tool.function.description || '';
    
    // parametersがundefinedの場合は空のオブジェクトを設定
    const parameters = tool.function.parameters || {};
    
    return {
      function: {
        name: tool.function.name,
        description: description,
        parameters: parameters,
      }
    };
  });
}

const stripeAgentToolkit = new StripeAgentToolkit({
  secretKey: process.env.STRIPE_SECRET_KEY!,
  configuration: {
    actions: {
      paymentLinks: {
        create: true,
      },
      products: {
        create: true,
      },
      prices: {
        create: true,
      },
    },
  },
});

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set');
}

export async function GET() {
  try {
    console.log('--------------------------------');
    console.log(stripeAgentToolkit.getTools());
    console.log('--------------------------------');
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'verse',
        modalities: ['text', 'audio'],
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        temperature: 0.8,
        instructions: 'あなたはカフェの定員です。日本語で喋って。',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 200,
          create_response: true,
          interrupt_response: true,
        },
        tools: flattenTools(stripeAgentToolkit.getTools()),
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Session response:', data);

    // OpenAIからのレスポンスをそのまま返す
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to create realtime session:', error);
    return NextResponse.json({ error: 'Failed to create realtime session' }, { status: 500 });
  }
}
