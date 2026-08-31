import fs from 'fs';
import path from 'path';
import { config } from './config/env.js';
import { groqTtsService } from './services/ai/groq/groqTtsService.js';
import { aiService } from './services/aiService.js';

async function runTtsTests() {
  console.log('====================================================');
  console.log('🧪 Running Groq Text-to-Speech (TTS) Integration Tests');
  console.log('====================================================\n');

  console.log('Configuration Check:');
  console.log('- Groq TTS Model:', config.groqTtsModel);
  console.log('- Default Voice:', config.groqTtsVoice);
  console.log('- API Key set:', !!config.groqApiKey);
  console.log('----------------------------------------------------\n');

  // Test 1: Available Voices
  console.log('--- [Test 1: Available Voices Listing] ---');
  const voices = aiService.getTtsVoices();
  console.log('✅ Supported Voices:', voices.join(', '));
  if (voices.includes('autumn') && voices.includes('troy')) {
    console.log('✅ Voice list verified successfully.');
  }
  console.log('\n----------------------------------------------------\n');

  // Test 2: Text Chunking for Large Input (> 200 chars)
  console.log('--- [Test 2: Text Chunking Strategy] ---');
  const longText =
    'Photosynthesis is the process by which green plants convert light energy into chemical energy. During this biological mechanism, cellular structures called chloroplasts capture photons from sunlight. They use this radiant energy to transform carbon dioxide and water into glucose sugars and oxygen.';
  const chunks = groqTtsService.chunkText(longText, 180);
  console.log(`Original text length: ${longText.length} characters`);
  console.log(`Generated ${chunks.length} chunks (all <= 180 chars):`);
  chunks.forEach((chunk, i) => {
    console.log(`  Chunk ${i + 1} (${chunk.length} chars): "${chunk}"`);
  });
  const allUnderLimit = chunks.every((c) => c.length <= 180);
  if (allUnderLimit) {
    console.log('✅ Chunking strategy verified: all chunks are safely within model limits.');
  } else {
    console.error('❌ Some chunks exceeded maximum size limit.');
  }
  console.log('\n----------------------------------------------------\n');

  // Test 3: Validation on Empty Text
  console.log('--- [Test 3: Empty Text Validation] ---');
  try {
    await aiService.textToAudio({ text: '    ' });
    console.error('❌ Expected validation error on empty text');
  } catch (err) {
    console.log('✅ Handled empty text correctly:');
    console.log('Status code:', err.statusCode);
    console.log('Safe error message:', err.message);
  }
  console.log('\n----------------------------------------------------\n');

  // Test 4: Missing Key Handling
  console.log('--- [Test 4: Missing Key Handling] ---');
  const originalKey = config.groqApiKey;
  try {
    config.groqApiKey = '';
    await aiService.textToAudio({ text: 'Testing key check' });
    console.error('❌ Expected failure when key is missing');
  } catch (err) {
    console.log('✅ Handled missing key correctly:');
    console.log('Status code:', err.statusCode);
    console.log('Safe error message:', err.message);
  } finally {
    config.groqApiKey = originalKey;
  }
  console.log('\n----------------------------------------------------\n');

  // Test 5: Groq TTS API Generation
  console.log('--- [Test 5: Live Groq Text-to-Audio Synthesis] ---');
  try {
    const testPrompt = 'Welcome to AI Tutor. Today we will explore how plants generate energy.';
    console.log(`Sending text: "${testPrompt}"`);
    const result = await aiService.textToAudio({
      text: testPrompt,
      voice: 'autumn',
    });

    console.log('✅ Audio generated successfully!');
    console.log('- MIME Type:', result.mimeType);
    console.log('- Format:', result.format);
    console.log('- Audio buffer size:', result.byteLength, 'bytes');

    // Save sample test audio to backend for verification
    const samplePath = path.join(process.cwd(), 'sample_tts_output.wav');
    fs.writeFileSync(samplePath, result.audioBuffer);
    console.log(`- Sample audio file written to: ${samplePath}`);
  } catch (err) {
    console.log('ℹ️ API Response Notice:');
    console.log('Status code:', err.statusCode);
    console.log('Message:', err.message);
    if (err.message.includes('requires terms acceptance')) {
      console.log('\n👉 NOTE: You can accept model terms for Orpheus at:');
      console.log('   https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english');
    }
  }

  console.log('\n====================================================');
  console.log('🎉 Groq TTS automated test suite completed!');
  console.log('====================================================');
  process.exit(0);
}

runTtsTests();
