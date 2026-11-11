import { AiToolsService } from './ai-tools.service';

describe('AiToolsService: frontera LEADS/PAYERS', () => {
  // Cualquier acceso a Prisma desde estas herramientas sería un efecto no permitido.
  const prisma = new Proxy({}, { get: () => new Proxy({}, { get: () => jest.fn(() => { throw new Error('acceso a BD no permitido'); }) }) });
  const svc = new AiToolsService(prisma as any, {} as any);

  it('confirm_payment no se ofrece al modelo', () => {
    const nombres = svc.getToolDefinitions().map((t) => t.name);
    expect(nombres).not.toContain('confirm_payment');
  });

  it('"ya pagué" no acredita pagos: confirm_payment está bloqueado y no toca PAGO/PAYER/CUSTOMER', async () => {
    const r: any = await svc.executeTool('confirm_payment', { montoAbonado: 2200, metodoPago: 'YAPE' }, { buyerId: 'b1', conversacionId: 'c1' });
    expect(r).toMatchObject({ exito: false, bloqueado: true });
  });

  it('update_stage no permite que la IA marque CONVERTED ni PAYMENT_PENDING', async () => {
    for (const etapa of ['CONVERTED', 'PAYMENT_PENDING']) {
      const r: any = await svc.executeTool('update_stage', { etapa }, { conversacionId: 'c1' });
      expect(r.actualizado).toBe(false);
    }
  });
});
