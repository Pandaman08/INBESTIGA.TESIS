import { Public } from '../auth/auth.decorators';
import { Throttle } from '@nestjs/throttler';
import { Controller, Get, Post, Body, Param, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BuyersService } from './buyers.service';
import { CreateBuyerFormDto } from './dto/create-buyer-form.dto';
import { Request } from 'express';

@ApiTags('Buyers')
@Controller('buyers')
export class BuyersController {
  constructor(private readonly buyersService: BuyersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar BUYERS ordenados por Lead Score DESCendente' })
  async findAll(
    @Query('search') search?: string,
    @Query('universidadId') universidadId?: string,
    @Query('carreraId') carreraId?: string,
    @Query('estadoFunnel') estadoFunnel?: string,
    @Query('orderBy') orderBy?: 'leadScore' | 'fechaRegistro',
    @Query('orderDir') orderDir?: 'asc' | 'desc',
  ) {
    return this.buyersService.findAll({
      search,
      universidadId,
      carreraId,
      estadoFunnel,
      orderBy,
      orderDir,
    });
  }

  @Get('catalogos')
  @Public()
  @ApiOperation({ summary: 'Obtener catálogos de universidades y carreras para el formulario' })
  async getCatalogos() {
    return this.buyersService.getCatalogos();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener el detalle completo de un BUYER por ID' })
  async findById(@Param('id') id: string) {
    return this.buyersService.findById(id);
  }

  @Post('formulario')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Registrar un prospecto desde el formulario público de captación' })
  async createFromForm(@Body() dto: CreateBuyerFormDto, @Req() req: Request) {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.buyersService.createFromForm(dto, ip, userAgent);
  }
}
