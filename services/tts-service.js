const EventEmitter = require('events');
const fetch = require('node-fetch');
const { Buffer } = require('node:buffer');

class TextToSpeechService extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
    }

    async generate(gptReply, interactionCount) {
        const { partialResponseIndex, partialResponse } = gptReply;

        if (!partialResponse) return;

        // Construct the URL with query parameters for encoding and sample rate
        // Adding `container=none` to prevent request header information from being misinterpreted as audio
        const apiUrl = `https://api.deepgram.com/v1/speak?model=aura-athena-en&encoding=mulaw&sample_rate=8000&container=none`;
        const apiKey = 'ffe4917ff05f5880addcf080bf7595472ca296ec'; // Use your actual Deepgram API key

        const modifiedText = this.addPausesAndFillerWords(partialResponse);

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: modifiedText }),
            });

            if (!response.ok) {
                const errorResponse = await response.json();
                console.error('Deepgram TTS API Error:', errorResponse);
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const audioBuffer = await response.arrayBuffer();
            const audioBase64 = Buffer.from(audioBuffer).toString('base64');
            this.emit('speech', partialResponseIndex, audioBase64, modifiedText, interactionCount);
        } catch (err) {
            console.error('Error occurred in TextToSpeech service:', err.message);
        }
    }

    addPausesAndFillerWords(text) {
        // This method is where we modify the text to include natural pauses and filler words
        // Example: Add a short pause and "um" at the beginning, and "uh" at the end
        let modifiedText = text;
        modifiedText = modifiedText.replace(/, /g, ', ... '); // Adding pauses
        return modifiedText;
    }
}

module.exports = { TextToSpeechService };
