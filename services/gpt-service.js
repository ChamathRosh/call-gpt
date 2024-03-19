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
    ];
    this.partialResponseIndex = 0;
  }

  setCallSid(callSid) {
    this.userContext.push({ 'role': 'system', 'content': `callSid: ${callSid}` });
  }

  updateUserContext(name, role, text) {
    if (name !== 'user') {
      this.userContext.push({ 'role': role, 'name': name, 'content': text });
    } else {
      this.userContext.push({ 'role': role, 'content': text });
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    this.updateUserContext(name, role, text);

    try {
      const completion = await this.groq.chat.completions.create({
        messages: this.userContext,
        model: "mixtral-8x7b-32768",
      });

      let completeResponse = completion.choices[0]?.message?.content || "";

      // Determine the end index based on '@' or '?'
      let endIndex = Math.min(
        completeResponse.indexOf('@') >= 0 ? completeResponse.indexOf('@') : completeResponse.length,
        completeResponse.indexOf('?') >= 0 ? completeResponse.indexOf('?') + 1 : completeResponse.length
      );
      completeResponse = completeResponse.substring(0, endIndex);

      // Splitting and chunking based on '•'
      let chunks = completeResponse.split('.');
      chunks.forEach((chunk, index) => {
        if (chunk.trim()) {
          const gptReply = {
            partialResponseIndex: this.partialResponseIndex++,
            partialResponse: chunk.trim()
          };
          this.emit('gptreply', gptReply, interactionCount);
        }
      });

      // Update the user context with the last chunk for continuity
      this.userContext.push({ 'role': 'assistant', 'content': chunks[chunks.length - 1].trim() });
      console.log(`Groq -> user context length: ${this.userContext.length}`.green);
    } catch (error) {
      console.error(`Error during chat completion with Groq: ${error}`.red);
    }
  }
}

module.exports = { GptService };
