const { SyncHubCore } = require('./core/synchub-core');

const core = new SyncHubCore({
  activeModules: ['student', 'freelancer', 'company'],
  focusThreshold: 72,
});

core.setFocusMode(true, 72);

const sampleMessages = [
  {
    source: 'whatsapp',
    sender: 'Cliente Alfa',
    senderRole: 'client',
    moduleId: 'freelancer',
    text: 'Oi! Preciso de um orcamento urgente para ecommerce ate 18/03/2026.',
  },
  {
    source: 'gmail',
    sender: 'Professor Carlos',
    senderRole: 'professor',
    moduleId: 'student',
    text: 'A prova final foi antecipada para amanha. Revisar modulo 4 e 5.',
  },
  {
    source: 'slack',
    sender: 'OnCall Bot',
    senderRole: 'manager',
    moduleId: 'company',
    text: 'Incidente critico em producao: fila de notificacoes bloqueada.',
  },
  {
    source: 'telegram',
    sender: 'Equipe Design',
    moduleId: 'company',
    text: 'Reuniao de alinhamento hoje as 16h para revisar entrega sprint.',
  },
];

for (const message of sampleMessages) {
  core.ingestMessage(message);
}

const output = {
  focusMode: core.getFocusModeState(),
  overview: core.getDailyOverview(),
  focusInbox: core.getInbox({ focus: true, limit: 10 }),
  tasks: core.listTasks(),
  notifications: core.listNotifications(10),
  automationRules: core.listAutomationRules(),
};

console.log(JSON.stringify(output, null, 2));

