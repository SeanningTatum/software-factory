// cf-saas-lint allow comments
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import { APP_NAME } from "#/app/constants.ts";

// Mail clients ignore stylesheets and CSS variables, so the look is inline and spelled out here.
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const INK = "#18181b";
const MUTED = "#71717a";
const LINE = "#e4e4e7";
const PAGE = "#f4f4f5";
const CARD = "#ffffff";

interface LayoutProps {
  /** Shown beside the subject in the inbox list, and on lock screens: no codes, no secrets. */
  readonly preview: string;
  readonly heading: string;
  /** Why the reader got this mail, and what to do if it wasn't them. */
  readonly footer: string;
  readonly children?: ReactNode;
}

/** Every mail wraps itself in this, so they all look like one product. */
export function MailLayout({ preview, heading, footer, children }: LayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: "32px 12px", backgroundColor: PAGE, fontFamily: FONT }}>
        <Container style={{ maxWidth: 480 }}>
          <Text style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 600, color: INK }}>
            {APP_NAME}
          </Text>
          <Section
            style={{
              padding: 32,
              backgroundColor: CARD,
              border: `1px solid ${LINE}`,
              borderRadius: 12,
            }}
          >
            <Heading as="h1" style={{ margin: "0 0 16px", fontSize: 22, color: INK }}>
              {heading}
            </Heading>
            {children}
            <Hr style={{ margin: "24px 0 16px", borderColor: LINE }} />
            <Text style={{ margin: 0, fontSize: 13, lineHeight: "20px", color: MUTED }}>
              {footer}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function MailText({ muted, children }: { muted?: boolean; children?: ReactNode }) {
  return (
    <Text
      style={{ margin: "0 0 16px", fontSize: 15, lineHeight: "24px", color: muted ? MUTED : INK }}
    >
      {children}
    </Text>
  );
}

/** The one thing the mail asks the reader to do. Use one per mail. */
export function MailButton({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <Button
      href={href}
      style={{
        margin: "0 0 16px",
        padding: "12px 20px",
        backgroundColor: INK,
        borderRadius: 8,
        fontSize: 15,
        fontWeight: 600,
        color: CARD,
      }}
    >
      {children}
    </Button>
  );
}

/** A code to type, large and spaced so it reads at a glance. */
export function MailCode({ children }: { children: string }) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        padding: "16px 0",
        backgroundColor: PAGE,
        borderRadius: 8,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: 28,
        fontWeight: 700,
        letterSpacing: 6,
        textAlign: "center",
        color: INK,
      }}
    >
      {children}
    </Text>
  );
}
