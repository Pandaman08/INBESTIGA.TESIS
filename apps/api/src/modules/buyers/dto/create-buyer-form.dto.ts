import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsEmail, IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateBuyerFormDto {
  // --- Campos Principales del Diagrama E-R (BUYER) ---

  @ApiPropertyOptional({ example: 'ESTUDIANTE', description: 'Tipo de perfil: ESTUDIANTE, EGRESADO, PADRE_FAMILIA, APODERADO' })
  @IsOptional()
  @IsString()
  tipoPerfil?: string;

  @ApiPropertyOptional({ example: 'Ana Lucía Pérez Mendoza' })
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ example: 'Ana Lucía' })
  @IsOptional()
  @IsString()
  nombres?: string;

  @ApiPropertyOptional({ example: 'Pérez Mendoza' })
  @IsOptional()
  @IsString()
  apellidos?: string;

  @ApiProperty({ example: '51949123456' })
  @IsString()
  @IsNotEmpty()
  whatsapp: string;

  @ApiPropertyOptional({ example: 'ana.perez@unt.edu.pe' })
  @IsOptional()
  @IsString()
  correo?: string;

  @ApiPropertyOptional({ example: 'ana.perez@unt.edu.pe' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'La Libertad' })
  @IsOptional()
  @IsString()
  departamento?: string;

  @ApiPropertyOptional({ example: 'Trujillo' })
  @IsOptional()
  @IsString()
  distrito?: string;

  @ApiPropertyOptional({ example: 'PUBLICA', description: 'PUBLICA o PRIVADA' })
  @IsOptional()
  @IsString()
  tipoUniversidad?: string;

  @ApiPropertyOptional({ example: 'Sede Central' })
  @IsOptional()
  @IsString()
  sede?: string;

  @ApiProperty({ example: 'Universidad Nacional de Trujillo' })
  @IsString()
  @IsNotEmpty()
  universidad: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  universidadId?: string;

  @ApiPropertyOptional({ example: 'Facultad de Ingeniería' })
  @IsOptional()
  @IsString()
  facultad?: string;

  @ApiProperty({ example: 'Ingeniería de Sistemas' })
  @IsString()
  @IsNotEmpty()
  carrera: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  carreraId?: string;

  @ApiProperty({ example: '10mo ciclo' })
  @IsString()
  @IsNotEmpty()
  ciclo: string;

  @ApiPropertyOptional({ example: 23 })
  @IsOptional()
  @IsNumber()
  edad?: number;

  @ApiPropertyOptional({ example: 'uuid-estudiante-hijo', description: 'ID del BUYER estudiante al que financia (si es padre/familiar)' })
  @IsOptional()
  @IsString()
  financiaAIdBuyer?: string;

  @ApiPropertyOptional({ example: 'META_ADS', description: 'Canal de captación: TIKTOK, META_ADS, GOOGLE, ORGANICO, REFERIDO' })
  @IsOptional()
  @IsString()
  canalCaptacion?: string;

  @ApiPropertyOptional({ example: 'META_ADS' })
  @IsOptional()
  @IsString()
  canalCodigo?: string;

  // --- Campos para DESCARGA_CONTENIDO y CATALOGO_SERVICIOS ---
  @ApiPropertyOptional({ example: 'srv-cat-01', description: 'ID del paquete en CATALOGO_SERVICIOS descargado como recurso/lead magnet' })
  @IsOptional()
  @IsString()
  servicioIdAsociado?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  descargoLeadMagnet?: boolean;

  // --- Campos para INTERACCION_RED_SOCIAL ---
  @ApiPropertyOptional({ example: 'TIKTOK', description: 'Red social de procedencia: TIKTOK, INSTAGRAM, FACEBOOK' })
  @IsOptional()
  @IsString()
  redSocial?: string;

  @ApiPropertyOptional({ example: 'COMENTARIO', description: 'Tipo de interacción en red social: COMENTARIO, MENSAJE_DIRECTO, CLIC_ANUNCIO' })
  @IsOptional()
  @IsString()
  tipoInteraccion?: string;

  @ApiPropertyOptional({ example: 'Dificultad con SPSS y metodología' })
  @IsOptional()
  @IsString()
  temaDetectado?: string;

  // --- Campos complementarios de Diagnóstico Académico ---
  @ApiPropertyOptional({ example: 'TESIS' })
  @IsOptional()
  @IsString()
  tipoInvestigacion?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  consentimientoWhatsapp?: boolean;

  @ApiPropertyOptional({ example: 'Trujillo' })
  @IsOptional()
  @IsString()
  ubicacion?: string;

  @ApiPropertyOptional({ example: 'TRABAJA_TIEMPO_COMPLETO' })
  @IsOptional()
  @IsString()
  situacionLaboral?: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsNumber()
  plazoDefinidoDias?: number;

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber()
  presupuestoAprox?: number;

  @ApiPropertyOptional({ example: 'Falta de tiempo y asesor no responde' })
  @IsOptional()
  @IsString()
  dolorPrincipal?: string;

  @ApiPropertyOptional({ example: 'PYTHON' })
  @IsOptional()
  @IsString()
  softwareRequerido?: string;
}
