import { ArchitectureMap, RepoSkeleton, ChatResponse } from '@/shared/types';

export const MOCK_REPO_SKELETON: RepoSkeleton = {
  repoUrl: 'https://github.com/expressjs/express',
  commitSha: '5c6a1b2d3e4f',
  files: [
    {
      filePath: 'src/auth/jwtService.ts',
      imports: ['jsonwebtoken', '../config/keys'],
      exports: ['generateToken', 'verifyToken'],
      functionSignatures: ['generateToken(payload: UserPayload): string', 'verifyToken(token: string): DecodedUser'],
    },
    {
      filePath: 'src/database/connection.ts',
      imports: ['pg', '../config/dbConfig'],
      exports: ['pool', 'query'],
      functionSignatures: ['query(text: string, params?: any[]): Promise<QueryResult>'],
    },
    {
      filePath: 'src/payments/stripeClient.ts',
      imports: ['stripe', '../config/secrets'],
      exports: ['createCharge', 'createCustomer'],
      functionSignatures: ['createCharge(amount: number, currency: string): Promise<ChargeResult>'],
    },
    {
      filePath: 'src/interface/routes.ts',
      imports: ['express', '../auth/jwtService', '../services/userService', '../payments/stripeClient'],
      exports: ['router'],
      functionSignatures: ['setupRoutes(app: Express): void'],
    },
    {
      filePath: 'src/services/userService.ts',
      imports: ['../database/connection', '../auth/jwtService'],
      exports: ['getUserById', 'createUser'],
      functionSignatures: ['getUserById(id: string): Promise<User>', 'createUser(data: UserInput): Promise<User>'],
    },
  ],
};

export const MOCK_MERMAID_DEFINITION = `flowchart TD
  subgraph Interface ["Interface / API Layer"]
    routes["routes.ts<br/><small>Express route controllers</small>"]
    middleware["middleware.ts<br/><small>Request logger & CORS</small>"]
  end

  subgraph Auth ["Authentication"]
    jwt["jwtService.ts<br/><small>Token generation & verification</small>"]
    authGuard["authGuard.ts<br/><small>Bearer session validator</small>"]
  end

  subgraph Services ["Core Services"]
    userSvc["userService.ts<br/><small>User lifecycle management</small>"]
    auditSvc["auditService.ts<br/><small>Event logging pipeline</small>"]
  end

  subgraph Payments ["Payments & Billing"]
    stripe["stripeClient.ts<br/><small>Payment gateway integration</small>"]
    webhooks["webhookHandler.ts<br/><small>Invoice & charge listeners</small>"]
  end

  subgraph Database ["Database / Storage"]
    db["connection.ts<br/><small>PostgreSQL connection pool</small>"]
    models["models.ts<br/><small>Schema entities</small>"]
  end

  routes --> middleware
  routes --> authGuard
  authGuard --> jwt
  routes --> userSvc
  routes --> stripe
  userSvc --> db
  userSvc --> auditSvc
  stripe --> webhooks
  webhooks --> db
  db --> models

  classDef authClass fill:#EFF6FF,stroke:#3B82F6,stroke-width:2px,color:#1E3A8A;
  classDef dbClass fill:#ECFDF5,stroke:#10B981,stroke-width:2px,color:#064E3B;
  classDef payClass fill:#FEF2F2,stroke:#EF4444,stroke-width:2px,color:#7F1D1D;
  classDef ifaceClass fill:#F5F3FF,stroke:#8B5CF6,stroke-width:2px,color:#4C1D95;
  classDef svcClass fill:#FFFBEB,stroke:#F59E0B,stroke-width:2px,color:#78350F;

  class jwt,authGuard authClass;
  class db,models dbClass;
  class stripe,webhooks payClass;
  class routes,middleware ifaceClass;
  class userSvc,auditSvc svcClass;
`;

export const MOCK_ZONE_COLORS: Record<string, string> = {
  Auth: '#3B82F6',
  Database: '#10B981',
  Payments: '#EF4444',
  Interface: '#8B5CF6',
  Services: '#F59E0B',
};

export const MOCK_INITIAL_CHAT = [
  {
    role: 'assistant' as const,
    content: "👋 Welcome to **RepoLens**! I've loaded the architecture visualization for this repository. You can click on any node or group in the diagram to inspect its role and dependencies, or ask me questions about how modules interact.",
    timestamp: new Date().toISOString(),
    highlightedNodeIds: ['routes', 'userSvc', 'db'],
  },
];
