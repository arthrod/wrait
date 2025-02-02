import Litellm from "litellm"; // Import litellm

Litellm.api_key = process.env.LITELLM_API_KEY; // Or however you are setting your API key

export class AI {
  //#engine: webllm.MLCEngineInterface | undefined; // Removed webllm engine

  #loaded = false;

  loaded() {
    return this.#loaded;
  }

  // Removed webllm.InitProgressCallback type
  constructor(
    private readonly initProgressCallback: any
  ) { }

  async load() {
    /* Removed webllm loading logic
    this.#engine = await webllm.CreateMLCEngine(
      "Llama-3.2-3B-Instruct-q4f32_1-MLC",
      {
        initProgressCallback: this.initProgressCallback,
      }
    );
    this.#loaded = true;
    */
    this.#loaded = true; // Mock loaded state for litellm (adjust loading logic as needed)
  }

  async completion(
    prefix: string,
    onUpdate: (v: string, abort: () => void) => void
  ) {
    // Placeholder -  Direct completion is not used in chat, using request instead
    onUpdate("Direct completion is not used in this chat demo.", abort);
    return "Direct completion is not used in this chat demo.";
  }


  async request(
    request: any, // Assuming request has a messages array
    onUpdate: (v: string, abort: () => void) => void
  ): Promise<any> { // Added Promise<any> and return type
    let shouldAbort = false;
    const abort = () => {
      shouldAbort = true;
    };

    try {
      const responseStream = await Litellm.completion({
        model: "gpt-3.5-turbo", // Or your desired model
        messages: request.messages,
        stream: true,
      });

      if (!responseStream) {
        throw new Error("Failed to get response stream from Litellm."); // Throw error if no stream
      }

      let message = "";
      for await (const chunk of responseStream) {
        if (shouldAbort) {
          responseStream.abort();
          return; // early return if aborted
        }
        const textChunk = chunk.choices?.[0]?.delta?.content || "";
        message += textChunk;
        onUpdate(message, abort);
      }
      return message; // Return the complete message
    } catch (e: any) { // Catching as any to access error message
      console.error("Litellm API error:", e);
      // More informative error message for UI if needed
      const errorMessage = e.message || "An error occurred while processing your request.";
      onUpdate(`Error: ${errorMessage}`, abort); // Send error message to chat UI
      throw new Error(`Litellm API request failed: ${errorMessage}`); // Re-throw to be caught by the caller (handleChatSubmit)
    }
  }
}
