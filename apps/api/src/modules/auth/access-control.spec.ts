import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import * as request from 'supertest';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../database/prisma.service';
import { NegotiationController } from '../negotiation/negotiation.controller';
import { NegotiationService } from '../negotiation/negotiation.service';
import { WhatsAppController } from '../whatsapp/whatsapp.controller';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { BuyersController } from '../buyers/buyers.controller';
import { BuyersService } from '../buyers/buyers.service';

const SECRET = 'x'.repeat(40);

describe('Control de acceso (guard global JWT + roles)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const usuarios: Record<string, any> = {
    admin: { id: 'admin', username: 'admin', email: 'a@x', rol: 'ADMIN', activo: true },
    asesor: { id: 'asesor', username: 'asesor', email: 's@x', rol: 'ASESOR', activo: true },
    inactivo: { id: 'inactivo', username: 'i', email: 'i@x', rol: 'ADMIN', activo: false },
  };
  const negotiation = {
    limpiarConversacion: jest.fn().mockResolvedValue({ exito: true }),
    procesarMensajePrueba: jest.fn().mockResolvedValue({ exito: true }),
    procesarMensajeEstudiante: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    delete process.env.OPENWA_WEBHOOK_SECRET;
    const mod = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({ JWT_SECRET: SECRET })] }),
        PassportModule,
        JwtModule.register({ secret: SECRET }),
      ],
      controllers: [NegotiationController, WhatsAppController, BuyersController],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: PrismaService, useValue: { usuario: { findUnique: ({ where }) => Promise.resolve(usuarios[where.id] ?? null) } } },
        { provide: NegotiationService, useValue: negotiation },
        { provide: WhatsAppService, useValue: { getStatus: jest.fn().mockResolvedValue({ conectado: false }) } },
        { provide: BuyersService, useValue: { getCatalogos: jest.fn().mockResolvedValue({ universidades: [] }), findAll: jest.fn().mockResolvedValue([]) } },
      ],
    }).compile();
    app = mod.createNestApplication();
    await app.init();
    jwt = mod.get(JwtService);
  });

  afterAll(() => app.close());

  const token = (id: string) => `Bearer ${jwt.sign({ sub: id })}`;

  it('sin sesión → 401 en limpiar conversación, chat de prueba, simulación y estado de WhatsApp', async () => {
    await request(app.getHttpServer()).post('/negotiation/conversacion/c1/limpiar').expect(401);
    await request(app.getHttpServer()).post('/negotiation/enviar-mensaje').send({ contenido: 'x' }).expect(401);
    await request(app.getHttpServer()).post('/whatsapp/simulate-incoming').send({ contenido: 'x' }).expect(401);
    await request(app.getHttpServer()).get('/whatsapp/status').expect(401);
    await request(app.getHttpServer()).get('/buyers').expect(401);
    expect(negotiation.limpiarConversacion).not.toHaveBeenCalled();
  });

  it('token inválido o de usuario inactivo → 401', async () => {
    await request(app.getHttpServer()).get('/buyers').set('Authorization', 'Bearer basura').expect(401);
    await request(app.getHttpServer()).get('/buyers').set('Authorization', token('inactivo')).expect(401);
  });

  it('rol ASESOR → 403 en operaciones administrativas', async () => {
    await request(app.getHttpServer()).post('/negotiation/conversacion/c1/limpiar').set('Authorization', token('asesor')).expect(403);
    expect(negotiation.limpiarConversacion).not.toHaveBeenCalled();
  });

  it('rol ADMIN → permitido', async () => {
    await request(app.getHttpServer()).post('/negotiation/conversacion/c1/limpiar').set('Authorization', token('admin')).expect(201);
    expect(negotiation.limpiarConversacion).toHaveBeenCalledWith('c1');
  });

  it('rutas públicas siguen accesibles sin sesión: catálogos del formulario y webhook de OpenWA', async () => {
    await request(app.getHttpServer()).get('/buyers/catalogos').expect(200);
    await request(app.getHttpServer())
      .post('/whatsapp/webhook')
      .send({ event: 'session.status', data: { status: 'ready' } })
      .expect(200);
  });
});
