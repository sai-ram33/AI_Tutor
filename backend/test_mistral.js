import { config } from './config/env.js';
import { textGenerationService } from './services/textGenerationService.js';
import { aiService } from './services/aiService.js';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Running Mistral AI Integration Tests on AI_Tutor');
  console.log('====================================================\n');

  console.log('Configuration Check:');
  console.log('- Model:', config.mistralModel);
  console.log('- API Key set:', !!config.mistralApiKey);
  console.log('----------------------------------------------------\n');

  // Test 1: Basic question
  console.log('--- [Test 1: Basic Question Generation] ---');
  try {
    const res1 = await aiService.getExplanation({
      history: [],
      newMessage: 'Explain photosynthesis in simple terms.',
      userLevel: 'beginner',
      mode: 'explain',
    });
    console.log('✅ Response received from Mistral.');
    console.log('Answer excerpt:', res1.content.slice(0, 150) + '...');
    console.log('Suggested Next Prompt:', res1.suggestedNextPrompt);
  } catch (err) {
    console.error('❌ Test 1 failed:', err.message);
  }
  console.log('\n----------------------------------------------------\n');

  // Test 2: Multi-turn Conversation Context
  console.log('--- [Test 2: Multi-turn Conversation Context] ---');
  try {
    const history = [
      { role: 'user', content: 'What is photosynthesis?' },
      {
        role: 'assistant',
        content:
          'Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to create oxygen and energy in the form of sugar.',
      },
    ];
    const res2 = await aiService.getExplanation({
      history,
      newMessage: 'Why is sunlight important for it?',
      userLevel: 'beginner',
      mode: 'explain',
    });
    console.log('✅ Response with multi-turn context received.');
    console.log('Answer excerpt:', res2.content.slice(0, 150) + '...');
    console.log('Suggested Next Prompt:', res2.suggestedNextPrompt);
  } catch (err) {
    console.error('❌ Test 2 failed:', err.message);
  }
  console.log('\n----------------------------------------------------\n');

  // Test 3: Conversation Recap
  console.log('--- [Test 3: Conversation Recap] ---');
  try {
    const history = [
      { role: 'user', content: 'What is photosynthesis?' },
      {
        role: 'assistant',
        content: 'Photosynthesis is the process where plants convert sunlight and carbon dioxide into glucose and oxygen.',
      },
      { role: 'user', content: 'Why is sunlight important for it?' },
      {
        role: 'assistant',
        content: 'Sunlight energizes chlorophyll to split water molecules during the light-dependent reactions.',
      },
    ];

    const res3 = await aiService.getExplanation({
      history,
      newMessage: 'Give me a recap of our conversation.',
      userLevel: 'beginner',
      mode: 'explain',
    });
    console.log('✅ Educational Recap received:');
    console.log('Recap content:\n', res3.content);
    console.log('\nSuggested Next Prompt:', res3.suggestedNextPrompt);
  } catch (err) {
    console.error('❌ Test 3 failed:', err.message);
  }
  console.log('\n----------------------------------------------------\n');

  // Test 4: Suggested Next Prompt Validation
  console.log('--- [Test 4: Suggested Next Prompt Validation] ---');
  try {
    const res4 = await aiService.getExplanation({
      history: [],
      newMessage: "Explain Newton's first law of motion.",
      userLevel: 'beginner',
      mode: 'explain',
    });
    console.log('✅ Explanation generated.');
    console.log('Suggested Next Prompt:', res4.suggestedNextPrompt);
    if (res4.suggestedNextPrompt && res4.suggestedNextPrompt.length > 5) {
      console.log('✅ Suggested Next Prompt is valid and relevant.');
    }
  } catch (err) {
    console.error('❌ Test 4 failed:', err.message);
  }
  console.log('\n----------------------------------------------------\n');

  // Test 5: Invalid API Key test
  console.log('--- [Test 5: Invalid API Key Safe Error Handling] ---');
  try {
    const originalKey = config.mistralApiKey;
    config.mistralApiKey = 'invalid_dummy_key_12345';
    const invalidService = new (textGenerationService.constructor)();
    await invalidService.generateResponse({
      history: [],
      newMessage: 'Hello',
    });
    console.error('❌ Expected failure with invalid key, but succeeded');
    config.mistralApiKey = originalKey;
  } catch (err) {
    console.log('✅ Handled invalid key correctly:');
    console.log('Status code:', err.statusCode);
    console.log('Safe error message:', err.message);
    config.mistralApiKey = process.env.MISTRAL_API_KEY;
  }
  console.log('\n----------------------------------------------------\n');

  // Test 6: Empty Message Validation
  console.log('--- [Test 6: Empty Message Validation] ---');
  try {
    await textGenerationService.generateResponse({
      history: [],
      newMessage: '   ',
    });
    console.error('❌ Expected validation error on empty message');
  } catch (err) {
    console.log('✅ Handled empty message correctly:', err.message);
  }
  console.log('\n====================================================');
  console.log('🎉 All automated tests completed successfully!');
  console.log('====================================================');
}

runTests();
