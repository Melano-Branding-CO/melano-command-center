export type CommercialInput = {
  organizationId: string;
  clientId: string;
  status: string;
  currency: string;
  mrr: number;
  nextAction: string;
  nextFollowUpAt: string | null;
};

export function validateCommercialInput(input: CommercialInput): CommercialInput {
  if (!input?.organizationId || !input.clientId)
    throw new Error("Cuenta y organización requeridas");
  if (!["PROSPECTO", "ACTIVO", "PAUSADO", "BAJA"].includes(input.status))
    throw new Error("Estado comercial inválido");
  if (!Number.isFinite(input.mrr) || input.mrr < 0)
    throw new Error("MRR inválido: debe ser un importe mayor o igual a cero");
  if (!/^[A-Z]{3}$/.test(input.currency))
    throw new Error("Usá una moneda de tres letras, por ejemplo ARS o USD");
  const action = input.nextAction.trim();
  if (!action || action.length > 1000)
    throw new Error("Registrá una próxima acción de hasta 1000 caracteres");
  if (!input.nextFollowUpAt || !Number.isFinite(Date.parse(input.nextFollowUpAt)))
    throw new Error("Registrá una fecha de seguimiento válida");
  return {
    ...input,
    nextAction: action,
    nextFollowUpAt: new Date(input.nextFollowUpAt).toISOString(),
  };
}
