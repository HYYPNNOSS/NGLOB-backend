import {
  Controller, Get, Post, UseInterceptors, UploadedFile, Body
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreateCustomItemDto {
  @IsString() name: string;
  @IsNumber() widthCm: number;
  @IsNumber() heightCm: number;
  @IsNumber() depthCm: number;
  @IsOptional() @IsString() notes?: string;
}

@ApiTags('Items')
@Controller('items')
export class ItemsController {
  constructor(private itemsService: ItemsService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Get item categories (Furniture, Appliances, Boxes, Decor)' })
  getCategories() {
    return this.itemsService.getCategories();
  }

  @Get()
  @ApiOperation({ summary: 'Get full item catalog with dimensions and prices' })
  findAll() {
    return this.itemsService.findAll();
  }

  @Post('custom')
  @ApiOperation({ summary: 'Add a custom non-standard item with manual dimensions' })
  createCustom(@Body() dto: CreateCustomItemDto) {
    return this.itemsService.createCustomItem(dto);
  }

  @Get('packing-materials')
  @ApiOperation({ summary: 'Get packing material types with prices' })
  getPackingMaterials() {
    return this.itemsService.getPackingMaterials();
  }

  @Post('identify-from-photo')
  @ApiOperation({ summary: 'Identify items from uploaded photo (AI vision)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('photo'))
  identifyFromPhoto(@UploadedFile() file: Express.Multer.File) {
    return this.itemsService.identifyFromPhoto(file);
  }
}
