import { serve } from "bun";
import { readFileSync } from "fs";

const NOMI_API_KEY = process.env.NOMI_API_KEY || "";
const NOMI_ID = process.env.NOMI_ID || "";

console.log("🚀 Bridge active! Listening on port 3001.");

// --- 1. THE QUEUE SYSTEM ---
// This ensures Nomi only processes one thought at a time.
// If you speak while she is thinking about a heartbeat, your prompt waits in line securely.
class TaskQueue {
  private queue: (() => Promise<void>)[] = [];
  private isProcessing = false;

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      });
      this.processNext();
    });
  }

  private async processNext() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const task = this.queue.shift();
    if (task) await task();
    this.isProcessing = false;
    this.processNext(); // Process the next one in line
  }
}

const requestQueue = new TaskQueue();

serve({
  port: 3001,
  async fetch(req) {
    const headers = { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" };
    if (req.method === "OPTIONS") return new Response(null, { headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS" } });

    try {
      const body = await req.json();
      const messages = body.messages || [];
      const lastMsg = messages[messages.length - 1];
      const userText = typeof lastMsg.content === 'string' ? lastMsg.content : lastMsg.content[0]?.text;

      // --- 2. ADD REQUEST TO QUEUE ---
      const reply = await requestQueue.enqueue(async () => {
        console.log(`\n📥 Queued Input: ${userText}`);

        // --- 3. LIVE VISION INJECTION ---
        // Read the latest screen observation exactly when the message is processed
        let visionContext = "";
        try {
          visionContext = readFileSync("current_observation.txt", "utf-8").trim();
        } catch (e) {
          console.log("⚠️ No vision context found on disk.");
        }

        // Combine the user's spoken word (or heartbeat) with the visual context cleanly
        let finalPrompt = userText;
        if (visionContext) {
          finalPrompt = `${userText}\n\n${visionContext}`;
        }

        console.log(`🚀 Sending to Nomi: ${finalPrompt.replace(/\n/g, ' ')}`);

        // Send to Nomi
        const res = await fetch(`https://api.nomi.ai/v1/nomis/${NOMI_ID}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": NOMI_API_KEY },
          body: JSON.stringify({ messageText: finalPrompt })
        });

        const data: any = await res.json();
        let replyText = data.replyMessage?.text || "No reply.";
        
        // --- 4. REGEX CLEANUP & TTS FORMATTING ---
        // 1. Strip emojis (TTS engines often crash when they try to read emojis)
        replyText = replyText.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
        
        // 2. Clean up asterisks but keep brackets for Nomi's facial expressions
        replyText = replyText.replace(/\*/g, '');

        // 3. FORCE SENTENCE CHUNKING: Add a hard newline after every period, question mark, or exclamation point.
        // This stops the TTS engine from receiving a "Giant Chunk" and crashing halfway through!
        replyText = replyText.replace(/([.!?])\s+/g, '$1\n');
        
        // Clean up any weird extra spaces
        replyText = replyText.replace(/\s{2,}/g, ' ').trim();

        console.log(`📤 Nomi Reply (Cleaned for TTS): \n${replyText}`);
        
        return replyText;
      });

      return new Response(JSON.stringify({
        choices: [{ message: { role: "assistant", content: reply }, finish_reason: "stop" }]
      }), { headers });

    } catch (e) {
      console.error("❌ Bridge Error:", e);
      return new Response(JSON.stringify({ choices: [] }), { headers });
    }
  },
});