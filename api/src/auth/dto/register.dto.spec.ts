import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const metadata: ArgumentMetadata = { type: 'body', metatype: RegisterDto };

  it('normaliza o e-mail', async () => {
    await expect(
      pipe.transform(
        {
          name: 'Francisco',
          email: ' FRANCISCO@EXAMPLE.COM ',
          password: 'SenhaSegura123',
        },
        metadata,
      ),
    ).resolves.toMatchObject({ email: 'francisco@example.com' });
  });

  it('recusa role informada pelo cliente', async () => {
    await expect(
      pipe.transform(
        {
          name: 'Francisco',
          email: 'francisco@example.com',
          password: 'SenhaSegura123',
          role: 'ADMIN',
        },
        metadata,
      ),
    ).rejects.toThrow();
  });
});
