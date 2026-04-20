export const emailTranslations = {
  verification: {
    subject: 'Verifique seu e-mail para {{appName}}',
    greeting: 'Olá {{name}},',
    body: 'Obrigado por se cadastrar! Verifique seu endereço de e-mail clicando no botão abaixo:',
    buttonText: 'Verificar E-mail',
    footer: 'Se você não criou uma conta, pode ignorar este e-mail com segurança.',
    alternativeText: 'Se o botão acima não funcionar, você também pode copiar e colar este link em seu navegador:',
    regards: 'Atenciosamente,\nEquipe {{appName}}'
  },
  accountCreated: {
    subject: 'Sua conta foi criada no {{appName}}',
    greeting: 'Olá {{name}},',
    body: 'Sua conta foi criada por um administrador. Você já pode acessar o sistema usando o endereço de e-mail e a senha definidos.',
    buttonText: 'Acessar o Sistema',
    footer: 'Se você não esperava esta criação de conta, entre em contato com o administrador da organização.',
    regards: 'Atenciosamente,\nEquipe {{appName}}'
  },
  welcomeCredentials: {
    subject: 'Bem-vindo ao {{appName}} — suas credenciais de acesso',
    greeting: 'Olá {{name}},',
    body: 'Sua conta foi criada no {{appName}} para a organização {{organizationName}}. Use as credenciais abaixo para fazer seu primeiro acesso:',
    loginLabel: 'E-mail de acesso',
    passwordLabel: 'Senha temporária',
    warning: 'Por segurança, você será solicitado a criar uma nova senha no primeiro login.',
    buttonText: 'Acessar o Sistema',
    footer: 'Se você não esperava esta conta, entre em contato com o administrador da organização.',
    regards: 'Atenciosamente,\nEquipe {{appName}}'
  },
  passwordReset: {
    subject: 'Redefinir sua senha para {{appName}}',
    greeting: 'Olá {{name}},',
    body: 'Recebemos uma solicitação para redefinir sua senha da sua conta {{appName}}. Se você não fez esta solicitação, pode ignorar este e-mail com segurança.',
    instruction: 'Para redefinir sua senha, clique no botão abaixo. Este link expira em 1 hora.',
    buttonText: 'Redefinir Senha',
    alternativeText: 'Se o botão não funcionar, você pode copiar e colar este link no seu navegador:',
    disclaimer: 'Se você não solicitou esta redefinição de senha, ignore este e-mail. Sua senha permanecerá inalterada.',
    regards: 'Atenciosamente,\nEquipe {{appName}}'
  }
};
