const EventEmitter = require('events');
const fetch = require('node-fetch');
const PlayHT = require('playht'); // Assuming PlayHT SDK is similar to fetch in usage

class TextToSpeechService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.config.voiceId ||= process.env.VOICE_ID;
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
  }

  async generate(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse } = gptReply;

    if (!partialResponse) { return; }

    try {
      // Initialize PlayHT with your credentials
      PlayHT.init({
        apiKey: process.env.PLAYHT_API_KEY,
        userId: process.env.PLAYHT_USER_ID,
      });

      // Configure streaming options for PlayHT
      const streamingOptions = {
        voiceEngine: "PlayHT2.0-turbo",
        voiceId: 's3://voice-cloning-zero-shot/801a663f-efd0-4254-98d0-5c175514c3e8/jennifer/manifest.json', // Hardcoded voice ID
        outputFormat: 'mulaw', // Twilio requires 'mulaw' format
        sampleRate: 8000, // Match Twilio's expected sample rate
        speed: 1, // Default speed
      };

      // Start streaming text to speech
      const stream = await PlayHT.stream(partialResponse, streamingOptions);

      // Collect chunks of audio data
      let audioChunks = [];
      for await (const chunk of stream) {
        audioChunks.push(chunk);
      }

      // Assuming PlayHT provides raw audio data, convert chunks to base64 for Twilio
      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      this.emit('speech', partialResponseIndex, audioBase64, partialResponse, interactionCount);
    } catch (err) {
      console.error('Error occurred in TextToSpeech service using PlayHT');
      console.error(err);
    }
  }
}

module.exports = { TextToSpeechService };
