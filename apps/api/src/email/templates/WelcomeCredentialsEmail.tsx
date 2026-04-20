import {
  Button,
  Heading,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './BaseEmail';
import { getEmailTranslations, interpolateTemplate } from '../translations';

interface WelcomeCredentialsEmailProps {
  name?: string;
  email: string;
  temporaryPassword: string;
  loginUrl: string;
  appName: string;
  language?: string;
}

export const WelcomeCredentialsEmail = ({
  name,
  email,
  temporaryPassword,
  loginUrl,
  appName,
  language,
}: WelcomeCredentialsEmailProps) => {
  const translations = getEmailTranslations(language);
  const t = translations.welcomeCredentials;
  const displayName = name?.trim() || 'usuário';

  return (
    <BaseEmail previewText={interpolateTemplate(t.subject, { appName })}>
      <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
        {interpolateTemplate(t.subject, { appName })}
      </Heading>

      <Text className="text-black text-[14px] leading-[24px]">
        {interpolateTemplate(t.greeting, { name: displayName })}
      </Text>

      <Text className="text-black text-[14px] leading-[24px] mt-4">
        {t.body}
      </Text>

      <Section className="bg-gray-50 border border-gray-200 rounded-md p-6 my-6">
        <Text className="text-black text-[13px] leading-[20px] font-semibold mb-1">
          {t.loginLabel}
        </Text>
        <Text className="text-gray-700 text-[14px] leading-[24px] font-mono mb-4">
          {email}
        </Text>
        <Text className="text-black text-[13px] leading-[20px] font-semibold mb-1">
          {t.passwordLabel}
        </Text>
        <Text className="text-[20px] leading-[28px] font-mono font-bold tracking-widest text-[#5469d4]">
          {temporaryPassword}
        </Text>
      </Section>

      <Text className="text-orange-600 text-[13px] leading-[20px] mt-2">
        {t.warning}
      </Text>

      <Button
        className="bg-[#5469d4] rounded text-white text-[12px] px-5 py-3 font-semibold no-underline text-center mt-4 mb-4"
        href={loginUrl}
      >
        {t.buttonText}
      </Button>

      <Text className="text-black text-[14px] leading-[24px] mt-4">
        {t.footer}
      </Text>

      <Text className="text-black text-[14px] leading-[24px] mt-8">
        {interpolateTemplate(t.regards, { appName })}
      </Text>
    </BaseEmail>
  );
};
