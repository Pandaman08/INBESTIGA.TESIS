import { Public } from '../auth/auth.decorators';
import { Throttle } from '@nestjs/throttler';
import { Controller, Post, Get, Param, Body, Headers, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';

@ApiTags('Pagos / Pasarela Real')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos los pagos y comprobantes electrónicos emitidos' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'estado', required: false })
  @ApiQuery({ name: 'metodoPago', required: false })
  async getPagos(
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('metodoPago') metodoPago?: string,
  ) {
    return this.paymentsService.findAllPagos({ search, estado, metodoPago });
  }

  @Get('comprobante/:id')
  @ApiOperation({ summary: 'Obtener datos oficiales de la Boleta de Venta Electrónica por Pago ID' })
  async getComprobante(@Param('id') id: string) {
    return this.paymentsService.getComprobante(id);
  }

  @Get('cotizacion/:id')
  @Public() // checkout del estudiante (id UUID no adivinable)
  @ApiOperation({ summary: 'Obtener datos de la cotización para la pantalla de Checkout' })
  async getCotizacion(@Param('id') id: string) {
    return this.paymentsService.getCotizacion(id);
  }

  @Get('webhook')
  @Public()
  @ApiOperation({ summary: 'Verificación de estado del Webhook' })
  async checkWebhook() {
    return {
      status: 'active',
      servicio: 'INBESTIGA.TESIS Payment Webhook',
      proveedor: 'CULQI',
      mensaje: 'Endpoint público activo y listo para recibir eventos POST desde Culqi.',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('webhook')
  @Public() // la pasarela valida su propia firma (fase PAYERS)
  @ApiOperation({ summary: 'Webhook oficial de la pasarela de pagos (Culqi / Stripe)' })
  async handleWebhook(@Body() payload: any, @Headers('stripe-signature') signature?: string) {
    return this.paymentsService.procesarWebhook(payload, signature);
  }

  @Post('checkout/procesar')
  @Public() // checkout del estudiante
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Procesar pago desde la interfaz web de Checkout con Yape directo (Culqi) o Tarjeta' })
  async procesarCheckout(
    @Body()
    dto: {
      cotizacionId: string;
      metodoPago: 'CARD' | 'YAPE' | 'TRANSFER';
      referencia?: string;
      numeroTarjeta?: string;
      telefonoYape?: string;
      codigoAprobacion?: string;
    },
  ) {
    return this.paymentsService.procesarPagoCheckout(dto);
  }

  @Post('sincronizar-culqi')
  @ApiOperation({ summary: 'Detectar y sincronizar pagos pendientes realizados vía pasarela Culqi' })
  async sincronizarCulqi() {
    return this.paymentsService.sincronizarPagosCulqi();
  }

  @Post(':id/confirmar')
  @ApiOperation({ summary: 'Acreditar o confirmar manualmente un pago pendiente (genera Boleta Electrónica)' })
  async confirmarPago(
    @Param('id') id: string,
    @Body() body?: { metodoPago?: string; referencia?: string; monto?: number },
  ) {
    return this.paymentsService.confirmarPagoManual(id, body);
  }
}
