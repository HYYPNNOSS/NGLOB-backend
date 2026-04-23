import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ItemCategory } from '@prisma/client';

const PACKING_MATERIALS_CATALOG = [
  { type: 'MEDIUM_BOX',   name: 'Medium box',        dimensions: '33×33×40cm', pricePerUnit: 2.30 },
  { type: 'LARGE_BOX',    name: 'Large box',         dimensions: '45×45×60cm', pricePerUnit: 4.00 },
  { type: 'BUBBLE_WRAP',  name: 'Bubble wrap large', dimensions: '50cm × 10m', pricePerUnit: 7.00 },
  { type: 'PAPER_ROLL',   name: 'Brown paper roll',  dimensions: '50cm × 50m', pricePerUnit: 5.00 },
  { type: 'TAPE',         name: 'Packing tape',      dimensions: '50mm × 66m', pricePerUnit: 1.00 },
];

const CATEGORIES = [
  { id: 'FURNITURE',    name: 'Furniture',      icon: '🛋️' },
  { id: 'APPLIANCES',   name: 'Appliances',     icon: '🖨️' },
  { id: 'BOXES',        name: 'Boxes',          icon: '📦' },
  { id: 'DECOR_OTHER',  name: 'Decor & other',  icon: '🪴' },
];

@Injectable()
export class ItemsService {
  constructor(private prisma: PrismaService) {}

  getCategories() {
    return CATEGORIES;
  }

  async createCustomItem(dto: any) {
    const volumeM3 = (dto.widthCm * dto.heightCm * dto.depthCm) / 1_000_000;
    // Rough price: £2 per 0.1 m³ (minimum £5)
    const estimatedPrice = Math.max(5, Math.round(volumeM3 * 20));

    return {
      name: dto.name,
      widthCm: dto.widthCm,
      heightCm: dto.heightCm,
      depthCm: dto.depthCm,
      volumeM3: Math.round(volumeM3 * 100) / 100,
      estimatedPrice,
      isCustom: true,
    };
  }

  async findAll() {
    return this.prisma.catalogItem.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  getPackingMaterials() {
    return PACKING_MATERIALS_CATALOG;
  }

  async identifyFromPhoto(file: Express.Multer.File) {
    // In production: upload to S3, call OpenAI Vision API
    // Return mock for now
    return {
      identified: [
        { name: 'Wardrobe',  widthCm: 240, heightCm: 160, depthCm: 60, volumeM3: 2.3,  priceEstimate: 23 },
        { name: 'Curtain pole', widthCm: 5, heightCm: 15, depthCm: 130, volumeM3: 0.9, priceEstimate: 11 },
      ],
    };
  }
}
