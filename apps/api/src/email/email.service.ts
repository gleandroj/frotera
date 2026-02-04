import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { render } from "@react-email/render";
import * as nodemailer from "nodemailer";
import { InvitationEmail } from "./templates/InvitationEmail";
import { PasswordResetEmail } from "./templates/PasswordResetEmail";
import { VerificationEmail } from "./templates/VerificationEmail";
import { getEmailTranslations, interpolateTemplate } from "./translations";

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeTransporter();
  }

  private async initializeTransporter() {
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    if (isDevelopment) {
      // Create a test account on Ethereal
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } else {
      // Production transporter
      this.transporter = nodemailer.createTransport({
        host: this.configService.get("SMTP_HOST"),
        port: this.configService.get("SMTP_PORT"),
        secure: this.configService.get("SMTP_SECURE") === "true",
        auth: {
          user: this.configService.get("SMTP_USER"),
          pass: this.configService.get("SMTP_PASS"),
        },
      });
    }
  }

  private async sendMailInternal(mailOptions: nodemailer.SendMailOptions) {
    const isDevelopment = this.configService.get("NODE_ENV") === "development";

    if (isDevelopment) {
      // Log email details in development
      console.log("📧 Development Mode - Email Details:");
      console.log("To:", mailOptions.to);
      console.log("Subject:", mailOptions.subject);
      // Send the email through Ethereal
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      return info;
    }

    // Production mode - send real email
    return this.transporter.sendMail(mailOptions);
  }

  public async sendMail(mailOptions: nodemailer.SendMailOptions) {
    const appName = this.configService.get("APP_NAME", "RS Frotas");
    return this.sendMailInternal({
      ...mailOptions,
      from: this.configService.get(
        "SMTP_FROM",
        `"${appName}" <noreply@neo.radisa.com.br>`
      ),
    });
  }

  async sendInvitationEmail({
    to,
    organizationName,
    inviterName,
    inviterEmail,
    acceptUrl,
    language,
  }: {
    to: string;
    organizationName: string;
    inviterName: string;
    inviterEmail: string;
    acceptUrl: string;
    language?: string;
  }) {
    const appName = this.configService.get("APP_NAME", "RS Frotas");
    const translations = getEmailTranslations(language);

    const html = await render(
      InvitationEmail({
        organizationName,
        inviterName,
        inviterEmail,
        acceptUrl,
        appName,
        language,
      })
    );

    const subject = interpolateTemplate(translations.invitation.subject, {
      organizationName,
      appName,
    });

    await this.sendMail({
      to,
      subject,
      html,
    });
  }

  async sendVerificationEmail({
    to,
    name,
    verificationUrl,
    language,
  }: {
    to: string;
    name: string;
    verificationUrl: string;
    language?: string;
  }) {
    const appName = this.configService.get("APP_NAME", "RS Frotas");
    const translations = getEmailTranslations(language);

    const html = await render(
      VerificationEmail({
        name,
        verificationUrl,
        appName,
        language,
      })
    );

    const subject = interpolateTemplate(translations.verification.subject, {
      appName,
    });

    await this.sendMail({
      to,
      subject,
      html,
    });
  }

  async sendPasswordResetEmail({
    to,
    name,
    resetUrl,
    language,
  }: {
    to: string;
    name: string;
    resetUrl: string;
    language?: string;
  }) {
    const appName = this.configService.get("APP_NAME", "RS Frotas");
    const translations = getEmailTranslations(language);

    const html = await render(
      PasswordResetEmail({
        name,
        resetUrl,
        appName,
        language,
      })
    );

    const subject = interpolateTemplate(translations.passwordReset.subject, {
      appName,
    });

    await this.sendMail({
      to,
      subject,
      html,
    });
  }

}
