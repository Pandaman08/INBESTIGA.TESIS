import { PrismaClient } from '@prisma/client';
import { esBuyerFicticio } from '../src/common/contact-policy';

const prisma = new PrismaClient();

/**
 * Elimina por completo a UN estudiante FICTICIO (todas sus fases) para repetir demos.
 * Uso: npx ts-node scripts/delete-test-user.ts <email@demo.inbestiga.test>
 *
 * Solo acepta el email exacto de un BUYER con dominio de prueba (LEADS_SANDBOX_EMAIL_DOMAINS).
 * Nunca borra registros reales ni busca por coincidencias parciales.
 */
export async function deleteTestUser(email: string) {
  if (!email || !esBuyerFicticio({ email })) {
    throw new Error('Indique el email exacto de un estudiante FICTICIO (p. ej. alguien@demo.inbestiga.test).');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('No se ejecuta con NODE_ENV=production.');
  }

  const buyers = await prisma.buyer.findMany({
    where: { email },
    include: {
      lead: {
        include: {
          cotizaciones: true,
        },
      },
      customer: true,
      payer: true,
    },
  });

  for (const buyer of buyers) {
    console.log(`Eliminando registros de buyer: ${buyer.nombres} ${buyer.apellidos} (${buyer.id})`);

    // 1. Eliminar sesiones y clientes asociados
    if (buyer.customer) {
      await prisma.sesion.deleteMany({ where: { customerId: buyer.customer.id } });
      await prisma.customer.delete({ where: { id: buyer.customer.id } });
    }

    // 2. Eliminar payers y pagos
    if (buyer.payer) {
      await prisma.payer.delete({ where: { id: buyer.payer.id } });
    }
    await prisma.pago.deleteMany({ where: { buyerId: buyer.id } });

    // 3. Eliminar conversaciones, mensajes y relaciones asociadas al lead y al buyer
    const convs = await prisma.conversacion.findMany({
      where: {
        OR: [
          { buyerId: buyer.id },
          ...(buyer.lead ? [{ leadId: buyer.lead.id }] : []),
        ],
      },
    });

    for (const c of convs) {
      await prisma.mensaje.deleteMany({ where: { conversacionId: c.id } });
      await prisma.diagnostico.deleteMany({ where: { conversacionId: c.id } });
      await prisma.objecion.deleteMany({ where: { conversacionId: c.id } });
      await prisma.seguimiento.deleteMany({ where: { conversacionId: c.id } });
      await prisma.propuesta.deleteMany({ where: { conversacionId: c.id } });
      await prisma.conversacion.delete({ where: { id: c.id } }).catch(() => null);
    }

    // 4. Eliminar cotizaciones, propuestas y lead
    if (buyer.lead) {
      await prisma.pago.deleteMany({ where: { leadId: buyer.lead.id } });
      await prisma.cotizacion.deleteMany({ where: { leadId: buyer.lead.id } });
      await prisma.propuesta.deleteMany({ where: { leadId: buyer.lead.id } });
      await prisma.lead.delete({ where: { id: buyer.lead.id } });
    }

    // 5. Perfil de negociación, formularios, interacciones y buyer
    await prisma.perfilNegociacion.deleteMany({ where: { buyerId: buyer.id } });
    await prisma.formulario.deleteMany({ where: { buyerId: buyer.id } });
    await prisma.interaccion.deleteMany({ where: { buyerId: buyer.id } });
    await prisma.buyer.delete({ where: { id: buyer.id } });
    console.log(`✓ Buyer y datos asociados eliminados exitosamente.`);
  }

  console.log(`Limpieza completada con éxito.`);
}

if (require.main === module) {
  deleteTestUser(process.argv[2])
    .catch((e) => {
      console.error('Error durante la eliminación:', e.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
