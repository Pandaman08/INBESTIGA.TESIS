import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ESTADOS_OPORTUNIDAD } from './domain/oportunidad-estados';

export class AbrirOportunidadDto {
  @ApiProperty({ description: 'BUYER (debe ser LEAD). Si ya tiene una oportunidad abierta, se devuelve esa.' })
  @IsString()
  @IsNotEmpty()
  buyerId!: string;
}

export class TransicionOportunidadDto {
  @ApiProperty({ enum: ESTADOS_OPORTUNIDAD, description: 'Solo transiciones MANUALES: EN_DIAGNOSTICO, APTA_PARA_COTIZAR, DESCARTADA.' })
  @IsIn(ESTADOS_OPORTUNIDAD as unknown as string[])
  estado!: string;

  @ApiPropertyOptional({ description: 'Obligatorio para DESCARTADA.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}

export class CrearPropuestaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  servicioId!: string;

  @ApiProperty({ example: 2200 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  precioPropuesto!: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  numeroCuotas?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  plazoDias?: number;

  @ApiPropertyOptional({ description: 'Por defecto: presentación + LEADS_VIGENCIA_PROPUESTA_DIAS (7).' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  vigenciaHasta?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justificacion?: string;
}

export class ResponderPropuestaDto {
  @ApiProperty({ enum: ['ACEPTADA', 'RECHAZADA', 'SOLICITA_AJUSTE'] })
  @IsIn(['ACEPTADA', 'RECHAZADA', 'SOLICITA_AJUSTE'])
  tipoRespuesta!: 'ACEPTADA' | 'RECHAZADA' | 'SOLICITA_AJUSTE';

  @ApiPropertyOptional({ description: 'Debe ser true para ACEPTADA: el estudiante aceptó expresamente esta versión.' })
  @IsOptional()
  @IsBoolean()
  confirmacionExpresa?: boolean;

  @ApiPropertyOptional({ enum: ['WHATSAPP', 'CHAT_WEB_INTERNO', 'PRESENCIAL', 'EMAIL'] })
  @IsOptional()
  @IsIn(['WHATSAPP', 'CHAT_WEB_INTERNO', 'PRESENCIAL', 'EMAIL'])
  canal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacion?: string;

  @ApiPropertyOptional({ description: 'Mensaje del chat que evidencia la respuesta.' })
  @IsOptional()
  @IsString()
  evidenciaMensajeId?: string;
}
