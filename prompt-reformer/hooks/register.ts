import type { EngineInterface, Register } from 'claude-code'

const PLUGIN = 'prompt-reformer'
const MODEL = 'sonnet'
const REFORMAT = 'Reformat'
const SEND = 'Send as is'
const KEEP = 'Keep editing'

type Question = { question: string; header?: string; options: string[] }

const QUESTIONS_SYSTEM = `You help a developer write clearer prompts for an AI coding agent.
Read their draft prompt and find what is genuinely ambiguous or missing: goals, scope, constraints, acceptance criteria, technology choices.
Answer with JSON only, no prose and no code fence:
{"questions":[{"question":"...","header":"...","options":["...","..."]}]}
Rules: at most 4 questions, only where the answer would change the result; each question ends with "?"; "header" is at most 12 characters; 2 to 4 short, concrete options each.
Write the questions and options in the same language as the draft.
If the draft is already clear, answer {"questions":[]}.`

const REWRITE_SYSTEM = `You restructure a developer's draft prompt for an AI coding agent so it is clearer.
Keep every fact, requirement and nuance of the draft and of the clarifications; add nothing they did not say.
Organize it with short markdown sections where they fit, for example: Goal, Context, Requirements, Constraints, Done when. Use bullet lists for enumerations. Drop filler and repetition.
Write in the same language as the draft. Keep code, paths, names and identifiers exactly as written.
Answer with the restructured prompt only: no preface, no explanation, no surrounding code fence.`

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

const parseQuestions = (raw: string): Question[] => {
  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
  try {
    const list = (JSON.parse(json) as { questions?: unknown }).questions
    if (!Array.isArray(list)) return []

    return list
      .filter(
        (q): q is Question =>
          typeof q?.question === 'string' &&
          Array.isArray(q.options) &&
          q.options.filter((o: unknown) => typeof o === 'string').length >= 2,
      )
      .slice(0, 4)
      .map(q => ({
        question: q.question,
        header: typeof q.header === 'string' ? q.header.slice(0, 12) : undefined,
        options: q.options.filter(o => typeof o === 'string').slice(0, 4),
      }))
  } catch {
    return []
  }
}

const reformat = async ($: EngineInterface, draft: string) => {
  $.ui.status('Prompt reformer: looking for open questions…')
  const asked = await $.model.complete({
    model: MODEL,
    system: QUESTIONS_SYSTEM,
    prompt: draft,
    timeoutMs: 90_000,
  })
  const questions = asked.isAnswered ? parseQuestions(asked.text) : []
  $.ui.status(undefined)

  const answers: string[] = []
  for (const q of questions) {
    const answer = await $.ui.ask(q.question, { options: q.options, header: q.header })
    answers.push(`Q: ${q.question}\nA: ${answer}`)
  }

  $.ui.status('Prompt reformer: rewriting…')
  const prompt =
    answers.length === 0
      ? `Draft prompt:\n\n${draft}`
      : `Draft prompt:\n\n${draft}\n\nClarifications from the author:\n\n${answers.join('\n\n')}`
  const written = await $.model.complete({
    model: MODEL,
    system: REWRITE_SYSTEM,
    prompt,
    timeoutMs: 120_000,
  })
  $.ui.status(undefined)

  return written.isAnswered ? written.text.trim() : undefined
}

export const register: Register = (on, options) => {
  const threshold = Number(options.wordThreshold ?? 50)
  // The prompt this mod just put in the box goes through untouched once.
  let skipNext = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'reformer-threshold',
      description: 'Show or set the word count above which the prompt reformer offers to restructure a prompt',
      argumentHint: '[words]',
    })

    return next(e)
  })

  on('command.run', { command: 'reformer-threshold' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === '') return { text: `Prompt reformer threshold: ${threshold} words.` }

    const value = Number(arg)
    if (!Number.isInteger(value) || value < 1) {
      return { text: `"${arg}" is not a positive whole number.` }
    }
    const { deny } = await $.config.set({ key: `${PLUGIN}.wordThreshold`, value })

    return { text: deny ? `Could not set the threshold: ${deny}` : `Prompt reformer threshold set to ${value} words.` }
  })

  on('prompt.submit', async ($, e, next) => {
    const isPersonTyped = ['composer', 'sdk', 'bridge'].includes(e.origin.kind)
    if (e.command || e.isMeta || !isPersonTyped) return next(e)
    if (skipNext) {
      skipNext = false
      return next(e)
    }
    const words = countWords(e.text)
    if (words <= threshold) return next(e)

    let choice: string
    try {
      choice = await $.ui.ask(`Your prompt is ${words} words. Restructure it into a clearer form?`, {
        options: [REFORMAT, SEND, KEEP],
        header: 'Reformer',
      })
    } catch {
      // Nobody to ask (a -p run): let it through.
      return next(e)
    }
    // The prompt box takes text only, so attachments survive only in this submission.
    const hasAttachments = (e.attachments?.length ?? 0) > 0
    const keepEditing = async (reason: string) => {
      await $.prompt.fill({ text: e.text })
      const note = hasAttachments ? ' Attach your images again before sending.' : ''
      return { drop: `${reason}${note}` }
    }

    if (choice === SEND) return next(e)
    if (choice !== REFORMAT) return keepEditing('Prompt kept in the box for editing.')

    let result: string | undefined
    try {
      result = await reformat($, e.text)
    } catch {
      $.ui.status(undefined)
      return keepEditing('Reformat cancelled; your original prompt is back in the box.')
    }
    if (result === undefined) {
      return keepEditing('The model did not answer; your original prompt is back in the box.')
    }

    if (!hasAttachments) {
      const filled = await $.prompt.fill({ text: result })
      if (filled.isFilled) {
        skipNext = true
        return { drop: 'Reformatted prompt is in the box: review it and press Enter to send.' }
      }
    }

    // Attachments, or no prompt box to fill: show the result and send it in this submission.
    $.ui.log(`Reformatted prompt:\n\n${result}`)
    let send: string
    try {
      send = await $.ui.ask('Send the reformatted prompt shown above?', ['Send it', 'Send my original'])
    } catch {
      return keepEditing('Nothing sent; your original prompt is back in the box.')
    }

    return next({ ...e, text: send === 'Send my original' ? e.text : result })
  })
}
