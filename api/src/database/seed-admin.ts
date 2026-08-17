import 'dotenv/config';
import { hash } from 'bcrypt';
import dataSource from './data-source';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { Company } from '../companies/entities/company.entity';
import { CompanyMember } from '../companies/entities/company-member.entity';
import { CompanyRole } from '../common/enums/company-role.enum';

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
  let admin = await users.findOne({ where: { email } });
  if (!admin)
    admin = await users.save(
      users.create({
        name: 'Administrador',
        email,
        passwordHash: await hash(password, 12),
        role: UserRole.ADMIN,
        emailVerifiedAt: new Date(),
      }),
    );
  const companies = dataSource.getRepository(Company);
  const members = dataSource.getRepository(CompanyMember);
  let company = await companies.findOne({
    where: { document: '00000000000000' },
  });
  if (!company)
    company = await companies.save(
      companies.create({
        legalName: 'OmniStock Desenvolvimento LTDA',
        tradeName: 'OmniStock Desenvolvimento',
        document: '00000000000000',
      }),
    );
  if (
    !(await members.findOne({
      where: { companyId: company.id, userId: admin.id },
    }))
  )
    await members.save(
      members.create({
        companyId: company.id,
        userId: admin.id,
        role: CompanyRole.ADMIN,
      }),
    );
  console.log('Administrador e empresa de desenvolvimento disponíveis.');
}

seedAdmin()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Falha ao executar seed.',
    );
    process.exitCode = 1;
  })
  .finally(() => (dataSource.isInitialized ? dataSource.destroy() : undefined));
