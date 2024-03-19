require('colors');
const EventEmitter = require('events');
const Groq = require("groq-sdk");
const tools = require('../functions/function-manifest');
const { assistant } = require('./prompts');

// Import all functions included in the function manifest
const availableFunctions = {};
tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
});

class GptService extends EventEmitter {
  constructor() {
    super();
    this.groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
    this.userContext = [
      { 'role': 'system', 'content': assistant },
      { 'role': 'assistant', 'content': 'Hello! I understand you\'re looking for a pair of AirPods, is that correct?' },
    ];
    this.partialResponseIndex = 0;
  }

  setCallSid(callSid) {
    // Ensures call SID is part of the conversation context for reference
    this.userContext.push({ 'role': 'system', 'content': `callSid: ${callSid}` });
  }

  updateUserContext(name, role, text) {
    // Adds new messages to the conversation context, preserving the history
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    // Update the conversation context with the latest interaction
    this.updateUserContext(name, role, text);

    try {
      // Generate a response using Groq with the entire conversation context
      const completion = await this.groq.chat.completions.create({
        messages: this.userContext,
        model: "mixtral-8x7b-32768", // Specify the Groq model
      });

      // Extract and prepare the response content
      let completeResponse = completion.choices[0]?.message?.content || "";
      let endIndex = Math.min(
        completeResponse.indexOf('•') >= 0 ? completeResponse.indexOf('•') : completeResponse.length,
        completeResponse.indexOf('?') >= 0 ? completeResponse.indexOf('?') + 1 : completeResponse.length // Adjusted to ensure period inclusion
      );
      completeResponse = completeResponse.substring(0, endIndex);

      // Emit the response for further processing, like TTS
      const gptReply = {
        partialResponseIndex: this.partialResponseIndex,
        partialResponse: completeResponse
      };
      this.emit('gptreply', gptReply, interactionCount);
      this.partialResponseIndex++;

      // Add the AI's response to the conversation context to maintain memory
      this.userContext.push({ 'role': 'assistant', 'content': completeResponse });
      console.log(`Groq -> user context length: ${this.userContext.length}`.green);
    } catch (error) {
      console.error(`Error during chat completion with Groq: ${error}`.red);
    }
  }
}

module.exports = { GptService };
