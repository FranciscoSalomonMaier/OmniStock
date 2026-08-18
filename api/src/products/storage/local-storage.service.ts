import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { resolve, sep } from 'path';
import { randomUUID } from 'crypto';
@Injectable()
export class LocalStorageService {
  private readonly root: string;
  constructor(config: ConfigService) {
    this.root = resolve(config.getOrThrow<string>('UPLOAD_DIR'));
  }
  async save(companyId: string, productId: string, file: Express.Multer.File) {
    const extension: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const ext = extension[file.mimetype];
    if (!ext || !this.validSignature(file.buffer, file.mimetype))
      throw new BadRequestException('Formato de imagem inválido');
    const key = `products/${companyId}/${productId}/${randomUUID()}${ext}`;
    const path = this.safe(key);
    await mkdir(resolve(path, '..'), { recursive: true });
    await writeFile(path, file.buffer);
    return key;
  }
  read(key: string) {
    return readFile(this.safe(key));
  }
  async remove(key: string) {
    try {
      await unlink(this.safe(key));
    } catch {
      return;
    }
  }
  private safe(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep))
      throw new BadRequestException('Caminho inválido');
    return path;
  }
  private validSignature(buffer: Buffer, mime: string) {
    if (mime === 'image/jpeg')
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mime === 'image/png')
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (mime === 'image/webp')
      return (
        buffer.subarray(0, 4).toString() === 'RIFF' &&
        buffer.subarray(8, 12).toString() === 'WEBP'
      );
    return false;
  }
}
