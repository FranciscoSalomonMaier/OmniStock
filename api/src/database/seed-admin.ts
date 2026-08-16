import 'dotenv/config';
import { hash } from 'bcrypt';
import dataSource from './data-source';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

async function seedAdmin(): Promise<void> {
  if (process.env.NODE_ENV === 'production')
    throw new Error('O seed de administrador não pode executar em produção.');
  const password = process.env.ADMIN_INITIAL_PASSWORD;
  if (!password || password.length < 8)
    throw new Error(
      'Defina ADMIN_INITIAL_PASSWORD com pelo menos 8 caracteres.',
    );

  await dataSource.initialize();
  const users = dataSource.getRepository(User);
  const email = 'admin@omnistock.local';
  if (await users.findOne({ where: { email } })) {
    console.log('Administrador já existe; nenhuma alteração realizada.');
    return;
  }
  await users.save(
    users.create({
      name: 'Administrador',
      email,
      passwordHash: await hash(password, 12),
      role: UserRole.ADMIN,
    }),
  );
  console.log('Administrador de desenvolvimento criado.');
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Falha ao executar seed.',
    );
    process.exitCode = 1;
  })
  .finally(() => (dataSource.isInitialized ? dataSource.destroy() : undefined));
