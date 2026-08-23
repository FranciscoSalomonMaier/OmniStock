import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TokenEncryptionService } from './token-encryption.service';
describe('TokenEncryptionService',()=>{
  it('cifra e decifra sem texto puro',()=>{const key=Buffer.alloc(32,7).toString('base64');const service=new TokenEncryptionService(new ConfigService({MARKETPLACE_TOKEN_ENCRYPTION_KEY:key,MARKETPLACE_TOKEN_ENCRYPTION_KEY_VERSION:'v1'}));const encrypted=service.encrypt('segredo');expect(encrypted.ciphertext).not.toContain('segredo');expect(service.decrypt(encrypted)).toBe('segredo')});
  it('recusa uma chave inválida',()=>{const service=new TokenEncryptionService(new ConfigService({MARKETPLACE_TOKEN_ENCRYPTION_KEY:'invalida'}));expect(()=>service.encrypt('segredo')).toThrow(ServiceUnavailableException)});
});
