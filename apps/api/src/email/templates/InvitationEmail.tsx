import {
  Button,
  Heading,
  Link,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from './BaseEmail';
import { getEmailTranslations, interpolateTemplate } from '../translations';

interface InvitationEmailProps {
  organizationName: string;
  inviterName: string;
  inviterEmail: string;
  acceptUrl: string;
  appName: string;
  language?: string;
}

export const InvitationEmail = ({
  organizationName,
  inviterName,
  inviterEmail,
  acceptUrl,
  appName,
  language,
}: InvitationEmailProps) => {
  const translations = getEmailTranslations(language);
  const t = translations.invitation;

  return (
    <BaseEmail previewText={interpolateTemplate(t.subject, { organizationName, appName })}>
      <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
        {interpolateTemplate(t.subject, { organizationName, appName })}
      </Heading>

      <Text className="text-black text-[14px] leading-[24px]">
        {t.greeting}
      </Text>

      <Text className="text-black text-[14px] leading-[24px] mt-4">
        {interpolateTemplate(t.body, { inviterName, inviterEmail, organizationName, appName })}
      </Text>

      <Text className="text-black text-[14px] leading-[24px] mt-4">
        {t.instruction}
      </Text>

      <Button
        className="bg-[#5469d4] rounded text-white text-[12px] px-5 py-3 font-semibold no-underline text-center mt-4 mb-4"
        href={acceptUrl}
      >
        {t.buttonText}
      </Button>

      <Text className="text-black text-[14px] leading-[24px] mt-4">
        {t.footer}
      </Text>

      <Text className="text-[#666666] text-[12px] leading-[24px] mt-8">
        {t.alternativeText}
        <br />
        <Link href={acceptUrl} className="text-[#5469d4] underline">
          {acceptUrl}
        </Link>
      </Text>

      <Text className="text-black text-[14px] leading-[24px] mt-8">
        {interpolateTemplate(t.regards, { appName })}
      </Text>
    </BaseEmail>
  );
};