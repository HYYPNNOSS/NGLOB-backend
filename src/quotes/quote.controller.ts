import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class SaveDraftDto {
  @IsString() stateData: string;
  @IsOptional() @IsString() pickup?: string;
  @IsOptional() @IsString() destination?: string;
  @IsOptional() @IsNumber() totalPrice?: number;
}

@Controller('quotes')
@UseGuards(JwtAuthGuard)
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post('draft')
  async saveDraft(@Request() req, @Body() dto: SaveDraftDto) {
    return this.quoteService.saveDraft(
      req.user.id,
      dto.stateData,
      dto.pickup,
      dto.destination,
      dto.totalPrice,
    );
  }

  @Get('drafts')
  async getDrafts(@Request() req) {
    return this.quoteService.getDrafts(req.user.id);
  }

  @Get('drafts/:id')
  async getDraft(@Request() req, @Param('id') id: string) {
    return this.quoteService.getDraft(id, req.user.id);
  }

  @Delete('drafts/:id')
  async deleteDraft(@Request() req, @Param('id') id: string) {
    await this.quoteService.deleteDraft(id, req.user.id);
    return { success: true };
  }
}
