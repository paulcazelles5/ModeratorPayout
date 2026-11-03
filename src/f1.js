const DATA_PATH = path.join(__dirname, '..', 'data.json');
const conversations = new Map();
const pendingForms = new Map();
const pendingGiveaways = new Map();
const pendingConfirms = new Map();

function defaultData() {
  return {
    openTickets: {},
    closedHistory: [],
    ticketCounter: 0,
    maxTicketsPerUser: 1,
    requireForm: true,
    allowReopen: true,
    reopenHours: 24,
    categories: [
      { id: 'report_someone', label: 'Report Someone', form: true },
      { id: 'report_bugs', label: 'Report Server Bugs', form: true },
      { id: 'claim_giveaway', label: 'Claim Giveaway', form: true },
      { id: 'host_giveaway', label: 'Host Giveaway', form: true },
      { id: 'start_partnership', label: 'Start Partnership', form: true },
    ],
    welcomeMessage: 'Welcome {user}. Category: {category}. Ticket #{number}. Priority: {priority}.\n\n{form}',
    giveaways: {},
    warnings: {},
    cases: {},
    blacklist: [],
    whitelist: [],
    antiNuke: { enabled: true, channelDeletes: 3, roleDeletes: 3, bans: 5, webhooks: 3 },
    antiRaid: { enabled: true, joins: 10, accountAgeDays: 3, lockdown: true },
    antiSpam: { enabled: true },
    honeypot: { enabled: false },
    raidMode: false,
    staffRoles: [],
    modRoles: [],
    logChannel: null,
    modLogChannel: null,
  };
}

let data = defaultData();
function loadData() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const loaded = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
      data = { ...defaultData(), ...loaded };
    }
  } catch (e) { console.error('loadData', e.message); }
}
function saveData() {
  try { fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2)); } catch (e) { console.error(e.message); }
}
loadData();

const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY, baseURL: OPENAI_BASE_URL }) : null;

function getActivePrompt() {
  if (process.env.AI_SYSTEM_PROMPT) return process.env.AI_SYSTEM_PROMPT;
  return DEFAULT_SYSTEM_PROMPT;
}
