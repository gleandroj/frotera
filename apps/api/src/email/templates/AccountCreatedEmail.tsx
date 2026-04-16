import {
  Button,
  Heading,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './BaseEmail';
import { getEmailTranslations, interpolateTemplate } from '../translations';

interface AccountCreatedEmailProps {
  name?: string;
  loginUrl: string;
  appName: string;
  language?: string;
}

export const AccountCreatedEmail = ({
  name,
  loginUrl,
  appName,
  language,
}: AccountCreatedEmailProps) => {
  const translations = getEmailTranslations(language);
  const t = translations.accountCreated;
  const displayName = name?.trim() || (language === 'pt' ? 'usuário' : language === 'es' ? 'usuario' : language === 'de' ? 'Benutzer' : 'there');

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
