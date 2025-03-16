import { NextResponse } from 'next/server';
import { StripeAgentToolkit } from '@stripe/agent-toolkit/openai';

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

export async function POST(request: Request) {
  try {
    const toolCall = await request.json();
    console.log('Received tool call:', toolCall);

    const result = await stripeAgentToolkit.handleToolCall(toolCall);
    console.log('Tool call result:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error handling tool call:', error);
    return NextResponse.json(
      { error: 'Failed to handle tool call' },
      { status: 500 }
    );
  }
}
