import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";

const modelNames = [
  "User",
  "VerificationToken",
  "Organization",
  "OrganizationMember",
  "Invitation",
  "Notification",
].sort();

// Model name translations
const modelTranslations: Record<string, string> = {
  User: "Usuários",
  VerificationToken: "Tokens de Verificação",
  Organization: "Organizações",
  OrganizationMember: "Membros da Organização",
  Invitation: "Convites",
  Notification: "Notificações",
};

// Navigation groups for organizing models by domain
const navigationGroups: Record<string, string> = {
  "users-organizations": "Usuários e Organizações",
  "authentication": "Autenticação",
  "notifications": "Notificações",
};

// Login page translations
const loginPageTranslations = {
  pages: {
    loginPage: {
      welcomeHeader: "Bem-vindo",
      welcomeMessage: "Painel administrativo do RS Frotas",
    },
  },
};

// Map models to their navigation groups
const modelNavigationGroups: Record<string, string> = {
  User: "users-organizations",
  Organization: "users-organizations",
  OrganizationMember: "users-organizations",
  Invitation: "users-organizations",
  VerificationToken: "authentication",
  Notification: "notifications",
};

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuthModule,
    import("@adminjs/nestjs").then(async ({ AdminModule }) => {
      return AdminModule.createAdminAsync({
        imports: [PrismaModule, ConfigModule],
        inject: [PrismaService, ConfigService],
        useFactory: async (
          prisma: PrismaService,
          configService: ConfigService
        ) => {
          const { Database, Resource, getModelByName } = await import(
            "@adminjs/prisma"
          );
          await import("@adminjs/express");
          const { AdminJS } = await import("adminjs");
          AdminJS.registerAdapter({ Database, Resource });

          // Import bcrypt for password hashing in User resource
          const bcrypt = await import("bcrypt");

          return {
            adminJsOptions: {
              rootPath: "/admin",
              loginPath: "/admin/login",
              logoutPath: "/admin/logout",
              resources: modelNames.map((name) => {
                const navigationGroup = modelNavigationGroups[name];
                const groupName = navigationGroup
                  ? navigationGroups[navigationGroup]
                  : modelTranslations[name] || name;

                const baseResource: any = {
                  resource: {
                    model: getModelByName(name),
                    client: prisma,
                  },
                  options: {
                    // Keep id as original model name for AdminJS to find resources correctly
                    // id: name,
                    // Use translated name for display
                    navigation: {
                      name: groupName,
                      icon: undefined, // Can add icons later if needed
                    },
                  },
                };

                // Special handling for User model to add password update functionality
                if (name === "User") {
                  const userResource = {
                    ...baseResource,
                    options: {
                      ...baseResource.options,
                      properties: {
                        // Hide the original password field in all views
                        password: {
                          isVisible: false,
                        },
                        // Hide 2FA fields - not needed in admin panel
                        twoFactorEnabled: {
                          isVisible: false,
                        },
                        twoFactorSecret: {
                          isVisible: false,
                        },
                        // Add virtual password field for new password
                        newPassword: {
                          type: "password",
                          isVisible: {
                            list: false,
                            show: false,
                            edit: true,
                            new: true,
                            filter: false,
                          },
                          isRequired: false, // Optional in edit mode
                        },
                        // Add password confirmation field
                        passwordConfirmation: {
                          type: "password",
                          isVisible: {
                            list: false,
                            show: false,
                            edit: true,
                            new: true,
                            filter: false,
                          },
                          isRequired: false, // Optional in edit mode
                        },
                      },
                      actions: {
                        new: {
                          before: async (request: any) => {
                            const { payload } = request;

                            // Validate password fields for new users
                            if (payload.newPassword || payload.passwordConfirmation) {
                              if (!payload.newPassword) {
                                throw new Error("Password is required");
                              }
                              if (!payload.passwordConfirmation) {
                                throw new Error("Password confirmation is required");
                              }
                              if (payload.newPassword !== payload.passwordConfirmation) {
                                throw new Error("Passwords do not match");
                              }

                              // Hash the password
                              payload.password = await bcrypt.hash(payload.newPassword, 10);
                            } else {
                              // Password is required for new users
                              throw new Error("Password is required for new users");
                            }

                            // Remove virtual fields from payload
                            delete payload.newPassword;
                            delete payload.passwordConfirmation;

                            return request;
                          },
                        },
                        edit: {
                          before: async (request: any) => {
                            const { payload } = request;

                            // Only validate and update password if newPassword is provided
                            if (payload.newPassword || payload.passwordConfirmation) {
                              if (!payload.newPassword) {
                                throw new Error("Password is required when updating password");
                              }
                              if (!payload.passwordConfirmation) {
                                throw new Error("Password confirmation is required");
                              }
                              if (payload.newPassword !== payload.passwordConfirmation) {
                                throw new Error("Passwords do not match");
                              }

                              // Hash the new password
                              payload.password = await bcrypt.hash(payload.newPassword, 10);
                            }

                            // Remove virtual fields from payload (even if not provided)
                            delete payload.newPassword;
                            delete payload.passwordConfirmation;

                            return request;
                          },
                        },
                      },
                    },
                  };

                  return userResource;
                }

                // Special handling for VerificationToken to hide sensitive token data
                if (name === "VerificationToken") {
                  const verificationTokenResource = {
                    ...baseResource,
                    options: {
                      ...baseResource.options,
                      properties: {
                        // Hide token in list view for security, but show in detail view
                        token: {
                          isVisible: {
                            list: false,
                            show: true,
                            edit: false,
                            filter: false,
                          },
                        },
                      },
                    },
                  };

                  return verificationTokenResource;
                }

                // Special handling for Notification to improve metadata display
                if (name === "Notification") {
                  const notificationResource = {
                    ...baseResource,
                    options: {
                      ...baseResource.options,
                      properties: {
                        // Format metadata as textarea for better readability
                        metadata: {
                          type: "textarea",
                          isVisible: {
                            list: false,
                            show: true,
                            edit: true,
                            filter: false,
                          },
                        },
                        // Make message a textarea
                        message: {
                          type: "textarea",
                          isVisible: {
                            list: false,
                            show: true,
                            edit: true,
                            filter: false,
                          },
                        },
                      },
                    },
                  };

                  return notificationResource;
                }

                return baseResource;
              }),
              branding: {
                companyName: "RS Frotas Admin",
                withMadeWithLove: false,
              },
              locale: {
                language: "pt-BR",
                availableLanguages: ["pt-BR"],
                translations: {
                  "pt-BR": {
                    labels: modelTranslations,
                    // Navigation group translations
                    ...Object.entries(navigationGroups).reduce(
                      (acc, [key, value]) => {
                        acc[`navigation.${key}`] = value;
                        return acc;
                      },
                      {} as Record<string, string>
                    ),
                    // Login page translations
                    ...loginPageTranslations,
                  },
                },
              },
            },
            auth: {
              authenticate: async (email: string, password: string) => {
                const user = await prisma.user.findUnique({
                  where: { email, isSuperAdmin: true },
                });

                if (!user) {
                  return null;
                }

                const bcrypt = await import("bcrypt");
                const isPasswordValid = await bcrypt.compare(
                  password,
                  user.password
                );

                if (isPasswordValid) {
                  return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: "admin",
                  };
                }

                return null;
              },
              cookieName: "adminjs",
              cookiePassword:
                configService.get("JWT_SECRET") ||
                "secret-key-change-in-production",
            },
            sessionOptions: {
              resave: false,
              saveUninitialized: true,
              secret:
                configService.get("JWT_SECRET") ||
                "secret-key-change-in-production",
            },
          };
        },
      });
    }),
  ],
  controllers: [],
})
export class AdminModule {}
