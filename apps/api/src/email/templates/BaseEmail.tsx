import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface BaseEmailProps {
  previewText: string;
  children: React.ReactNode;
}

export const BaseEmail = ({ previewText, children }: BaseEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
            <Section className="mt-[32px]">
              {children}
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};