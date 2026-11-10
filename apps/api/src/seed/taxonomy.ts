/**
 * Default sector taxonomy. Analysts can edit it in the UI (Sectors → Taxonomy); the seed
 * only inserts nodes that do not exist yet.
 *
 * - description: the definition shown to analysts and passed verbatim to the LLM classifier.
 * - keywords: signals used by the offline heuristic classifier (baseline in the eval).
 * - sourceTags: YC directory tags/industries that pull companies into a tracked sector.
 */
export interface TaxonomySeedNode {
  slug: string;
  name: string;
  description: string;
  keywords?: string[];
  color?: string;
}

export interface TaxonomySeedSector extends TaxonomySeedNode {
  sourceTags: string[];
  children: TaxonomySeedNode[];
}

export const TAXONOMY: TaxonomySeedSector[] = [
  {
    slug: 'legal-ai',
    name: 'Legal AI',
    description:
      'Software and tech-enabled services that automate legal work: drafting, review, research, filing and the business of running legal teams and law firms.',
    sourceTags: ['LegalTech', 'Legal'],
    color: '#4f46e5',
    children: [
      {
        slug: 'legal-contracts',
        name: 'Contracts & CLM',
        description:
          'Drafting, review, negotiation, redlining, signing and lifecycle management of commercial contracts and transactional documents.',
        keywords: ['contract', 'contracts', 'clm', 'negotiation', 'negotiate', 'redline', 'redlining', 'clause', 'nda', 'e-signature', 'e-signatures', 'signing', 'due diligence', 'diligence', 'm&a', 'transactions', 'corporate transactions', 'draft, negotiate', 'contract repository', 'version'],
      },
      {
        slug: 'legal-litigation',
        name: 'Litigation & Research',
        description:
          'Tools for litigators and legal research: case law research, discovery and document review, case strategy, class-action origination and trial preparation.',
        keywords: ['litigation', 'litigator', 'litigators', 'lawsuit', 'lawsuits', 'legal research', 'case law', 'discovery', 'e-discovery', 'document review', 'class action', 'trial', 'court', 'deposition', 'legal violations', 'laws free', 'justice'],
      },
      {
        slug: 'legal-ip',
        name: 'IP & Patents',
        description: 'Patent drafting and prosecution, patent analytics and infringement detection, trademarks and brand / IP enforcement.',
        keywords: ['patent', 'patents', 'trademark', 'trademarks', 'intellectual property', 'infringement', 'infringements', 'counterfeit', 'counterfeits', 'brand protection', 'ip enforcement', 'ip operating', 'ip assistant', 'prior art', 'prosecution'],
      },
      {
        slug: 'legal-ai-firms',
        name: 'AI-native Law Firms',
        description:
          'Licensed law firms or legal-services businesses that deliver legal work themselves, using their own technology as leverage (sell outcomes, not software). Applies regardless of practice area: an AI-native immigration or PI firm belongs here.',
        keywords: ['law firm', 'law firms for', 'ai-native law firm', 'ai law firm', 'native law firm', 'flat-fee', 'counsel', 'legal backoffice', 'legal investment', 'litigation finance'],
      },
      {
        slug: 'legal-plaintiff',
        name: 'Plaintiff & PI',
        description:
          'Software for plaintiff-side and personal-injury firms: client intake, medical-record retrieval and review, demand letters and case building.',
        keywords: ['personal injury', 'plaintiff', 'plaintiff-side', 'intake', 'medical record', 'medical records', 'demand letter', 'injury', 'front door', 'claimants'],
      },
      {
        slug: 'legal-compliance',
        name: 'Regulatory & Compliance',
        description:
          'Regulatory intelligence and compliance automation: tracking laws and regulations, compliance reviews, government requests, public policy and trade compliance.',
        keywords: ['compliance', 'regulatory', 'regulation', 'regulations', 'government requests', 'data requests', 'public policy', 'government affairs', 'tariff', 'supply chain compliance', 'policy', 'law enforcement'],
      },
      {
        slug: 'legal-immigration',
        name: 'Immigration',
        description: 'Immigration applications, visas, citizenship and employer immigration compliance.',
        keywords: ['immigration', 'visa', 'visas', 'citizenship', 'green card', 'immigrants'],
      },
      {
        slug: 'legal-workspace',
        name: 'AI Legal Workspaces',
        description:
          'Horizontal AI assistants, agents and "operating systems" for lawyers and in-house legal teams that span many practice areas rather than one workflow.',
        keywords: ['legal ai', 'ai for legal', 'legal teams', 'in-house', 'legal work', 'legal os', 'ai legal os', 'operating system for legal', 'legal agent', 'agentic', 'ai associate', 'associate', 'workspace', 'llm for legal', 'copilot', 'knowledge work'],
      },
      {
        slug: 'legal-ops',
        name: 'Legal Ops & Practice Mgmt',
        description:
          'Running the business of law: legal operations, e-billing and spend, timekeeping, practice and matter management, legal talent and staffing.',
        keywords: ['legal operations', 'legal ops', 'e-billing', 'billing', 'timekeeping', 'practice management', 'law firm operations', 'firm operations', 'talent', 'recruiting', 'paralegal', 'paralegals', 'growth os', 'matter management', 'workflows'],
      },
      {
        slug: 'legal-consumer',
        name: 'Consumer & SMB Legal',
        description:
          'Self-serve legal help for individuals and small businesses: wills, divorce, debt and bankruptcy, tickets, entity formation and startup paperwork.',
        keywords: ['will', 'wills', 'divorce', 'bankruptcy', 'debt', 'parking tickets', 'tickets', 'paperwork', 'incorporation', 'formation', 'notary', 'low-income', 'consumers', 'founders'],
      },
    ],
  },
  {
    slug: 'climate-tech',
    name: 'Climate Tech',
    description: 'Companies whose primary product reduces, removes or adapts to greenhouse-gas emissions and climate impacts.',
    sourceTags: ['Climate'],
    color: '#059669',
    children: [
      {
        slug: 'climate-carbon',
        name: 'Carbon Removal & Accounting',
        description: 'Carbon dioxide removal, capture and storage, carbon credits and markets, and emissions measurement / accounting (MRV).',
        keywords: ['carbon removal', 'carbon capture', 'direct air capture', 'co2', 'carbon credits', 'carbon credit', 'carbon accounting', 'emissions', 'offsets', 'sequestration', 'mrv', 'ghg', 'carbon dioxide', 'carbon footprint', 'carbon'],
      },
      {
        slug: 'climate-energy',
        name: 'Clean Energy & Storage',
        description: 'Generation (solar, wind, geothermal, nuclear, fusion), storage, hydrogen, and grid / utility infrastructure.',
        keywords: ['solar', 'battery', 'batteries', 'energy storage', 'grid', 'renewable', 'renewables', 'wind', 'geothermal', 'nuclear', 'fusion', 'hydrogen', 'power plant', 'electricity', 'utility', 'utilities', 'clean energy', 'fuel'],
      },
      {
        slug: 'climate-mobility',
        name: 'Electrification & Mobility',
        description: 'Electric vehicles and charging, electric aviation and marine, fleet electrification and low-carbon transport.',
        keywords: ['ev', 'evs', 'electric vehicle', 'electric vehicles', 'charging', 'chargers', 'electrification', 'e-bike', 'electric aircraft', 'aviation', 'fleet', 'fleets', 'trucks', 'mobility', 'transportation'],
      },
      {
        slug: 'climate-buildings',
        name: 'Buildings & Efficiency',
        description: 'Heat pumps, HVAC, building retrofits, home energy and energy-efficiency software for the built environment.',
        keywords: ['heat pump', 'heat pumps', 'hvac', 'buildings', 'building', 'home energy', 'efficiency', 'insulation', 'retrofit', 'retrofits', 'homeowners', 'thermostat', 'cooling', 'heating'],
      },
      {
        slug: 'climate-industry',
        name: 'Industry & Materials',
        description: 'Decarbonising heavy industry and materials: cement, steel, chemicals, manufacturing processes, recycling and the circular economy.',
        keywords: ['cement', 'steel', 'materials', 'chemicals', 'chemical', 'manufacturing', 'industrial', 'recycling', 'recycled', 'waste', 'plastic', 'plastics', 'circular', 'mining', 'minerals'],
      },
      {
        slug: 'climate-food',
        name: 'Food, Agriculture & Land',
        description: 'Agriculture, food systems, alternative proteins, forestry, soil, water and land use.',
        keywords: ['agriculture', 'farm', 'farms', 'farmers', 'food', 'crops', 'soil', 'alternative protein', 'forestry', 'forest', 'forests', 'land', 'fertilizer', 'water', 'ocean', 'kelp', 'cattle', 'methane'],
      },
      {
        slug: 'climate-software',
        name: 'Climate Data & Finance',
        description: 'Climate-risk data, sustainability reporting software, climate finance, insurance and marketplaces enabling the transition.',
        keywords: ['climate risk', 'esg', 'sustainability', 'reporting', 'climate finance', 'insurance', 'marketplace', 'data platform', 'analytics', 'software', 'financing', 'weather'],
      },
    ],
  },
  {
    slug: 'payments-infra',
    name: 'Payments Infrastructure',
    description: 'Companies that move money: acceptance, issuing, cross-border, B2B payments, embedded finance rails, and the risk tooling around them.',
    sourceTags: ['Payments'],
    color: '#d97706',
    children: [
      {
        slug: 'pay-acquiring',
        name: 'Acceptance & Checkout',
        description: 'Merchant acquiring, payment gateways, checkout, point-of-sale and online payment acceptance.',
        keywords: ['checkout', 'merchant', 'merchants', 'point of sale', 'pos', 'acquiring', 'payment gateway', 'online payments', 'accept payments', 'payment processing', 'e-commerce', 'restaurants'],
      },
      {
        slug: 'pay-crossborder',
        name: 'Cross-border & FX',
        description: 'International payments, remittances, foreign exchange and payment rails for emerging markets.',
        keywords: ['cross-border', 'cross border', 'international payments', 'remittance', 'remittances', 'fx', 'foreign exchange', 'global payments', 'emerging markets', 'africa', 'latin america', 'latam', 'india', 'mexico', 'nigeria', 'brazil'],
      },
      {
        slug: 'pay-b2b',
        name: 'B2B Payments & AP/AR',
        description: 'Accounts payable and receivable automation, invoicing, bill pay, payouts and payroll payments for businesses.',
        keywords: ['accounts payable', 'accounts receivable', 'invoicing', 'invoices', 'invoice', 'b2b payments', 'bill pay', 'ap automation', 'collections', 'payouts', 'payroll', 'vendors', 'suppliers'],
      },
      {
        slug: 'pay-cards',
        name: 'Cards & Spend',
        description: 'Card issuing, corporate cards, expense and spend management.',
        keywords: ['card issuing', 'corporate card', 'corporate cards', 'credit card', 'debit card', 'cards', 'card', 'expense', 'expenses', 'spend management'],
      },
      {
        slug: 'pay-embedded',
        name: 'Embedded Finance & Banking Rails',
        description: 'Banking-as-a-service, payment and ledger APIs, account infrastructure and money-movement rails for developers.',
        keywords: ['banking as a service', 'baas', 'embedded finance', 'embedded payments', 'payments api', 'api', 'apis', 'banking infrastructure', 'ledger', 'ledgers', 'bank accounts', 'core banking', 'infrastructure', 'developers', 'ach', 'open banking'],
      },
      {
        slug: 'pay-consumer',
        name: 'Consumer Payments & Wallets',
        description: 'Peer-to-peer payments, digital wallets, buy-now-pay-later, consumer rewards and money apps.',
        keywords: ['p2p', 'peer-to-peer', 'wallet', 'wallets', 'send money', 'bnpl', 'buy now pay later', 'rewards', 'tipping', 'consumers', 'students', 'families', 'mobile payments'],
      },
      {
        slug: 'pay-crypto',
        name: 'Crypto & Stablecoin Rails',
        description: 'Payments built on blockchains: stablecoin settlement, crypto on/off-ramps and on-chain payment infrastructure.',
        keywords: ['crypto', 'cryptocurrency', 'stablecoin', 'stablecoins', 'blockchain', 'bitcoin', 'web3', 'usdc', 'onchain', 'on-chain', 'defi', 'ethereum'],
      },
      {
        slug: 'pay-risk',
        name: 'Risk, Fraud & Compliance',
        description: 'Fraud prevention, chargebacks and disputes, KYC/AML and payments compliance.',
        keywords: ['fraud', 'chargeback', 'chargebacks', 'risk', 'kyc', 'aml', 'compliance', 'disputes', 'identity verification', 'underwriting'],
      },
    ],
  },
];
