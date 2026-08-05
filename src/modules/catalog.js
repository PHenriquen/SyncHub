const MODULE_CATALOG = Object.freeze({
  student: {
    id: 'student',
    name: 'Estudante',
    description: 'Alertas academicos, organizacao de rotina e foco para estudos.',
    keywordBoost: {
      prova: 24,
      trabalho: 18,
      atividade: 14,
      seminario: 14,
      faculdade: 12,
      prazo: 12,
      nota: 10,
    },
    senderRoleBoost: {
      professor: 24,
      coordenador: 16,
      monitor: 10,
    },
  },
  freelancer: {
    id: 'freelancer',
    name: 'Freelancer',
    description: 'Gestao de clientes, propostas e entregas com automacoes.',
    keywordBoost: {
      cliente: 18,
      orcamento: 26,
      proposta: 22,
      contrato: 22,
      entrega: 16,
      revisao: 14,
      pagamento: 20,
    },
    senderRoleBoost: {
      cliente: 26,
      lead: 18,
      parceiro: 14,
    },
  },
  company: {
    id: 'company',
    name: 'Empresa',
    description: 'Comunicacao de equipe, operacao e monitoramento corporativo.',
    keywordBoost: {
      incidente: 28,
      producao: 20,
      deploy: 18,
      bloqueio: 16,
      alinhamento: 12,
      equipe: 10,
      sla: 20,
    },
    senderRoleBoost: {
      gestor: 24,
      diretor: 26,
      rh: 12,
      suporte: 18,
    },
  },
  creator: {
    id: 'creator',
    name: 'Criador de Conteudo',
    description: 'Centralizacao de mensagens sociais, leads e oportunidades.',
    keywordBoost: {
      publi: 22,
      parceria: 20,
      campanha: 18,
      marca: 16,
      lead: 16,
      collab: 16,
      oportunidade: 18,
    },
    senderRoleBoost: {
      agencia: 20,
      marca: 24,
      seguidor: 8,
      patrocinador: 26,
    },
  },
});

function getModule(moduleId) {
  if (!moduleId) {
    return null;
  }
  return MODULE_CATALOG[moduleId] || null;
}

function listModules() {
  return Object.values(MODULE_CATALOG).map((moduleDef) => ({
    id: moduleDef.id,
    name: moduleDef.name,
    description: moduleDef.description,
  }));
}

module.exports = {
  MODULE_CATALOG,
  getModule,
  listModules,
};

