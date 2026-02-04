import {
  Button,
  Heading,
  Link,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './BaseEmail';
import { getEmailTranslations, interpolateTemplate } from '../translations';

interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
  appName: string;
  language?: string;
}

export const PasswordResetEmail = ({
  name,
  resetUrl,
  appName,
  language,
}: PasswordResetEmailProps) => {
  const translations = getEmailTranslations(language);
  const t = translations.passwordReset;

  return (
    <BaseEmail previewText={interpolateTemplate(t.subject, { appName })}>
      <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
        {interpolateTemplate(t.subject, { appName })}
      </Heading>

      <Text className="text-black text-[14px] leading-[24px]">
        {interpolateTemplate(t.greeting, { name })}
      </Text>

      <Text className="text-black text-[14px] leading-[24px]">
        {interpolateTemplate(t.body, { appName })}
      </Text>

      <Text className="text-black text-[14px] leading-[24px] mt-4">
        {t.instruction}
      </Text>

      <Button
        className="bg-[#5469d4] rounded text-white text-[12px] px-5 py-3 font-semibold no-underline text-center mt-4 mb-4"
        href={resetUrl}
      >
        {t.buttonText}
      </Button>

      <Text className="text-black text-[14px] leading-[24px] mt-4">
        {t.alternativeText}
      </Text>

      <Text className="text-[#666666] text-[12px] leading-[24px]">
        <Link href={resetUrl} className="text-[#5469d4] underline">
          {resetUrl}
        </Link>
      </Text>

      <Text className="text-black text-[14px] leading-[24px] mt-6">
        {t.disclaimer}
      </Text>

      <Text className="text-black text-[14px] leading-[24px] mt-8">
        {interpolateTemplate(t.regards, { appName })}
      </Text>
    </BaseEmail>
  );
};

export default PasswordResetEmail;
