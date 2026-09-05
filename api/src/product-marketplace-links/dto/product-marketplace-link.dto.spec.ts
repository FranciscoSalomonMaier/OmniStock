import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateProductMarketplaceLinkDto } from './product-marketplace-link.dto';

describe('CreateProductMarketplaceLinkDto', () => {
  it('rejeita companyId e outros campos controlados pelo servidor', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(
        {
          productId: '0e89a71a-e88f-47f4-bede-aa60408ae746',
          marketplaceListingId: '72db1380-68a7-4806-a870-8f78667e53e3',
          companyId: 'f667f17d-c125-4179-bd44-6e62787d8209',
        },
        { type: 'body', metatype: CreateProductMarketplaceLinkDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
