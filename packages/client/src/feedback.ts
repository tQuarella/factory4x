/**
 * Feedback note: the player's text plus build/data version, game time, state
 * hash and the replay (seed, data version, input log). Nothing is sent
 * automatically; the player opens a prefilled GitHub issue or copies the text.
 */
import { worldHash, type SimData } from '@factory4x/sim';
import { mmss, shortVersion } from './format.ts';
import type { Session } from './session.ts';

export const ISSUE_URL = 'https://github.com/tQuarella/factory4x/issues/new';
/** Longest URL we hand to the browser; beyond this GitHub may reject it, so we fall back to the clipboard. */
export const MAX_URL_LENGTH = 7500;

export interface Note {
  title: string;
  /** Full note with the replay block, for the clipboard. */
  text: string;
  /** Prefilled-issue URL carrying the full note, or null if it is too long. */
  url: string | null;
  /** Prefilled-issue URL with the message and metadata only (no replay), for use after copying. */
  shortUrl: string;
}

function issueUrl(title: string, body: string): string {
  return `${ISSUE_URL}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

export function buildNote(session: Session, data: SimData, message: string, fullVersion: string, env: { viewport: string; userAgent: string }): Note {
  const w = session.world;
  const msg = message.trim() === '' ? '(no message)' : message.trim();
  const firstLine = msg.split('\n')[0]!.slice(0, 70);
  const title = `Playtest note: ${firstLine}`;
  const meta = [
    `Build: ${fullVersion} (short ${shortVersion(fullVersion)})`,
    `Data version: ${data.dataVersion}`,
    `Game time: ${mmss(Math.floor(w.tick / w.tickRate))} (tick ${w.tick})`,
    `State hash: ${worldHash(w)}`,
    `Viewport: ${env.viewport}`,
    `Agent: ${env.userAgent}`,
  ].join('\n');
  const replay = JSON.stringify(session.replay());
  const head = `${msg}\n\n---\n${meta}\n`;
  const replayBlock = `\nReplay (seed, data version, input log; reproduces this session up to tick ${w.tick}):\n\`\`\`json\n${replay}\n\`\`\`\n`;
  const text = head + replayBlock;
  const full = issueUrl(title, text);
  const shortBody = `${head}\n(Replay is on the clipboard: paste it below.)\n`;
  return { title, text, url: full.length <= MAX_URL_LENGTH ? full : null, shortUrl: issueUrl(title, shortBody) };
}
