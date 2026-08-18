import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
export class ReorderImagesDto {
  @IsArray() @ArrayMaxSize(10) @IsUUID('4', { each: true }) imageIds: string[];
}
