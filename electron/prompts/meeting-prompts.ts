/**
 * Meeting-related prompt templates for LLM interactions.
 */

export function buildSummaryPrompt(transcript: string, language?: string): string {
  const langNote = language ? `\nRespond in the language: ${language}` : ""
  return `Summarize the following meeting transcript concisely. Focus on key decisions, topics discussed, and outcomes.${langNote}

Transcript:
${transcript}`
}

export function buildChunkSummaryPrompt(transcript: string, chunkIndex: number, totalChunks: number): string {
  return `This is section ${chunkIndex} of ${totalChunks} from a longer meeting. Summarize this section concisely, preserving key points and context.

Transcript:
${transcript}`
}

export function buildCombineSummaryPrompt(chunkSummaries: string[]): string {
  const sections = chunkSummaries
    .map((s, i) => `Section ${i + 1}:\n${s}`)
    .join("\n\n")

  return `Combine these meeting section summaries into a single cohesive summary. Remove redundancy, maintain chronological flow, and highlight key decisions and action items.

${sections}`
}

export function buildActionItemsPrompt(transcript: string): string {
  return `Extract action items from this meeting transcript. Return a JSON array where each item has:
- "text" (string): the action to be taken
- "owner" (string or null): person responsible
- "deadline" (string or null): when it should be done

Return ONLY the JSON array, no markdown fences or explanation. If no action items found, return [].

Transcript:
${transcript}`
}

export function buildQuickResponsePrompt(question: string, recentContext: string): string {
  return `Based on the meeting context below, suggest 2-3 brief response options for this question.

Recent context:
${recentContext}

Question: ${question}

Provide 2-3 concise response suggestions, each on a new line prefixed with "- ".`
}

export function buildCoachingPrompt(recentStatement: string, playbook: string): string {
  return `You are a real-time meeting coach using the "${playbook}" playbook. Based on the following recent statement, provide brief coaching advice if relevant. If no coaching is needed, respond with an empty string.

Recent statement: "${recentStatement}"

Keep advice to 1-2 sentences maximum.`
}
