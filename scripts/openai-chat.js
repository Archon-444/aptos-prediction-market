#!/usr/bin/env node

const OpenAI = require('openai');

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY. Export it or put it in your environment.');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const prompt = process.argv.slice(2).join(' ') || 'Write a Move function to add two u64 numbers.';

  try {
    const res = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'You are a concise, accurate coding assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2
    });

    const output = res.choices?.[0]?.message?.content || '';
    process.stdout.write(output + '\n');
  } catch (err) {
    console.error('OpenAI API error:', err?.message || err);
    process.exit(1);
  }
}

main();
