import type { EmailSender } from "./email.ts";

export const memorySender = () => {
  const sent: Array<Parameters<EmailSender["send"]>[0]> = [];
  const sender: EmailSender = { send: async (message) => void sent.push(message) };
  return { sender, sent };
};
