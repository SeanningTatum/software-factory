import {
  MailCode,
  MailLayout,
  MailText,
} from "#/features/core/email-templates/components/mail.tsx";

interface Props {
  readonly heading: string;
  readonly lead: string;
  readonly code: string;
}

export function CodeMail({ heading, lead, code }: Props) {
  return (
    <MailLayout
      preview={lead}
      heading={heading}
      footer="If you didn't ask for this code, you can ignore this email. Nobody can use it without your inbox."
    >
      <MailText>{lead}</MailText>
      <MailCode>{code}</MailCode>
      <MailText muted>It expires in 5 minutes.</MailText>
    </MailLayout>
  );
}
