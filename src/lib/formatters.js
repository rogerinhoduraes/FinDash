import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatCurrency(value, options = {}) {
  const v = typeof value === 'string' ? parseFloat(value) : (value ?? 0)
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    ...options,
  }).format(v)
}

export function formatDate(date, fmt = 'dd/MM/yyyy') {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date?.toDate?.() ?? new Date(date)
  return format(d, fmt, { locale: ptBR })
}

export function formatRelativeTime(date) {
  if (!date) return null
  const d = date?.toDate?.() ?? (typeof date === 'string' ? parseISO(date) : new Date(date))
  return formatDistanceToNow(d, { locale: ptBR, addSuffix: true })
}

export function formatPercent(value, decimals = 1) {
  return `${(value ?? 0).toFixed(decimals)}%`
}

const BANK_META = {
  nubank:   { label: 'Nubank',   color: '#8a05be', light: '#c77dff', bg: 'bg-[#8a05be]' },
  santander:{ label: 'Santander',color: '#ec0000', light: '#ff7676', bg: 'bg-[#ec0000]' },
  inter:    { label: 'Inter',    color: '#ff7a00', light: '#ffb369', bg: 'bg-[#ff7a00]' },
}

export function getBankMeta(bankName) {
  const key = (bankName ?? '').toLowerCase().replace(/\s+/g, '')
  return BANK_META[key] ?? { label: bankName ?? 'Banco', color: '#64748b', light: '#94a3b8', bg: 'bg-slate-500' }
}

export function getBankColor(bankName) {
  return getBankMeta(bankName).color
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

const INVESTMENT_TYPE_PT = {
  'MUTUAL_FUND':   'Fundo de Investimento',
  'FIXED_INCOME':  'Renda Fixa',
  'RENDA_FIXA':    'Renda Fixa',
  'EQUITY':        'Ações',
  'ETF':           'ETF',
  'FII':           'FII',
  'COE':           'COE',
  'SECURITY':      'Título',
  'OTHER':         'Outros',
  'OUTROS':        'Outros',
  'CDB':           'CDB',
  'LCI':           'LCI',
  'LCA':           'LCA',
  'TESOURO':       'Tesouro Direto',
  'TREASURY':      'Tesouro Direto',
  'CRYPTO':        'Criptomoedas',
}

export function translateInvestmentType(type) {
  if (!type) return 'Outros'
  return INVESTMENT_TYPE_PT[type.toUpperCase()] ?? type
}

const CATEGORY_PT = {
  // Pluggy taxonomy
  'Clothing and Accessories':             'Roupas e Acessórios',
  'Education':                            'Educação',
  'Electronics':                          'Eletrônicos',
  'Entertainment':                        'Entretenimento',
  'Food and Groceries':                   'Alimentação',
  'Food and Drink':                       'Alimentação',
  'Health and Fitness':                   'Saúde',
  'Health':                               'Saúde',
  'Home':                                 'Casa',
  'Home Improvement':                     'Casa e Reformas',
  'Insurance':                            'Seguros',
  'Investments':                          'Investimentos',
  'Others':                               'Outros',
  'Other':                                'Outros',
  'Personal':                             'Pessoal',
  'Personal Care':                        'Cuidados Pessoais',
  'Recurring':                            'Recorrentes',
  'Services':                             'Serviços',
  'Shopping':                             'Compras',
  'Supermarkets':                         'Supermercados',
  'Supermarket':                          'Supermercados',
  'Transport':                            'Transporte',
  'Transportation':                       'Transporte',
  'Travel':                               'Viagens',
  'Transfers':                            'Transferências',
  'Transfer':                             'Transferências',
  'Taxes':                                'Impostos',
  'Utilities':                            'Contas de Consumo',
  'Withdrawals':                          'Saques',
  'Withdrawal':                           'Saques',
  'Credit Card':                          'Cartão de Crédito',
  'Income':                               'Receita',
  'Salary':                               'Salário',
  'Subscriptions and Services':           'Assinaturas',
  'Subscriptions':                        'Assinaturas',
  'Restaurants':                          'Restaurantes',
  'Automotive':                           'Automóvel',
  'Pets':                                 'Pets',
  'Gifts and Donations':                  'Presentes e Doações',
  'Loans':                                'Empréstimos',
  'Rent':                                 'Aluguel',
  'Telecom':                              'Telefonia',
  'Internet':                             'Internet',
  'Financial Services':                   'Serviços Financeiros',
  'Cash and ATM':                         'Caixa / ATM',
  'Pharmacy':                             'Farmácia',
  // Pluggy extended / raw categories
  'Proceeds interests and dividends':     'Rendimentos e Dividendos',
  'Transfer - PIX':                       'Transferência PIX',
  'Transfer - TED':                       'Transferência TED',
  'Transfer - DOC':                       'Transferência DOC',
  'Transfer - Internal':                  'Transferência Interna',
  'Credit Card Payment':                  'Pagamento de Fatura',
  'Credit card':                          'Cartão de Crédito',
  'Fees and Charges':                     'Tarifas e Encargos',
  'Bank Fees':                            'Tarifas Bancárias',
  'IOF':                                  'IOF',
  'Debt':                                 'Dívida',
  'Payment':                              'Pagamento',
  'Bills':                                'Contas',
  'Mobile':                               'Celular',
  'Gas':                                  'Combustível',
  'Parking':                              'Estacionamento',
  'Tolls':                                'Pedágios',
  'Rideshare':                            'Transporte por Aplicativo',
  'Groceries':                            'Supermercado',
  'Fast Food':                            'Fast Food',
  'Coffee':                               'Café',
  'Alcohol':                              'Bebidas',
  'Sports':                               'Esportes',
  'Games':                                'Jogos',
  'Music':                                'Música',
  'Streaming':                            'Streaming',
  'Books':                                'Livros',
  'Electronics and Technology':           'Eletrônicos',
  'Home Furnishings':                     'Móveis e Decoração',
  'Clothing':                             'Roupas',
  'Beauty':                               'Beleza',
  'Charity':                              'Doações',
  'Government':                           'Governo',
  'Dentist':                              'Dentista',
  'Doctor':                               'Médico',
  'Hospital':                             'Hospital',
  'Gym':                                  'Academia',
  'Airlines':                             'Passagens Aéreas',
  'Hotel':                                'Hotel',
  'Car Rental':                           'Aluguel de Carro',
}

export function translateCategory(cat) {
  if (!cat) return 'Outros'
  return CATEGORY_PT[cat] ?? cat
}
